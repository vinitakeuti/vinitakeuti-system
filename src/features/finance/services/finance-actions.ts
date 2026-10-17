"use server";

import { FinancialEntryOrigin, FinancialEntryStatus, FinancialEntryType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { MAX_FINANCIAL_PAYMENTS, recalculateFinancialEntry } from "@/features/finance/services/finance-ledger";
import { ensureRecurringEntries, monthKeyOf, monthStart, syncExpensePayment } from "@/features/finance/services/recurring-entries";
import { MAX_INSTALLMENTS, buildInstallmentPlan, nextOpenInstallment } from "@/features/finance/services/installments";

function text(formData: FormData, name: string, max: number) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function amountToCents(value: string) {
  const normalized = value.includes(",") ? value.replace(/\./g, "").replace(",", ".") : value.replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

function dateValue(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00.000-03:00`) : null;
}

/** Dia civil do recebimento, gravado ao meio-dia UTC para não mudar de dia em nenhum fuso do Brasil. */
function paymentDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  const year = date.getUTCFullYear();
  return year >= 2000 && year <= 2100 ? date : null;
}

function back(params?: { error?: string; notice?: string }): never {
  if (!params?.error && !params?.notice) redirect("/financeiro");
  const query = new URLSearchParams();
  if (params.error) query.set("error", params.error);
  if (params.notice) query.set(params.notice, "1");
  redirect(`/financeiro?${query.toString()}`);
}

function entryHref(id: string) {
  return `/financeiro/lancamentos/${encodeURIComponent(id)}`;
}

/** Volta para a tela do lançamento com um aviso ou erro. */
function backToEntry(id: string, params: { error?: string; notice?: string }): never {
  const query = new URLSearchParams();
  if (params.error) query.set("error", params.error);
  if (params.notice) query.set("notice", params.notice);
  redirect(`${entryHref(id)}?${query.toString()}`);
}

function revalidateFinance(id?: string) {
  revalidatePath("/financeiro");
  revalidatePath("/financeiro/custos-fixos");
  revalidatePath("/vendas");
  if (id) revalidatePath(entryHref(id));
}

/** As ações rápidas da lista voltam para a lista; as da tela do lançamento voltam para ela. */
function returnsToEntry(formData: FormData) {
  return text(formData, "returnTo", 10) === "entry";
}

export async function createFinancialEntryAction(formData: FormData) {
  const type = text(formData, "type", 20) === FinancialEntryType.EXPENSE ? FinancialEntryType.EXPENSE : FinancialEntryType.INCOME;
  const description = text(formData, "description", 180);
  const category = text(formData, "category", 80) || "Outros";
  const amountCents = amountToCents(text(formData, "amount", 24));
  const dueDate = dateValue(text(formData, "dueDate", 10));
  if (!description || amountCents < 1 || !dueDate) back({ error: "Preencha descrição, valor e data de vencimento." });
  const counterparty = text(formData, "counterparty", 160) || null;
  const notes = text(formData, "notes", 500) || null;
  const paymentCondition = type === FinancialEntryType.INCOME ? text(formData, "paymentCondition", 80) || null : null;

  // Recorrente: vira uma recorrência mensal a partir deste vencimento; os meses são gerados conforme consultados.
  if (formData.get("isFixed") === "on") {
    const month = monthKeyOf(dueDate);
    await prisma.recurringEntry.create({ data: { type, description, category, counterparty, amountCents, dayOfMonth: Number(text(formData, "dueDate", 10).slice(8, 10)), startsOn: monthStart(month), notes } });
    await ensureRecurringEntries(month);
    revalidateFinance();
    back({ notice: "recurring" });
  }

  // Saídas não precisam de confirmação: contam como pagas na data do vencimento.
  // Entradas ficam a receber, ou recebidas quando marcadas assim (na data informada, ou hoje se ela ainda não chegou).
  const expense = type === FinancialEntryType.EXPENSE;
  const received = !expense && text(formData, "status", 20) === FinancialEntryStatus.SETTLED;
  const now = new Date();
  const paidAt = expense ? dueDate : dueDate.getTime() <= now.getTime() ? dueDate : now;
  const settled = expense || received;
  // Entrada a receber em parcelas: a primeira vence na data informada, as demais nos meses seguintes.
  const count = Math.min(MAX_INSTALLMENTS, Math.max(1, Math.floor(Number(text(formData, "installments", 3)) || 1)));
  const installments = !settled && !expense && count > 1 ? buildInstallmentPlan({ amountCents, paidCents: 0, firstPaidAt: null, count, firstDue: text(formData, "dueDate", 10) }) : [];
  await prisma.financialEntry.create({ data: { type, status: settled ? FinancialEntryStatus.SETTLED : FinancialEntryStatus.PENDING, origin: FinancialEntryOrigin.MANUAL, description, category, counterparty, amountCents, paidCents: settled ? amountCents : 0, isFixed: false, dueDate, settledAt: settled ? paidAt : null, notes, paymentCondition, ...(settled ? { payments: { create: { amountCents, paidAt } } } : {}), ...(installments.length ? { installments: { create: installments } } : {}) } });
  revalidateFinance();
  back({ notice: "created" });
}

/** Registra o que falta receber (ou pagar) e deixa o lançamento realizado. */
export async function settleFinancialEntryAction(formData: FormData) {
  const id = text(formData, "id", 50);
  if (!id) back({ error: "Lançamento inválido." });
  await prisma.$transaction(async (tx) => {
    const entry = await tx.financialEntry.findUnique({ where: { id }, select: { type: true, status: true, amountCents: true, paidCents: true } });
    if (!entry || entry.type !== FinancialEntryType.INCOME || entry.status !== FinancialEntryStatus.PENDING) return;
    const remaining = entry.amountCents - entry.paidCents;
    if (remaining > 0) await tx.financialPayment.create({ data: { entryId: id, amountCents: remaining, paidAt: new Date() } });
    await recalculateFinancialEntry(tx, id, { syncSale: true });
  });
  revalidateFinance(id);
  if (returnsToEntry(formData)) backToEntry(id, { notice: "settled" });
  back({ notice: "settled" });
}

export async function cancelFinancialEntryAction(formData: FormData) {
  const id = text(formData, "id", 50);
  if (!id) back({ error: "Lançamento inválido." });
  // Entradas em aberto e saídas (que já contam como pagas) podem ser canceladas.
  await prisma.financialEntry.updateMany({ where: { id, OR: [{ status: FinancialEntryStatus.PENDING }, { type: FinancialEntryType.EXPENSE, status: FinancialEntryStatus.SETTLED }] }, data: { status: FinancialEntryStatus.CANCELLED } });
  revalidateFinance(id);
  if (returnsToEntry(formData)) backToEntry(id, { notice: "cancelled" });
  back({ notice: "cancelled" });
}

/** Desfaz o cancelamento: o status volta a seguir o que foi recebido. */
export async function reopenFinancialEntryAction(formData: FormData) {
  const id = text(formData, "id", 50);
  if (!id) back({ error: "Lançamento inválido." });
  await prisma.$transaction(async (tx) => {
    const changed = await tx.financialEntry.updateMany({ where: { id, status: FinancialEntryStatus.CANCELLED }, data: { status: FinancialEntryStatus.PENDING } });
    if (!changed.count) return;
    await syncExpensePayment(tx, id);
    await recalculateFinancialEntry(tx, id, { syncSale: true });
  });
  revalidateFinance(id);
  backToEntry(id, { notice: "reopened" });
}

/** Edita os dados do lançamento, inclusive o valor esperado. */
export async function updateFinancialEntryAction(formData: FormData) {
  const id = text(formData, "id", 50);
  if (!id) back({ error: "Lançamento inválido." });
  const description = text(formData, "description", 180);
  const amountCents = amountToCents(text(formData, "amount", 24));
  const entry = await prisma.financialEntry.findUnique({ where: { id }, select: { type: true, paidCents: true, amountCents: true, dueDate: true, _count: { select: { installments: true } } } });
  if (!entry) back({ error: "Lançamento não encontrado." });
  // Parcelado: o valor esperado é a soma das parcelas e o vencimento é o da próxima parcela.
  const planned = entry._count.installments > 0;
  const dueDate = planned ? entry.dueDate : dateValue(text(formData, "dueDate", 10));
  const expected = planned ? entry.amountCents : amountCents;
  if (!description || expected < 1 || !dueDate) backToEntry(id, { error: "Preencha descrição, valor esperado e vencimento." });
  if (entry.type === FinancialEntryType.INCOME && expected < entry.paidCents) backToEntry(id, { error: "O valor esperado não pode ser menor que o total já recebido. Ajuste ou remova recebimentos primeiro." });
  await prisma.$transaction(async (tx) => {
    await tx.financialEntry.update({ where: { id }, data: { description, category: text(formData, "category", 80) || "Outros", counterparty: text(formData, "counterparty", 160) || null, amountCents: expected, dueDate, notes: text(formData, "notes", 500) || null, paymentCondition: entry.type === FinancialEntryType.INCOME ? text(formData, "paymentCondition", 80) || null : null } });
    if (entry.type === FinancialEntryType.EXPENSE) await syncExpensePayment(tx, id);
    else await recalculateFinancialEntry(tx, id, { syncSale: true });
  });
  revalidateFinance(id);
  backToEntry(id, { notice: "updated" });
}

type PaymentInput = { amountCents: number; paidAt: Date; notes: string | null };

function paymentFromForm(formData: FormData): PaymentInput | null {
  const amountCents = amountToCents(text(formData, "amount", 24));
  const paidAt = paymentDate(text(formData, "paidAt", 10));
  if (amountCents < 1 || !paidAt) return null;
  return { amountCents, paidAt, notes: text(formData, "notes", 300) || null };
}

/** Garante que a soma recebida não passe do valor esperado (sem contar o recebimento que está sendo editado). */
async function paymentFits(entryId: string, amountCents: number, replacingId?: string) {
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

export async function addFinancialPaymentAction(formData: FormData) {
  const entryId = text(formData, "entryId", 50);
  if (!entryId) back({ error: "Lançamento inválido." });
  const payment = paymentFromForm(formData);
  if (!payment) backToEntry(entryId, { error: "Informe o valor e a data do recebimento." });
  const problem = await paymentFits(entryId, payment.amountCents);
  if (problem) backToEntry(entryId, { error: problem });
  await prisma.$transaction(async (tx) => {
    await tx.financialPayment.create({ data: { entryId, ...payment } });
    await recalculateFinancialEntry(tx, entryId, { syncSale: true });
  });
  revalidateFinance(entryId);
  backToEntry(entryId, { notice: "payment-added" });
}

export async function updateFinancialPaymentAction(formData: FormData) {
  const id = text(formData, "paymentId", 50);
  const current = id ? await prisma.financialPayment.findUnique({ where: { id }, select: { entryId: true } }) : null;
  if (!current) back({ error: "Recebimento não encontrado." });
  const payment = paymentFromForm(formData);
  if (!payment) backToEntry(current.entryId, { error: "Informe o valor e a data do recebimento." });
  const problem = await paymentFits(current.entryId, payment.amountCents, id);
  if (problem) backToEntry(current.entryId, { error: problem });
  await prisma.$transaction(async (tx) => {
    await tx.financialPayment.update({ where: { id }, data: { ...payment, fromSale: false } });
    await recalculateFinancialEntry(tx, current.entryId, { syncSale: true });
  });
  revalidateFinance(current.entryId);
  backToEntry(current.entryId, { notice: "payment-updated" });
}

export async function deleteFinancialPaymentAction(formData: FormData) {
  const id = text(formData, "paymentId", 50);
  const current = id ? await prisma.financialPayment.findUnique({ where: { id }, select: { entryId: true, entry: { select: { type: true } } } }) : null;
  if (!current) back({ error: "Recebimento não encontrado." });
  if (current.entry.type !== FinancialEntryType.INCOME) backToEntry(current.entryId, { error: "Saídas contam como pagas na data do vencimento; para tirar do caixa, cancele o lançamento." });
  await prisma.$transaction(async (tx) => {
    await tx.financialPayment.delete({ where: { id } });
    await recalculateFinancialEntry(tx, current.entryId, { syncSale: true });
  });
  revalidateFinance(current.entryId);
  backToEntry(current.entryId, { notice: "payment-deleted" });
}

/** Divide o que falta receber em parcelas mensais a partir da data da primeira. Substitui as parcelas anteriores. */
export async function planInstallmentsAction(formData: FormData) {
  const entryId = text(formData, "entryId", 50);
  if (!entryId) back({ error: "Lançamento inválido." });
  const firstDue = text(formData, "firstDue", 10);
  const count = Math.floor(Number(text(formData, "count", 3)));
  if (!dateValue(firstDue)) backToEntry(entryId, { error: "Informe a data da primeira parcela." });
  if (!Number.isInteger(count) || count < 1 || count > MAX_INSTALLMENTS) backToEntry(entryId, { error: `Escolha de 1 a ${MAX_INSTALLMENTS} parcelas.` });
  const entry = await prisma.financialEntry.findUnique({ where: { id: entryId }, select: { type: true, status: true, amountCents: true, paidCents: true, payments: { orderBy: [{ paidAt: "asc" }, { id: "asc" }], take: 1, select: { paidAt: true } } } });
  if (!entry || entry.type !== FinancialEntryType.INCOME || entry.status !== FinancialEntryStatus.PENDING) backToEntry(entryId, { error: "Só entradas em aberto podem ser parceladas." });
  if (entry.amountCents - entry.paidCents < count) backToEntry(entryId, { error: "O valor que falta é pequeno demais para tantas parcelas." });
  const plan = buildInstallmentPlan({ amountCents: entry.amountCents, paidCents: entry.paidCents, firstPaidAt: entry.payments[0]?.paidAt ?? null, count, firstDue });
  await prisma.$transaction(async (tx) => {
    await tx.financialInstallment.deleteMany({ where: { entryId } });
    await tx.financialInstallment.createMany({ data: plan.map((installment) => ({ entryId, ...installment })) });
    await recalculateFinancialEntry(tx, entryId, { syncSale: true });
  });
  revalidateFinance(entryId);
  backToEntry(entryId, { notice: "installments-planned" });
}

/** Ajusta a data e o valor de uma parcela; o valor esperado passa a ser a soma das parcelas. */
export async function updateInstallmentAction(formData: FormData) {
  const id = text(formData, "installmentId", 50);
  const installment = id ? await prisma.financialInstallment.findUnique({ where: { id }, select: { entryId: true } }) : null;
  if (!installment) back({ error: "Parcela não encontrada." });
  const dueDate = dateValue(text(formData, "dueDate", 10));
  const amountCents = amountToCents(text(formData, "amount", 24));
  if (!dueDate || amountCents < 1) backToEntry(installment.entryId, { error: "Informe a data e o valor da parcela." });
  const [others, entry] = await Promise.all([
    prisma.financialInstallment.aggregate({ where: { entryId: installment.entryId, id: { not: id } }, _sum: { amountCents: true } }),
    prisma.financialEntry.findUnique({ where: { id: installment.entryId }, select: { paidCents: true } }),
  ]);
  const total = (others._sum.amountCents ?? 0) + amountCents;
  if (!entry || total < entry.paidCents) backToEntry(installment.entryId, { error: "A soma das parcelas não pode ficar abaixo do que já foi recebido." });
  await prisma.$transaction(async (tx) => {
    await tx.financialInstallment.update({ where: { id }, data: { dueDate, amountCents } });
    await tx.financialEntry.update({ where: { id: installment.entryId }, data: { amountCents: total } });
    await recalculateFinancialEntry(tx, installment.entryId, { syncSale: true });
  });
  revalidateFinance(installment.entryId);
  backToEntry(installment.entryId, { notice: "installment-updated" });
}

/** Volta a cobrança única: o lançamento vence de uma vez na data da próxima parcela em aberto. */
export async function clearInstallmentsAction(formData: FormData) {
  const entryId = text(formData, "entryId", 50);
  if (!entryId) back({ error: "Lançamento inválido." });
  await prisma.financialInstallment.deleteMany({ where: { entryId } });
  revalidateFinance(entryId);
  backToEntry(entryId, { notice: "installments-cleared" });
}

/**
 * Marca como paga a próxima parcela em aberto (ou o que falta, sem parcelas) na data informada.
 * Volta para a tela de origem: o lançamento ou a lista de condições especiais.
 */
export async function markNextInstallmentPaidAction(formData: FormData) {
  const entryId = text(formData, "entryId", 50);
  if (!entryId) back({ error: "Lançamento inválido." });
  const returnTo = text(formData, "returnTo", 20);
  const fail: (error: string) => never = (error) => returnTo === "conditions" ? redirect(`/financeiro/condicoes?error=${encodeURIComponent(error)}`) : backToEntry(entryId, { error });
  const paidAt = paymentDate(text(formData, "paidAt", 10));
  if (!paidAt) fail("Informe a data do pagamento.");
  const entry = await prisma.financialEntry.findUnique({ where: { id: entryId }, select: { type: true, status: true, amountCents: true, paidCents: true, installments: { orderBy: { number: "asc" }, take: MAX_INSTALLMENTS, select: { number: true, dueDate: true, amountCents: true } } } });
  if (!entry || entry.type !== FinancialEntryType.INCOME || entry.status !== FinancialEntryStatus.PENDING) fail("Este lançamento não tem cobrança em aberto.");
  const next = entry.installments.length ? nextOpenInstallment(entry.installments, entry.paidCents) : null;
  const allocated = next;
  const amountCents = allocated ? allocated.remaining : entry.amountCents - entry.paidCents;
  if (amountCents < 1) fail("Não há valor em aberto.");
  await prisma.$transaction(async (tx) => {
    await tx.financialPayment.create({ data: { entryId, amountCents, paidAt, notes: allocated ? `Parcela ${allocated.number}/${entry.installments.length}` : null } });
    await recalculateFinancialEntry(tx, entryId, { syncSale: true });
  });
  revalidateFinance(entryId);
  revalidatePath("/financeiro/condicoes");
  if (returnTo === "conditions") redirect("/financeiro/condicoes?notice=paid");
  backToEntry(entryId, { notice: "installment-paid" });
}
