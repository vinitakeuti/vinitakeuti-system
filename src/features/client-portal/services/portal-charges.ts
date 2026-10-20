import { FinancialEntryStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recalculateFinancialEntry } from "@/features/finance/services/finance-ledger";
import { sendOwnerEmail } from "@/features/notifications/services/owner-email";
import { logEvent } from "@/features/system-logs/services/system-log";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** "2026-10-20" do Asaas vira meio-dia no fuso da operação; sem data, agora. */
function paymentDate(value: string | null | undefined) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00.000-03:00`) : new Date();
}

/**
 * Cobrança do portal paga no Asaas: registra o recebimento no lançamento do Financeiro (uma única vez por cobrança,
 * mesmo com PAYMENT_CONFIRMED e PAYMENT_RECEIVED chegando para o mesmo pagamento) e avisa você por e-mail.
 */
export async function settlePortalCharge(asaasPaymentId: string, { valueCents, paidOn }: { valueCents?: number | null; paidOn?: string | null } = {}) {
  const charge = await prisma.charge.findUnique({ where: { asaasPaymentId }, select: { id: true, financialEntryId: true, installmentNumber: true, amountCents: true, description: true, client: { select: { name: true } } } });
  if (!charge?.financialEntryId) return false;
  const entryId = charge.financialEntryId;
  const amountCents = valueCents && valueCents > 0 ? valueCents : charge.amountCents;
  let registered = false;
  try {
    registered = await prisma.$transaction(async (tx) => {
      const existing = await tx.financialPayment.findUnique({ where: { chargeId: charge.id }, select: { id: true } });
      if (existing) return false;
      const entry = await tx.financialEntry.findUnique({ where: { id: entryId }, select: { status: true } });
      if (!entry || entry.status === FinancialEntryStatus.CANCELLED) return false;
      await tx.financialPayment.create({ data: { entryId, amountCents, paidAt: paymentDate(paidOn), notes: "Pago pelo portal do cliente (Asaas).", chargeId: charge.id } });
      await recalculateFinancialEntry(tx, entryId, { syncSale: true });
      return true;
    });
  } catch (error) {
    // Dois avisos do mesmo pagamento ao mesmo tempo: o segundo esbarra na cobrança única e é ignorado.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return false;
    throw error;
  }
  if (!registered) return false;
  await logEvent({ source: "clientes", event: "portal.payment.received", message: `Pagamento online de ${charge.client.name}: ${money.format(amountCents / 100)}.`, metadata: { chargeId: charge.id, entryId } });
  await sendOwnerEmail({ kind: "portal", footer: "Portal do cliente", subject: `Pagamento recebido: ${charge.client.name} · ${money.format(amountCents / 100)}`, title: "Pagamento recebido pelo portal.", lines: [`Cliente: ${charge.client.name}`, `Valor: ${money.format(amountCents / 100)}`, charge.description, "O recebimento já foi registrado no Financeiro."], path: `/financeiro/lancamentos/${entryId}` });
  return true;
}

/** Cobrança estornada ou removida no Asaas: o recebimento registrado por ela sai do Financeiro. */
export async function reversePortalCharge(asaasPaymentId: string) {
  const charge = await prisma.charge.findUnique({ where: { asaasPaymentId }, select: { id: true, financialEntryId: true } });
  if (!charge?.financialEntryId) return false;
  const entryId = charge.financialEntryId;
  const removed = await prisma.$transaction(async (tx) => {
    const { count } = await tx.financialPayment.deleteMany({ where: { chargeId: charge.id } });
    if (count) await recalculateFinancialEntry(tx, entryId, { syncSale: true });
    return count > 0;
  });
  if (removed) await logEvent({ source: "clientes", level: "warning", event: "portal.payment.reversed", message: "Pagamento online estornado ou removido no Asaas; o recebimento saiu do Financeiro.", metadata: { chargeId: charge.id, entryId } });
  return removed;
}
