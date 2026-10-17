import { addMonths, occurrenceDueDate } from "@/features/finance/services/recurring-entries";

export const MAX_INSTALLMENTS = 60;

type Installment = { id?: string; number: number; dueDate: Date; amountCents: number };
export type InstallmentState = "paid" | "partial" | "open";

/** Os recebimentos quitam as parcelas em ordem: a primeira parcela primeiro. */
export function allocateInstallments<T extends Installment>(installments: T[], paidCents: number) {
  let pool = paidCents;
  return [...installments].sort((left, right) => left.number - right.number).map((installment) => {
    const paid = Math.max(0, Math.min(installment.amountCents, pool));
    pool -= paid;
    const state: InstallmentState = paid >= installment.amountCents ? "paid" : paid > 0 ? "partial" : "open";
    return { ...installment, paid, remaining: installment.amountCents - paid, state };
  });
}

/** Próxima parcela com valor em aberto (ou a última, quando todas estão pagas). */
export function nextOpenInstallment<T extends Installment>(installments: T[], paidCents: number) {
  const allocated = allocateInstallments(installments, paidCents);
  return allocated.find((installment) => installment.remaining > 0) ?? allocated.at(-1) ?? null;
}

/**
 * Parcelas para o que falta receber: `count` parcelas mensais a partir da primeira data, com o valor dividido
 * igualmente (os centavos que sobram vão para a última). O que já foi recebido vira a parcela de entrada.
 */
export function buildInstallmentPlan({ amountCents, paidCents, firstPaidAt, count, firstDue }: { amountCents: number; paidCents: number; firstPaidAt: Date | null; count: number; firstDue: string }) {
  const remaining = amountCents - paidCents;
  const plan: Array<Omit<Installment, "id">> = [];
  if (paidCents > 0) plan.push({ number: 1, dueDate: firstPaidAt ?? new Date(`${firstDue}T00:00:00.000-03:00`), amountCents: paidCents });
  const base = Math.floor(remaining / count);
  const day = Number(firstDue.slice(8, 10));
  for (let index = 0; index < count; index += 1) {
    plan.push({ number: plan.length + 1, dueDate: occurrenceDueDate(addMonths(firstDue.slice(0, 7), index), day), amountCents: index === count - 1 ? remaining - base * (count - 1) : base });
  }
  return plan;
}

/** Data em que cada parcela ficou quitada: a do recebimento que completou a soma até ela. */
export function installmentPaidDates(installments: Array<{ number: number; amountCents: number }>, payments: Array<{ amountCents: number; paidAt: Date }>) {
  const ordered = [...payments].sort((left, right) => left.paidAt.getTime() - right.paidAt.getTime());
  const dates = new Map<number, Date>();
  let threshold = 0;
  let paid = 0;
  let index = 0;
  for (const installment of [...installments].sort((left, right) => left.number - right.number)) {
    threshold += installment.amountCents;
    while (paid < threshold && index < ordered.length) paid += ordered[index++].amountCents;
    if (paid >= threshold && index > 0) dates.set(installment.number, ordered[index - 1].paidAt);
  }
  return dates;
}
