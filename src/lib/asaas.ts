/**
 * Núcleo adaptado da integração Asaas do Pacelab: clientes, cobranças e
 * tratamento seguro de respostas. As regras de negócio são próprias do VR Gestão.
 */
import { decryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";

type JsonObject = Record<string, unknown>;
export type AsaasBillingType = "PIX" | "CREDIT_CARD" | "BOLETO";
export type AsaasEnvironment = "sandbox" | "production";

const REQUEST_TIMEOUT_MS = 8_000;

export class AsaasError extends Error {
  constructor(message: string, public readonly status = 502, public readonly providerMessage?: string) {
    super(message);
    this.name = "AsaasError";
  }
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function providerError(payload: unknown) {
  if (!isObject(payload) || !Array.isArray(payload.errors)) return null;
  const error = payload.errors.find(isObject);
  return error ? stringValue(error.description) : null;
}

function apiBase(environment: AsaasEnvironment) {
  return environment === "production" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3";
}

async function credentials() {
  const persisted = await prisma.paymentIntegration.findUnique({ where: { provider: "ASAAS" } });
  const apiKey = persisted?.apiKeyEncrypted ? decryptSecret(persisted.apiKeyEncrypted) : process.env.ASAAS_API_KEY?.trim();
  const environment = (persisted?.environment ?? process.env.ASAAS_ENVIRONMENT ?? "sandbox") as AsaasEnvironment;
  if (!apiKey || (environment !== "sandbox" && environment !== "production")) {
    throw new AsaasError("Integração Asaas ainda não configurada.", 503);
  }
  return { apiKey, environment };
}

async function asaasRequest(path: string, init: RequestInit = {}) {
  const { apiKey, environment } = await credentials();
  let response: Response;
  try {
    response = await fetch(`${apiBase(environment)}${path}`, {
      ...init,
      headers: { Accept: "application/json", "Content-Type": "application/json", access_token: apiKey, ...init.headers },
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new AsaasError("O Asaas não respondeu a tempo.");
  }
  const raw = await response.text();
  let payload: unknown = {};
  try { payload = raw ? JSON.parse(raw) : {}; } catch { throw new AsaasError("O Asaas retornou uma resposta inválida."); }
  if (!response.ok) throw new AsaasError("O Asaas recusou a operação.", response.status, providerError(payload) ?? undefined);
  return payload;
}

function digits(value: string) { return value.replace(/\D/g, ""); }

function dateInMaceio(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Maceio", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export async function ensureAsaasCustomer(input: { clientId: string; name: string; email?: string | null; document?: string | null; phone?: string | null }) {
  const client = await prisma.client.findUniqueOrThrow({ where: { id: input.clientId }, select: { asaasCustomerId: true } });
  if (client.asaasCustomerId) return { id: client.asaasCustomerId };
  const payload = await asaasRequest("/customers", {
    method: "POST",
    body: JSON.stringify({ name: input.name, email: input.email ?? undefined, cpfCnpj: input.document ? digits(input.document) : undefined, mobilePhone: input.phone ? digits(input.phone) : undefined, externalReference: input.clientId }),
  });
  const id = isObject(payload) ? stringValue(payload.id) : null;
  if (!id) throw new AsaasError("O Asaas não retornou o identificador do cliente.");
  await prisma.client.update({ where: { id: input.clientId }, data: { asaasCustomerId: id } });
  return { id };
}

export async function createAsaasCharge(input: { customerId: string; amountCents: number; description: string; dueDate: Date; billingType: AsaasBillingType; externalReference: string }) {
  const payload = await asaasRequest("/payments", {
    method: "POST",
    body: JSON.stringify({ customer: input.customerId, billingType: input.billingType, value: input.amountCents / 100, dueDate: dateInMaceio(input.dueDate), description: input.description.slice(0, 500), externalReference: input.externalReference }),
  });
  const id = isObject(payload) ? stringValue(payload.id) : null;
  if (!id) throw new AsaasError("O Asaas não retornou a cobrança.");
  return { id, status: isObject(payload) ? stringValue(payload.status) ?? "PENDING" : "PENDING", invoiceUrl: isObject(payload) ? stringValue(payload.invoiceUrl) : null };
}
