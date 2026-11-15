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

/**
 * Parâmetros do plano atual (parcelas em aberto), para preencher o formulário e refazer o plano.
 * O valor de referência é o de uma parcela inteira em aberto (a primeira pode estar paga em parte e a última costuma
 * ser o resto). A quantidade é a que cobre o que falta nesse valor: quando um pagamento não bate com o valor da
 * parcela, sobram linhas a mais no cronograma (uma paga em parte, a última menor) e contá-las daria parcelas além do
 * que falta receber.
 */
export function currentPlanParams(entry: { amountCents: number; paidCents: number; dueDate: Date; installments: Array<{ number: number; dueDate: Date; amountCents: number }> }): PlanParams {
  const open = allocateInstallments(entry.installments, entry.paidCents).filter((installment) => installment.state !== "paid");
  const first = open[0];
  const last = open.at(-1);
  const typical = open.find((installment) => installment.state === "open" && installment !== last) ?? first;
  const monthlyCents = typical?.amountCents ?? null;
  const remaining = Math.max(0, entry.amountCents - entry.paidCents);
  // As linhas em aberto valem enquanto fecham com o que falta (a última fica com o resto); senão, quantas parcelas desse valor cobrem o que falta.
  const fits = monthlyCents ? monthlyCents * (open.length - 1) < remaining : true;
  const count = fits ? Math.max(1, open.length) : Math.min(MAX_INSTALLMENTS, Math.max(1, Math.ceil(remaining / monthlyCents!)));
  const reference = first?.dueDate ?? entry.dueDate;
  return { count, monthlyCents, dayOfMonth: Number(isoDay.format(reference).slice(8, 10)), firstMonth: monthKeyOf(reference) };
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
  const paidCents = paid._sum.amountCents ?? 0;
  const total = Math.max(entry.amountCents, paidCents);
  // O plano é lido depois dos pagamentos: as parcelas que eles quitaram saem da conta, a próxima data avança e o resto
  // segue no mesmo valor e dia (lido antes, a quantidade não diminuía e o valor de cada parcela encolhia).
  if (entry.installments.length) await rebuildInstallments(tx, entry.id, currentPlanParams({ amountCents: total, paidCents, dueDate: entry.dueDate, installments: entry.installments }), total);
  else if (total !== entry.amountCents) await tx.financialEntry.update({ where: { id: entry.id }, data: { amountCents: total } });
  return entry.id;
}
