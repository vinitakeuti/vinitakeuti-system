import { prisma } from "@/lib/prisma";
import { getAsaasBalance } from "@/lib/integrations/asaas";

const PAGE_SIZE = 25;

/** Situação da integração com o Asaas, sem a chave nem o hash do token. */
export async function getAsaasIntegration() {
  return prisma.paymentIntegration.findUnique({
    where: { provider: "ASAAS" },
    select: { isActive: true, environment: true, keyHint: true, webhookId: true, webhookUrl: true, webhookStatus: true, webhookPenalized: true, accountName: true, accountEmail: true, accountDocument: true, accountStatus: true, lastCheckedAt: true, lastError: true, lastSyncAt: true, autoChargeDays: true, updatedAt: true },
  });
}

/** Saldo da conta, consultado na hora; null se o Asaas não responder. */
export async function getAsaasBalanceSafe() {
  try { return await getAsaasBalance(); } catch { return null; }
}

/** Eventos recebidos pelo webhook, mais recentes primeiro, com a cobrança local (se houver). */
export async function listAsaasEvents(cursor?: string) {
  const rows = await prisma.gatewayEvent.findMany({
    where: { provider: "ASAAS" },
    orderBy: [{ receivedAt: "desc" }, { id: "desc" }],
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor.slice(0, 40) }, skip: 1 } : {}),
    select: { id: true, eventName: true, providerPaymentId: true, amountCents: true, receivedAt: true, processedAt: true, attempts: true, error: true },
  });
  const data = rows.slice(0, PAGE_SIZE);
  const charges = await prisma.charge.findMany({ where: { asaasPaymentId: { in: data.map((row) => row.providerPaymentId).filter((id): id is string => Boolean(id)) } }, take: PAGE_SIZE, select: { asaasPaymentId: true, description: true, client: { select: { name: true } } } });
  const byPayment = new Map(charges.map((charge) => [charge.asaasPaymentId, charge]));
  return { data: data.map((row) => ({ ...row, charge: row.providerPaymentId ? byPayment.get(row.providerPaymentId) ?? null : null })), nextCursor: rows.length > PAGE_SIZE ? data.at(-1)!.id : null };
}

/** Cobranças online em aberto (aguardando pagamento no Asaas). */
export async function countOpenAsaasCharges() {
  return prisma.charge.count({ where: { asaasPaymentId: { not: null }, status: { in: ["PENDING", "OVERDUE"] } } });
}

/**
 * Cobrança automática de um lançamento do Financeiro: se o Asaas está conectado, se o lançamento é de um cliente
 * (venda de uma proposta), as cobranças abertas por parcela e se falta CPF/CNPJ no cadastro do cliente.
 */
export async function getEntryAsaasState(entry: { id: string; sourceKey: string | null }) {
  const quoteId = entry.sourceKey?.startsWith("quote:") ? entry.sourceKey.slice("quote:".length) : null;
  const [integration, charges, quote] = await Promise.all([
    prisma.paymentIntegration.findUnique({ where: { provider: "ASAAS" }, select: { isActive: true, keyHint: true, autoChargeDays: true } }),
    prisma.charge.findMany({ where: { financialEntryId: entry.id, status: { in: ["PENDING", "OVERDUE"] } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 20, select: { installmentNumber: true, amountCents: true, invoiceUrl: true, createdAt: true } }),
    quoteId ? prisma.quote.findUnique({ where: { id: quoteId }, select: { client: { select: { id: true, cpf: true, cnpj: true } } } }) : null,
  ]);
  const online = Boolean(integration?.isActive && integration.keyHint);
  return {
    automated: online && Boolean(quote?.client),
    autoChargeDays: integration?.autoChargeDays ?? null,
    clientId: quote?.client.id ?? null,
    missingDocument: Boolean(quote?.client && !quote.client.cpf && !quote.client.cnpj),
    openCharges: new Map(charges.map((charge) => [charge.installmentNumber ?? 0, charge])),
  };
}
