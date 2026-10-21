import { ChargeStatus, FinancialEntryStatus, FinancialEntryType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AsaasError, createAsaasCharge, deleteAsaasPayment, ensureAsaasCustomer } from "@/lib/integrations/asaas";
import { entrySchedule, portalEntrySelect, portalTodayStart, type PortalInstallment } from "@/features/client-portal/queries/portal-queries";
import { logEvent } from "@/features/system-logs/services/system-log";

/**
 * Cobranças das parcelas no Asaas. As parcelas são quitadas em ordem, então só a próxima parcela em aberto de cada
 * venda é cobrada. A confirmação é sempre automática (webhook ou sincronização); ninguém marca a parcela como paga
 * pelo portal. Cobranças que deixam de valer (parcela quitada por fora, valor alterado, venda cancelada) são canceladas.
 */
const OPEN = [ChargeStatus.PENDING, ChargeStatus.OVERDUE];
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_CREATED_PER_RUN = 20;
const MAX_ENTRIES = 200;
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function installmentChargeLabel(installment: Pick<PortalInstallment, "number" | "total" | "entryDescription">) {
  return installment.number ? `Parcela ${installment.number} de ${installment.total} · ${installment.entryDescription}` : installment.entryDescription;
}

/** A próxima parcela em aberto: a única que pode ser cobrada. */
export function nextChargeableInstallment(schedule: PortalInstallment[]) {
  return schedule.find((installment) => installment.remaining > 0) ?? null;
}

async function cancelCharge(charge: { id: string; asaasPaymentId: string | null }, reason: string) {
  try {
    if (charge.asaasPaymentId) await deleteAsaasPayment(charge.asaasPaymentId);
  } catch (error) {
    // Cobrança já paga não pode ser removida: a sincronização registra o pagamento.
    await logEvent({ source: "sistema", level: "warning", event: "asaas.charge.cancel_failed", message: `Cobrança não cancelada no Asaas (${reason}): ${error instanceof AsaasError ? error.providerMessage ?? error.message : String(error)}`.slice(0, 500), metadata: { chargeId: charge.id } });
    return false;
  }
  await prisma.charge.update({ where: { id: charge.id }, data: { status: ChargeStatus.CANCELLED } });
  return true;
}

/**
 * Cobrança aberta da parcela (mesmo valor) ou uma nova. Cobranças anteriores da mesma parcela com outro valor são
 * canceladas para o cliente não pagar duas vezes. O cliente precisa de CPF ou CNPJ no cadastro.
 */
