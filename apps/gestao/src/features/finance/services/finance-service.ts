import { FinancialEntryOrigin, FinancialEntryStatus, FinancialEntryType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { MAX_FINANCIAL_PAYMENTS, recalculateFinancialEntry } from "@/features/finance/services/finance-ledger";
import { ensureRecurringEntries, monthKeyOf, monthStart } from "@/features/finance/services/recurring-entries";
import { MAX_INSTALLMENTS, buildInstallmentPlan, nextOpenInstallment } from "@/features/finance/services/installments";
import { notifyPaymentReceipt, notifySafely } from "@/features/notifications/services/client-emails";

/**
 * Regras do Financeiro usadas pelas telas (ações de formulário) e pela IA: criar lançamento, registrar recebimento e
 * baixar a próxima parcela. Validam a entrada e devolvem um erro legível em vez de redirecionar.
 */

export type FinanceResult<T> = ({ ok: true } & T) | { ok: false; error: string };

/** Vencimento no fuso de Brasília (meia-noite), como as telas gravam. */
export function financeDueDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00.000-03:00`) : null;
}

/** Dia civil do recebimento, gravado ao meio-dia UTC para não mudar de dia em nenhum fuso do Brasil. */
export function financePaymentDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  const year = date.getUTCFullYear();
  return year >= 2000 && year <= 2100 ? date : null;
}

/**
 * Contraparte de um lançamento: um cliente cadastrado (o nome dele vira a contraparte, para o histórico) ou só um
 * nome digitado, sem vínculo.
 */
export async function resolveCounterparty(clientId: string | null | undefined, counterparty: string | null | undefined): Promise<FinanceResult<{ clientId: string | null; counterparty: string | null }>> {
  const id = clientId?.trim().slice(0, 50);
  if (id) {
    const client = await prisma.client.findUnique({ where: { id }, select: { id: true, name: true } });
    if (!client) return { ok: false, error: "Cliente não encontrado. Escolha outro ou digite só o nome." };
    return { ok: true, clientId: client.id, counterparty: client.name.slice(0, 160) };
  }
  return { ok: true, clientId: null, counterparty: counterparty?.trim().slice(0, 160) || null };
}

export type NewFinancialEntry = {
  type: FinancialEntryType;
  description: string;
  category?: string | null;
  amountCents: number;
  /** AAAA-MM-DD */
  dueDate: string;
  counterparty?: string | null;
  /** Cliente cadastrado; quando informado, a contraparte passa a ser o nome dele. */
  clientId?: string | null;
  notes?: string | null;
  /** Só entradas: condição especial combinada ("Mensal no Pix"). */
  paymentCondition?: string | null;
  /** Vira uma recorrência mensal a partir deste vencimento. */
  recurring?: boolean;
  /** Só entradas: já recebida (na data informada, ou hoje se ela ainda não chegou). */
  received?: boolean;
  /** Só entradas a receber: em quantas parcelas mensais. */
  installments?: number;
};

export async function createFinancialEntry(input: NewFinancialEntry): Promise<FinanceResult<{ kind: "entry" | "recurring"; id: string }>> {
  const type = input.type === FinancialEntryType.EXPENSE ? FinancialEntryType.EXPENSE : FinancialEntryType.INCOME;
  const description = input.description.trim().slice(0, 180);
  const category = input.category?.trim().slice(0, 80) || "Outros";
  const amountCents = Math.round(input.amountCents);
  const dueDate = financeDueDate(input.dueDate);
  if (!description || !Number.isFinite(amountCents) || amountCents < 1 || !dueDate) return { ok: false, error: "Preencha descrição, valor e data de vencimento." };
  const party = await resolveCounterparty(input.clientId, input.counterparty);
  if (!party.ok) return party;
  const { clientId, counterparty } = party;
  const notes = input.notes?.trim().slice(0, 500) || null;
  const paymentCondition = type === FinancialEntryType.INCOME ? input.paymentCondition?.trim().slice(0, 80) || null : null;

  // Recorrente: vira uma recorrência mensal a partir deste vencimento; os meses são gerados conforme consultados.
  if (input.recurring) {
    const month = monthKeyOf(dueDate);
    const recurring = await prisma.recurringEntry.create({ data: { type, description, category, counterparty, clientId, amountCents, dayOfMonth: Number(input.dueDate.slice(8, 10)), startsOn: monthStart(month), notes }, select: { id: true } });
    await ensureRecurringEntries(month);
    return { ok: true, kind: "recurring", id: recurring.id };
  }

  // Saídas não precisam de confirmação: contam como pagas na data do vencimento.
  // Entradas ficam a receber, ou recebidas quando marcadas assim (na data informada, ou hoje se ela ainda não chegou).
  const expense = type === FinancialEntryType.EXPENSE;
  const received = !expense && Boolean(input.received);
  const now = new Date();
  const paidAt = expense ? dueDate : dueDate.getTime() <= now.getTime() ? dueDate : now;
  const settled = expense || received;
  // Entrada a receber em parcelas: a primeira vence na data informada, as demais nos meses seguintes.
  const count = Math.min(MAX_INSTALLMENTS, Math.max(1, Math.floor(input.installments ?? 1) || 1));
  const installments = !settled && !expense && count > 1 ? buildInstallmentPlan({ amountCents, paidCents: 0, firstPaidAt: null, count, firstDue: input.dueDate }) : [];
  const entry = await prisma.financialEntry.create({ data: { type, status: settled ? FinancialEntryStatus.SETTLED : FinancialEntryStatus.PENDING, origin: FinancialEntryOrigin.MANUAL, description, category, counterparty, clientId, amountCents, paidCents: settled ? amountCents : 0, isFixed: false, dueDate, settledAt: settled ? paidAt : null, notes, paymentCondition, ...(settled ? { payments: { create: { amountCents, paidAt } } } : {}), ...(installments.length ? { installments: { create: installments } } : {}) }, select: { id: true } });
  return { ok: true, kind: "entry", id: entry.id };
}

/** Garante que a soma recebida não passe do valor esperado (sem contar o recebimento que está sendo editado). */
export async function financialPaymentProblem(entryId: string, amountCents: number, replacingId?: string) {
  const [entry, others, count] = await Promise.all([
    prisma.financialEntry.findUnique({ where: { id: entryId }, select: { type: true, amountCents: true } }),
    prisma.financialPayment.aggregate({ where: { entryId, ...(replacingId ? { id: { not: replacingId } } : {}) }, _sum: { amountCents: true } }),
    prisma.financialPayment.count({ where: { entryId } }),
  ]);
  if (!entry) return "Lançamento não encontrado.";
  if (entry.type !== FinancialEntryType.INCOME) return "Saídas contam como pagas na data do vencimento; altere o valor ou a data no lançamento.";
  if (!replacingId && count >= MAX_FINANCIAL_PAYMENTS) return `Limite de ${MAX_FINANCIAL_PAYMENTS} recebimentos por lançamento.`;
  if ((others._sum.amountCents ?? 0) + amountCents > entry.amountCents) return "A soma recebida passaria do valor esperado. Aumente o valor esperado ou ajuste o recebimento.";
  return null;
}

/** Registra um recebimento numa entrada e avisa o cliente (recibo por e-mail). */
export async function registerFinancialPayment(input: { entryId: string; amountCents: number; paidAt: string; notes?: string | null }): Promise<FinanceResult<{ paymentId: string }>> {
  const entryId = input.entryId.slice(0, 50);
  const amountCents = Math.round(input.amountCents);
  const paidAt = financePaymentDate(input.paidAt);
  if (!entryId || !Number.isFinite(amountCents) || amountCents < 1 || !paidAt) return { ok: false, error: "Informe o valor e a data do recebimento." };
  const problem = await financialPaymentProblem(entryId, amountCents);
  if (problem) return { ok: false, error: problem };
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.financialPayment.create({ data: { entryId, amountCents, paidAt, notes: input.notes?.trim().slice(0, 300) || null }, select: { id: true } });
    await recalculateFinancialEntry(tx, entryId, { syncSale: true });
    return row;
  });
  await notifySafely(() => notifyPaymentReceipt(created.id));
  return { ok: true, paymentId: created.id };
}

/** Marca como paga a próxima parcela em aberto (ou o que falta, sem parcelas) na data informada. */
export async function payNextInstallment(input: { entryId: string; paidAt: string }): Promise<FinanceResult<{ paymentId: string; amountCents: number; label: string | null }>> {
  const entryId = input.entryId.slice(0, 50);
  const paidAt = financePaymentDate(input.paidAt);
  if (!paidAt) return { ok: false, error: "Informe a data do pagamento." };
  const entry = await prisma.financialEntry.findUnique({ where: { id: entryId }, select: { type: true, status: true, amountCents: true, paidCents: true, installments: { orderBy: { number: "asc" }, take: MAX_INSTALLMENTS, select: { number: true, dueDate: true, amountCents: true } } } });
  if (!entry || entry.type !== FinancialEntryType.INCOME || entry.status !== FinancialEntryStatus.PENDING) return { ok: false, error: "Este lançamento não tem cobrança em aberto." };
  const next = entry.installments.length ? nextOpenInstallment(entry.installments, entry.paidCents) : null;
  const amountCents = next ? next.remaining : entry.amountCents - entry.paidCents;
  if (amountCents < 1) return { ok: false, error: "Não há valor em aberto." };
  const label = next ? `Parcela ${next.number}/${entry.installments.length}` : null;
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.financialPayment.create({ data: { entryId, amountCents, paidAt, notes: label }, select: { id: true } });
    await recalculateFinancialEntry(tx, entryId, { syncSale: true });
    return row;
  });
  await notifySafely(() => notifyPaymentReceipt(created.id));
  return { ok: true, paymentId: created.id, amountCents, label };
}
