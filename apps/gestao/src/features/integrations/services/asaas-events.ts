import { ChargeStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AsaasError, getAsaasPayment, parseAsaasPayment, type AsaasPayment } from "@/lib/integrations/asaas";
import { reversePortalCharge, settlePortalCharge } from "@/features/client-portal/services/portal-charges";
import { sendOwnerEmail } from "@/features/notifications/services/owner-email";
import { logEvent } from "@/features/system-logs/services/system-log";

/**
 * Eventos de cobrança do Asaas. O webhook só grava o evento e responde; o processamento roda logo depois (e o
 * agendador tenta de novo os que falharem, até 5 vezes). A sincronização periódica aplica a mesma regra a partir do
 * status consultado na API, para cobrir eventos perdidos.
 */
const MAX_ATTEMPTS = 5;
const RETRY_AFTER_MS = 2 * 60 * 1000;
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const PAID = new Set(["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"]);
const REVERSED = new Set(["PAYMENT_DELETED", "PAYMENT_REFUNDED", "PAYMENT_REFUND_IN_PROGRESS", "PAYMENT_RECEIVED_IN_CASH_UNDONE", "PAYMENT_CHARGEBACK_REQUESTED"]);

export const asaasEventLabel: Record<string, string> = {
  PAYMENT_CONFIRMED: "Pagamento confirmado",
  PAYMENT_RECEIVED: "Pagamento recebido",
  PAYMENT_OVERDUE: "Cobrança vencida",
  PAYMENT_UPDATED: "Cobrança alterada",
  PAYMENT_DELETED: "Cobrança removida",
  PAYMENT_RESTORED: "Cobrança restaurada",
  PAYMENT_REFUNDED: "Estornada",
  PAYMENT_PARTIALLY_REFUNDED: "Estornada em parte",
  PAYMENT_REFUND_IN_PROGRESS: "Estorno em andamento",
  PAYMENT_RECEIVED_IN_CASH_UNDONE: "Recebimento em dinheiro desfeito",
  PAYMENT_CHARGEBACK_REQUESTED: "Chargeback solicitado",
};