export async function ensureInstallmentCharge({ clientId, installment, origin, actorEmail }: { clientId: string; installment: PortalInstallment; origin: "portal" | "gestao" | "automatica"; actorEmail?: string | null }) {
  const number = installment.number ?? 0;
  const open = await prisma.charge.findMany({ where: { clientId, financialEntryId: installment.entryId, installmentNumber: number, status: { in: OPEN } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 10, select: { id: true, asaasPaymentId: true, amountCents: true, invoiceUrl: true } });
  const match = open.find((charge) => charge.amountCents === installment.remaining && charge.invoiceUrl);
  if (match) return { invoiceUrl: match.invoiceUrl!, created: false };
  for (const charge of open) await cancelCharge(charge, "valor da parcela mudou");

  const client = await prisma.client.findUniqueOrThrow({ where: { id: clientId }, select: { name: true, email: true, cpf: true, cnpj: true, phone: true } });
  const document = client.cnpj || client.cpf;
  if (!document) throw new AsaasError("Cliente sem CPF ou CNPJ no cadastro: o Asaas exige um deles para cobrar.", 422);
  const customer = await ensureAsaasCustomer({ clientId, name: client.name, email: client.email, document, phone: client.phone });
  const description = installmentChargeLabel(installment).slice(0, 300);
  // O Asaas não aceita vencimento no passado: parcela atrasada vence hoje.
  const today = portalTodayStart();
  const dueDate = installment.dueDate < today ? today : installment.dueDate;
  const charge = await prisma.charge.create({ data: { clientId, description, amountCents: installment.remaining, dueDate, status: ChargeStatus.DRAFT, paymentMethod: "UNDEFINED", financialEntryId: installment.entryId, installmentNumber: number }, select: { id: true } });
  const remote = await createAsaasCharge({ customerId: customer.id, amountCents: installment.remaining, description, dueDate, billingType: "UNDEFINED", externalReference: charge.id });
  await prisma.charge.update({ where: { id: charge.id }, data: { asaasPaymentId: remote.id, status: ChargeStatus.PENDING, invoiceUrl: remote.invoiceUrl } });
  await logEvent({ source: origin === "portal" ? "clientes" : origin === "gestao" ? "gestao" : "sistema", event: "asaas.charge.created", message: `Cobrança ${origin === "portal" ? "aberta pelo cliente no portal" : origin === "gestao" ? "gerada pela gestão" : "gerada automaticamente"}: ${client.name} · ${description} (${money.format(installment.remaining / 100)}).`, actorEmail: actorEmail ?? null, metadata: { chargeId: charge.id, entryId: installment.entryId, installment: number } });
  return { invoiceUrl: remote.invoiceUrl, created: true };
}

/** Vendas com parcelas a receber, com o cliente de cada uma (pela proposta de origem). */
async function receivableEntries() {
  const entries = await prisma.financialEntry.findMany({ where: { type: FinancialEntryType.INCOME, status: FinancialEntryStatus.PENDING, sourceKey: { startsWith: "quote:" } }, orderBy: [{ dueDate: "asc" }, { id: "asc" }], take: MAX_ENTRIES, select: portalEntrySelect });
  const quotes = await prisma.quote.findMany({ where: { id: { in: entries.map((entry) => entry.sourceKey!.slice("quote:".length)) } }, take: MAX_ENTRIES, select: { id: true, clientId: true } });
  const clientByQuote = new Map(quotes.map((quote) => [quote.id, quote.clientId]));
  const todayStart = portalTodayStart();
  return entries.flatMap((entry) => {
    const clientId = clientByQuote.get(entry.sourceKey!.slice("quote:".length));
    return clientId ? [{ id: entry.id, clientId, next: nextChargeableInstallment(entrySchedule(entry, todayStart)) }] : [];
  });
}

/**
 * Ciclo das cobranças (a cada 30 minutos): cancela as que deixaram de valer e, com a cobrança automática ligada,
 * gera a da próxima parcela de cada venda quando faltam `days` dias (ou menos) para o vencimento.
 */
export async function runInstallmentCharges(days: number | null, now = new Date()) {
  const entries = await receivableEntries();
  const byEntry = new Map(entries.map((entry) => [entry.id, entry]));
  let cancelled = 0;
  const openCharges = await prisma.charge.findMany({ where: { financialEntryId: { not: null }, status: { in: OPEN } }, take: 500, select: { id: true, asaasPaymentId: true, amountCents: true, financialEntryId: true, installmentNumber: true } });
  // Lançamentos fora do lote consultado: só são cancelados se a venda não estiver mais em aberto.
  const outside = [...new Set(openCharges.map((charge) => charge.financialEntryId!).filter((id) => !byEntry.has(id)))];
  const stillOpen = new Set((await prisma.financialEntry.findMany({ where: { id: { in: outside }, status: FinancialEntryStatus.PENDING }, take: 500, select: { id: true } })).map((entry) => entry.id));
  for (const charge of openCharges) {
    if (stillOpen.has(charge.financialEntryId!)) continue;
    const entry = byEntry.get(charge.financialEntryId!);
    const valid = entry?.next && (entry.next.number ?? 0) === charge.installmentNumber && entry.next.remaining === charge.amountCents;
    if (!valid && await cancelCharge(charge, entry ? "parcela quitada ou alterada" : "venda quitada ou cancelada")) cancelled += 1;
  }

  let created = 0;
  let missingDocument = 0;
  if (days !== null) {
    const limit = new Date(portalTodayStart(now).getTime() + (days + 1) * DAY_MS);
    const valid = new Set(openCharges.filter((charge) => byEntry.get(charge.financialEntryId!)?.next).map((charge) => `${charge.financialEntryId}:${charge.installmentNumber}:${charge.amountCents}`));
    for (const entry of entries) {
      if (created >= MAX_CREATED_PER_RUN) break;
      const next = entry.next;
      if (!next || next.dueDate >= limit || valid.has(`${entry.id}:${next.number ?? 0}:${next.remaining}`)) continue;
      try {
        if ((await ensureInstallmentCharge({ clientId: entry.clientId, installment: next, origin: "automatica" })).created) created += 1;
      } catch (error) {
        if (error instanceof AsaasError && error.status === 422) { missingDocument += 1; continue; }
        await logEvent({ source: "sistema", level: "error", event: "asaas.charge.auto_failed", message: `Falha ao gerar a cobrança automática: ${error instanceof AsaasError ? error.providerMessage ?? error.message : String(error)}`.slice(0, 500), metadata: { entryId: entry.id } });
      }
    }
  }
  return { created, cancelled, missingDocument };
}
