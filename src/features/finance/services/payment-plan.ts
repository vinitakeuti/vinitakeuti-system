import { FinancialEntryStatus, FinancialEntryType, Prisma } from "@prisma/client";
import { allocateInstallments, MAX_INSTALLMENTS } from "@/features/finance/services/installments";
import { addMonths, monthKeyOf, occurrenceDueDate, type MonthKey } from "@/features/finance/services/recurring-entries";

type Tx = Prisma.TransactionClient;

const isoDay = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Maceio" });

export type PlanParams = { count: number; monthlyCents: number | null; dayOfMonth: number; firstMonth: MonthKey };

/**
 * Valores das parcelas que faltam: com valor mensal, todas têm esse valor e a última fica com o resto;
 * sem ele (ou se não fechar), o que falta é dividido igualmente.
 */
export function openInstallmentAmounts(remainingCents: number, count: number, monthlyCents: number | null) {
  const total = Math.max(1, count);
  if (monthlyCents && monthlyCents > 0 && monthlyCents * (total - 1) < remainingCents) {
    return Array.from({ length: total }, (_, index) => index === total - 1 ? remainingCents - monthlyCents * (total - 1) : monthlyCents);
  }
  const base = Math.floor(remainingCents / total);
  return Array.from({ length: total }, (_, index) => index === total - 1 ? remainingCents - base * (total - 1) : base);
}

/** Parâmetros do plano atual (parcelas em aberto), para preencher o formulário e refazer o plano. */
export function currentPlanParams(entry: { amountCents: number; paidCents: number; dueDate: Date; installments: Array<{ number: number; dueDate: Date; amountCents: number }> }): PlanParams {
  const open = allocateInstallments(entry.installments, entry.paidCents).filter((installment) => installment.state !== "paid");
  const first = open[0];
  const reference = first?.dueDate ?? entry.dueDate;
  return { count: Math.max(1, open.length), monthlyCents: first?.amountCents ?? null, dayOfMonth: Number(isoDay.format(reference).slice(8, 10)), firstMonth: monthKeyOf(reference) };
}

/**
 * Refaz as parcelas: cada pagamento registrado vira uma parcela paga (na data em que entrou) e o que falta é
 * dividido em `count` parcelas mensais, no dia escolhido, a partir do primeiro mês.
 */
export async function rebuildInstallments(tx: Tx, entryId: string, params: PlanParams, totalCents?: number) {
  const entry = await tx.financialEntry.findUnique({ where: { id: entryId }, select: { amountCents: true, payments: { orderBy: [{ paidAt: "asc" }, { id: "asc" }], take: MAX_INSTALLMENTS, select: { amountCents: true, paidAt: true } } } });
  if (!entry) return;
  const total = totalCents ?? entry.amountCents;
  const paid = entry.payments.reduce((sum, payment) => sum + payment.amountCents, 0);
  const remaining = Math.max(0, total - paid);
  const rows = entry.payments.map((payment, index) => ({ entryId, number: index + 1, dueDate: payment.paidAt, amountCents: payment.amountCents }));
  if (remaining > 0) {
    openInstallmentAmounts(remaining, Math.min(params.count, MAX_INSTALLMENTS), params.monthlyCents).forEach((amountCents, index) => {
      rows.push({ entryId, number: rows.length + 1, dueDate: occurrenceDueDate(addMonths(params.firstMonth, index), params.dayOfMonth), amountCents });
    });
  }
  await tx.financialInstallment.deleteMany({ where: { entryId } });
  if (rows.length) await tx.financialInstallment.createMany({ data: rows });
  await tx.financialEntry.update({ where: { id: entryId }, data: { amountCents: total } });
}

/**
 * Leva os pagamentos registrados na proposta para a entrada da venda no Financeiro. Os que vieram da proposta
 * são substituídos pelos atuais; um pagamento lançado à mão com o mesmo valor e dia passa a contar como da proposta
 * (não é duplicado). Com parcelas, o plano é refeito mantendo as parcelas em aberto.
 */
export async function syncQuotePayments(tx: Tx, quoteId: string) {
  const entry = await tx.financialEntry.findUnique({ where: { sourceKey: `quote:${quoteId}` }, select: { id: true, type: true, status: true, amountCents: true, paidCents: true, dueDate: true, installments: { orderBy: { number: "asc" }, take: MAX_INSTALLMENTS, select: { number: true, dueDate: true, amountCents: true } } } });
  if (!entry || entry.type !== FinancialEntryType.INCOME || entry.status === FinancialEntryStatus.CANCELLED) return null;
  const params = entry.installments.length ? currentPlanParams(entry) : null;
  const [quotePayments, manual] = await Promise.all([
    tx.quotePayment.findMany({ where: { quoteId }, orderBy: [{ paidAt: "asc" }, { id: "asc" }], take: 50, select: { amountCents: true, paidAt: true } }),
    tx.financialPayment.findMany({ where: { entryId: entry.id, fromQuote: false, fromSale: false }, select: { id: true, amountCents: true, paidAt: true } }),
  ]);
  await tx.financialPayment.deleteMany({ where: { entryId: entry.id, fromQuote: true } });
  const matched = new Set<string>();
  for (const payment of quotePayments) {
    const twin = manual.find((item) => !matched.has(item.id) && item.amountCents === payment.amountCents && isoDay.format(item.paidAt) === isoDay.format(payment.paidAt));
    if (twin) {
      matched.add(twin.id);
      await tx.financialPayment.update({ where: { id: twin.id }, data: { fromQuote: true } });
    } else {
      await tx.financialPayment.create({ data: { entryId: entry.id, amountCents: payment.amountCents, paidAt: payment.paidAt, notes: "Registrado na proposta.", fromQuote: true } });
    }
  }
  // A soma recebida não pode passar do valor combinado.
  const paid = await tx.financialPayment.aggregate({ where: { entryId: entry.id }, _sum: { amountCents: true } });
  const total = Math.max(entry.amountCents, paid._sum.amountCents ?? 0);
  if (params) await rebuildInstallments(tx, entry.id, params, total);
  else if (total !== entry.amountCents) await tx.financialEntry.update({ where: { id: entry.id }, data: { amountCents: total } });
  return entry.id;
}