/** "2026-10-20" vira meio-dia no fuso da operação. */
function asaasDate(value: string | null) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00.000-03:00`) : null;
}

/** Aplica um evento de cobrança: status da cobrança local e, se ela veio do portal, o recebimento no Financeiro. */
export async function applyAsaasPaymentEvent(eventName: string, payment: AsaasPayment) {
  const charge = await prisma.charge.findUnique({ where: { asaasPaymentId: payment.id }, select: { id: true, status: true, description: true, client: { select: { name: true } } } });
  // Cobranças criadas fora do VR Gestão ficam só registradas nos eventos.
  if (!charge) return "sem cobrança no VR Gestão";
  const paidOn = payment.clientPaymentDate ?? payment.paymentDate ?? payment.confirmedDate;
  const valueCents = payment.value !== null ? Math.round(payment.value * 100) : null;

  if (PAID.has(eventName)) {
    await prisma.charge.update({ where: { id: charge.id }, data: { status: ChargeStatus.PAID, paidAt: asaasDate(paidOn) ?? new Date() } });
    await settlePortalCharge(payment.id, { valueCents, paidOn });
    return "pagamento registrado";
  }
  if (REVERSED.has(eventName)) {
    const status = eventName === "PAYMENT_DELETED" ? ChargeStatus.CANCELLED : eventName === "PAYMENT_RECEIVED_IN_CASH_UNDONE" ? ChargeStatus.PENDING : ChargeStatus.REFUNDED;
    await prisma.charge.update({ where: { id: charge.id }, data: { status, paidAt: null } });
    const reversed = await reversePortalCharge(payment.id);
    if (eventName === "PAYMENT_CHARGEBACK_REQUESTED") await sendOwnerEmail({ kind: "payments", footer: "Pagamentos", critical: true, subject: `Chargeback solicitado: ${charge.client.name}`, title: "O cliente contestou um pagamento no cartão.", lines: [`Cliente: ${charge.client.name}`, charge.description, valueCents !== null ? `Valor: ${money.format(valueCents / 100)}` : "", reversed ? "O recebimento saiu do Financeiro até a disputa ser resolvida." : "", "Envie a contestação pelo painel do Asaas."].filter(Boolean), path: "/integracoes" });
    return reversed ? "recebimento desfeito" : "status atualizado";
  }
  if (eventName === "PAYMENT_OVERDUE" && charge.status !== ChargeStatus.PAID) {
    await prisma.charge.update({ where: { id: charge.id }, data: { status: ChargeStatus.OVERDUE } });
    return "cobrança vencida";
  }
  if (eventName === "PAYMENT_RESTORED" && charge.status !== ChargeStatus.PAID) {
    await prisma.charge.update({ where: { id: charge.id }, data: { status: ChargeStatus.PENDING } });
    return "cobrança restaurada";
  }
  if (eventName === "PAYMENT_UPDATED" && charge.status !== ChargeStatus.PAID) {
    const dueDate = asaasDate(payment.dueDate);
    await prisma.charge.update({ where: { id: charge.id }, data: { ...(valueCents !== null ? { amountCents: valueCents } : {}), ...(dueDate ? { dueDate } : {}) } });
    return "valor ou vencimento atualizado";
  }
  if (eventName === "PAYMENT_PARTIALLY_REFUNDED") {
    await sendOwnerEmail({ kind: "payments", footer: "Pagamentos", subject: `Estorno parcial: ${charge.client.name}`, title: "Uma cobrança foi estornada em parte.", lines: [`Cliente: ${charge.client.name}`, charge.description, "Ajuste o valor recebido no lançamento do Financeiro."], path: "/integracoes" });
    return "estorno parcial avisado";
  }
  return "sem alteração";
}

/** Grava o evento recebido (uma vez por id do Asaas). Devolve null quando ele já foi processado antes. */
export async function recordAsaasEvent(body: { id: string; event: string; payment?: unknown }) {
  const payment = parseAsaasPayment(body.payment);
  const event = await prisma.gatewayEvent.upsert({
    where: { eventKey: `asaas:${body.id.slice(0, 120)}` },
    update: {},
    create: { provider: "ASAAS", eventKey: `asaas:${body.id.slice(0, 120)}`, eventName: body.event.slice(0, 80), providerPaymentId: payment?.id ?? null, amountCents: payment?.value != null ? Math.round(payment.value * 100) : null, payload: payment ? (payment as unknown as Prisma.InputJsonValue) : Prisma.JsonNull },
    select: { id: true, processedAt: true },
  });
  return event.processedAt ? null : event.id;
}

/** Processa um evento gravado. Eventos mais antigos que um já processado da mesma cobrança são descartados. */
export async function processAsaasEvent(eventId: string) {
  const claimed = await prisma.gatewayEvent.updateMany({ where: { id: eventId, processedAt: null, attempts: { lt: MAX_ATTEMPTS } }, data: { attempts: { increment: 1 } } });
  if (!claimed.count) return;
  const event = await prisma.gatewayEvent.findUnique({ where: { id: eventId }, select: { eventName: true, providerPaymentId: true, payload: true, receivedAt: true } });
  if (!event) return;
  try {
    const payment = parseAsaasPayment(event.payload);
    let result = "sem cobrança";
    if (payment) {
      const newer = await prisma.gatewayEvent.count({ where: { provider: "ASAAS", providerPaymentId: payment.id, processedAt: { not: null }, receivedAt: { gt: event.receivedAt } } });
      result = newer ? "ignorado: já há evento mais recente" : await applyAsaasPaymentEvent(event.eventName, payment);
    }
    await prisma.gatewayEvent.update({ where: { id: eventId }, data: { processedAt: new Date(), error: null } });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.gatewayEvent.update({ where: { id: eventId }, data: { error: message.slice(0, 500) } });
    await logEvent({ source: "sistema", level: "error", event: "asaas.event.failed", message: `Falha ao processar ${event.eventName} do Asaas: ${message}`.slice(0, 500), metadata: { paymentId: event.providerPaymentId } });
  }
}

/** Eventos que falharam ou ficaram sem processar (o servidor reiniciou, por exemplo). */
export async function retryPendingAsaasEvents(now = new Date(), limit = 20) {
  const pending = await prisma.gatewayEvent.findMany({ where: { provider: "ASAAS", processedAt: null, attempts: { lt: MAX_ATTEMPTS }, receivedAt: { lt: new Date(now.getTime() - RETRY_AFTER_MS) } }, orderBy: [{ receivedAt: "asc" }, { id: "asc" }], take: limit, select: { id: true } });
  for (const event of pending) await processAsaasEvent(event.id);
  return pending.length;
}

/** Status da API equivalente a um evento, para a sincronização. */
function eventForStatus(payment: AsaasPayment) {
  if (payment.deleted) return "PAYMENT_DELETED";
  switch (payment.status) {
    case "RECEIVED": case "CONFIRMED": case "RECEIVED_IN_CASH": case "DUNNING_RECEIVED": return "PAYMENT_RECEIVED";
    case "OVERDUE": return "PAYMENT_OVERDUE";
    case "REFUNDED": return "PAYMENT_REFUNDED";
    case "CHARGEBACK_REQUESTED": return "PAYMENT_CHARGEBACK_REQUESTED";
    default: return null;
  }
}

/** Confere no Asaas as cobranças em aberto (as mais antigas sem conferência primeiro) e aplica o que mudou. */
export async function syncOpenAsaasCharges(limit = 20) {
  const charges = await prisma.charge.findMany({ where: { asaasPaymentId: { not: null }, status: { in: [ChargeStatus.PENDING, ChargeStatus.OVERDUE] } }, orderBy: [{ updatedAt: "asc" }, { id: "asc" }], take: limit, select: { id: true, status: true, asaasPaymentId: true } });
  let changed = 0;
  for (const charge of charges) {
    try {
      const payment = await getAsaasPayment(charge.asaasPaymentId!);
      const eventName = payment ? eventForStatus(payment) : null;
      if (payment && eventName && !(eventName === "PAYMENT_OVERDUE" && charge.status === ChargeStatus.OVERDUE)) {
        await applyAsaasPaymentEvent(eventName, payment);
        changed += 1;
      } else {
        await prisma.charge.update({ where: { id: charge.id }, data: { updatedAt: new Date() } });
      }
    } catch (error) {
      // Cobrança que não existe nesta conta (de outra conta ou ambiente) sai da fila de conferência.
      if (error instanceof AsaasError && error.status === 404) await prisma.charge.update({ where: { id: charge.id }, data: { status: ChargeStatus.CANCELLED } });
      else throw error;
    }
  }
  return { checked: charges.length, changed };
}
