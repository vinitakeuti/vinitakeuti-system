/**
 * Cliente da API do Asaas (v3): conta, webhooks, clientes e cobranças. A chave e o ambiente vêm só do cadastro em
 * Integrações (PaymentIntegration), nunca de variáveis de ambiente. Documentação: https://docs.asaas.com/reference
 */
import { decryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";

type JsonObject = Record<string, unknown>;
export type AsaasBillingType = "PIX" | "CREDIT_CARD" | "BOLETO" | "UNDEFINED";
export type AsaasEnvironment = "sandbox" | "production";
export type AsaasCredentials = { apiKey: string; environment: AsaasEnvironment };

const REQUEST_TIMEOUT_MS = 8_000;
/** Obrigatório para contas criadas a partir de 13/06/2024. */
const USER_AGENT = "VR-Gestao/1.0";

/** Eventos de cobrança que o webhook do VR Gestão recebe. */
export const ASAAS_WEBHOOK_EVENTS = [
  "PAYMENT_CONFIRMED", "PAYMENT_RECEIVED", "PAYMENT_OVERDUE", "PAYMENT_UPDATED", "PAYMENT_DELETED", "PAYMENT_RESTORED",
  "PAYMENT_REFUNDED", "PAYMENT_PARTIALLY_REFUNDED", "PAYMENT_REFUND_IN_PROGRESS", "PAYMENT_RECEIVED_IN_CASH_UNDONE", "PAYMENT_CHARGEBACK_REQUESTED",
] as const;

export class AsaasError extends Error {
  constructor(message: string, public readonly status = 502, public readonly providerMessage?: string, public readonly providerCode?: string) {
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
  return error ? { code: stringValue(error.code), description: stringValue(error.description) } : null;
}

function apiBase(environment: AsaasEnvironment) {
  return environment === "production" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3";
}

/** O prefixo da chave diz o ambiente: $aact_prod_ (produção) ou $aact_hmlg_ (sandbox). */
export function environmentFromKey(apiKey: string): AsaasEnvironment | null {
  if (apiKey.startsWith("$aact_prod_")) return "production";
  if (apiKey.startsWith("$aact_hmlg_")) return "sandbox";
  return null;
}

async function storedCredentials(): Promise<AsaasCredentials> {
  const integration = await prisma.paymentIntegration.findUnique({ where: { provider: "ASAAS" }, select: { isActive: true, apiKeyEncrypted: true, environment: true } });
  if (!integration?.isActive || !integration.apiKeyEncrypted) throw new AsaasError("Asaas não conectado. Configure em Integrações.", 503);
  const environment = integration.environment === "production" ? "production" : "sandbox";
  return { apiKey: decryptSecret(integration.apiKeyEncrypted), environment };
}

/** Se o Asaas está conectado em Integrações, sem consultar o Asaas. */
export async function isAsaasConfigured() {
  const integration = await prisma.paymentIntegration.findUnique({ where: { provider: "ASAAS" }, select: { isActive: true, apiKeyEncrypted: true } });
  return Boolean(integration?.isActive && integration.apiKeyEncrypted);
}

async function asaasRequest(path: string, init: RequestInit = {}, credentials?: AsaasCredentials) {
  const { apiKey, environment } = credentials ?? await storedCredentials();
  let response: Response;
  try {
    response = await fetch(`${apiBase(environment)}${path}`, {
      ...init,
      headers: { Accept: "application/json", "User-Agent": USER_AGENT, access_token: apiKey, ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers },
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new AsaasError("O Asaas não respondeu a tempo.");
  }
  const raw = await response.text();
  let payload: unknown = {};
  try { payload = raw ? JSON.parse(raw) : {}; } catch { throw new AsaasError("O Asaas retornou uma resposta inválida.", response.status); }
  if (!response.ok) {
    const detail = providerError(payload);
    const message = response.status === 401 ? "Chave de API recusada pelo Asaas." : response.status === 404 ? "Registro não encontrado no Asaas." : "O Asaas recusou a operação.";
    throw new AsaasError(message, response.status, detail?.description ?? undefined, detail?.code ?? undefined);
  }
  return payload;
}

function digits(value: string) { return value.replace(/\D/g, ""); }

function dateInMaceio(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Maceio", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** Dados comerciais da conta: confirma que a chave funciona e identifica a conta conectada. */
export async function getAsaasAccount(credentials?: AsaasCredentials) {
  const payload = await asaasRequest("/myAccount/commercialInfo/", {}, credentials);
  if (!isObject(payload)) throw new AsaasError("O Asaas não retornou os dados da conta.");
  return { name: stringValue(payload.companyName) ?? stringValue(payload.name), email: stringValue(payload.email), document: stringValue(payload.cpfCnpj), status: stringValue(payload.status) };
}

export async function getAsaasBalance() {
  const payload = await asaasRequest("/finance/balance");
  return isObject(payload) && typeof payload.balance === "number" ? Math.round(payload.balance * 100) : null;
}

export type AsaasWebhook = { id: string; enabled: boolean; interrupted: boolean; penalized: number; url: string | null };

function parseWebhook(payload: unknown): AsaasWebhook {
  const id = isObject(payload) ? stringValue(payload.id) : null;
  if (!id || !isObject(payload)) throw new AsaasError("O Asaas não retornou o webhook.");
  return { id, enabled: payload.enabled === true, interrupted: payload.interrupted === true, penalized: typeof payload.penalizedRequestsCount === "number" ? payload.penalizedRequestsCount : 0, url: stringValue(payload.url) };
}

export async function createAsaasWebhook(input: { url: string; email: string; authToken: string }, credentials?: AsaasCredentials) {
  const payload = await asaasRequest("/webhooks", {
    method: "POST",
    body: JSON.stringify({ name: "VR Gestão", url: input.url, email: input.email, enabled: true, interrupted: false, apiVersion: 3, authToken: input.authToken, sendType: "SEQUENTIALLY", events: ASAAS_WEBHOOK_EVENTS }),
  }, credentials);
  return parseWebhook(payload);
}

/** Atualiza o webhook; `interrupted: false` reativa a fila e reenvia os eventos pendentes. */
export async function updateAsaasWebhook(id: string, patch: { url?: string; email?: string; enabled?: boolean; interrupted?: boolean; authToken?: string }, credentials?: AsaasCredentials) {
  const payload = await asaasRequest(`/webhooks/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify({ ...patch, events: ASAAS_WEBHOOK_EVENTS, sendType: "SEQUENTIALLY" }) }, credentials);
  return parseWebhook(payload);
}

/** O webhook, ou null se foi removido no painel do Asaas. */
export async function getAsaasWebhook(id: string) {
  try {
    return parseWebhook(await asaasRequest(`/webhooks/${encodeURIComponent(id)}`));
  } catch (error) {
    if (error instanceof AsaasError && error.status === 404) return null;
    throw error;
  }
}

export async function deleteAsaasWebhook(id: string, credentials?: AsaasCredentials) {
  await asaasRequest(`/webhooks/${encodeURIComponent(id)}`, { method: "DELETE" }, credentials);
}

/** Remove a penalização da fila (envios atrasados por falhas anteriores). */
export async function removeAsaasWebhookBackoff(id: string) {
  await asaasRequest(`/webhooks/${encodeURIComponent(id)}/removeBackoff`, { method: "POST", body: "{}" });
}

export type AsaasPayment = { id: string; status: string | null; value: number | null; deleted: boolean; dueDate: string | null; paymentDate: string | null; clientPaymentDate: string | null; confirmedDate: string | null };

/** Campos da cobrança usados pelo VR Gestão (do webhook ou da consulta à API). */
export function parseAsaasPayment(payload: unknown): AsaasPayment | null {
  const id = isObject(payload) ? stringValue(payload.id) : null;
  if (!id || !isObject(payload)) return null;
  return { id, status: stringValue(payload.status), value: typeof payload.value === "number" ? payload.value : null, deleted: payload.deleted === true, dueDate: stringValue(payload.dueDate), paymentDate: stringValue(payload.paymentDate), clientPaymentDate: stringValue(payload.clientPaymentDate), confirmedDate: stringValue(payload.confirmedDate) };
}

export async function getAsaasPayment(id: string) {
  return parseAsaasPayment(await asaasRequest(`/payments/${encodeURIComponent(id)}`));
}

/** Cancela (remove) uma cobrança ainda não paga; 404 conta como já removida. */
export async function deleteAsaasPayment(id: string) {
  try { await asaasRequest(`/payments/${encodeURIComponent(id)}`, { method: "DELETE" }); }
  catch (error) { if (!(error instanceof AsaasError && error.status === 404)) throw error; }
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
