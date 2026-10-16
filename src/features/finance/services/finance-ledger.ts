import { FinancialEntryStatus, Prisma, SaleStatus } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export const MAX_FINANCIAL_PAYMENTS = 200;

/**
 * Recalcula o que já foi recebido ou pago num lançamento e o status que decorre disso: realizado quando a soma
 * alcança o valor esperado, previsto enquanto falta algo. Lançamentos cancelados continuam cancelados.
 * Com `syncSale`, a venda de origem acompanha: fica paga quando o lançamento é quitado e volta a confirmada quando não.
 */
export async function recalculateFinancialEntry(tx: Tx, entryId: string, { syncSale = false } = {}) {
  const entry = await tx.financialEntry.findUnique({ where: { id: entryId }, select: { id: true, status: true, amountCents: true, sourceKey: true } });
  if (!entry) return null;
  const [sum, last] = await Promise.all([
    tx.financialPayment.aggregate({ where: { entryId }, _sum: { amountCents: true } }),
    tx.financialPayment.findFirst({ where: { entryId }, orderBy: [{ paidAt: "desc" }, { id: "desc" }], select: { paidAt: true } }),
  ]);
  const paidCents = sum._sum.amountCents ?? 0;
  const settled = entry.amountCents > 0 && paidCents >= entry.amountCents;
  const status = entry.status === FinancialEntryStatus.CANCELLED ? FinancialEntryStatus.CANCELLED : settled ? FinancialEntryStatus.SETTLED : FinancialEntryStatus.PENDING;
  const settledAt = status === FinancialEntryStatus.SETTLED ? last?.paidAt ?? new Date() : null;
  await tx.financialEntry.update({ where: { id: entryId }, data: { paidCents, status, settledAt } });

  const quoteId = entry.sourceKey?.startsWith("quote:") ? entry.sourceKey.slice("quote:".length) : null;
  if (syncSale && quoteId && status !== FinancialEntryStatus.CANCELLED) {
    const sale = await tx.sale.findUnique({ where: { quoteId }, select: { id: true, status: true } });
    if (sale && status === FinancialEntryStatus.SETTLED && sale.status === SaleStatus.CONFIRMED) await tx.sale.update({ where: { id: sale.id }, data: { status: SaleStatus.PAID, paidAt: settledAt } });
    if (sale && status === FinancialEntryStatus.PENDING && sale.status === SaleStatus.PAID) await tx.sale.update({ where: { id: sale.id }, data: { status: SaleStatus.CONFIRMED, paidAt: null } });
  }
  return { paidCents, status, quoteId };
}
