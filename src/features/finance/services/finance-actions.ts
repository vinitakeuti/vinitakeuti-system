"use server";

import { FinancialEntryOrigin, FinancialEntryStatus, FinancialEntryType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { MAX_FINANCIAL_PAYMENTS, recalculateFinancialEntry } from "@/features/finance/services/finance-ledger";

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
  const settled = text(formData, "status", 20) === FinancialEntryStatus.SETTLED;
  if (!description || amountCents < 1 || !dueDate) back({ error: "Preencha descrição, valor e data de vencimento." });
  // Já realizado: o recebimento entra na data informada (ou hoje, se a data ainda não chegou).
  const now = new Date();
  const paidAt = dueDate.getTime() <= now.getTime() ? dueDate : now;
  await prisma.financialEntry.create({ data: { type, status: settled ? FinancialEntryStatus.SETTLED : FinancialEntryStatus.PENDING, origin: FinancialEntryOrigin.MANUAL, description, category, counterparty: text(formData, "counterparty", 160) || null, amountCents, paidCents: settled ? amountCents : 0, isFixed: formData.get("isFixed") === "on", dueDate, settledAt: settled ? paidAt : null, notes: text(formData, "notes", 500) || null, ...(settled ? { payments: { create: { amountCents, paidAt } } } : {}) } });
  revalidateFinance();
  back({ notice: "created" });
}

/** Registra o que falta receber (ou pagar) e deixa o lançamento realizado. */
export async function settleFinancialEntryAction(formData: FormData) {
  const id = text(formData, "id", 50);
  if (!id) back({ error: "Lançamento inválido." });
  await prisma.$transaction(async (tx) => {
    const entry = await tx.financialEntry.findUnique({ where: { id }, select: { status: true, amountCents: true, paidCents: true } });
    if (!entry || entry.status !== FinancialEntryStatus.PENDING) return;
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
  await prisma.financialEntry.updateMany({ where: { id, status: FinancialEntryStatus.PENDING }, data: { status: FinancialEntryStatus.CANCELLED } });
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
    if (changed.count) await recalculateFinancialEntry(tx, id, { syncSale: true });
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
  const dueDate = dateValue(text(formData, "dueDate", 10));
  if (!description || amountCents < 1 || !dueDate) backToEntry(id, { error: "Preencha descrição, valor esperado e vencimento." });
  const entry = await prisma.financialEntry.findUnique({ where: { id }, select: { paidCents: true } });
  if (!entry) back({ error: "Lançamento não encontrado." });
  if (amountCents < entry.paidCents) backToEntry(id, { error: "O valor esperado não pode ser menor que o total já recebido. Ajuste ou remova recebimentos primeiro." });
  await prisma.$transaction(async (tx) => {
    await tx.financialEntry.update({ where: { id }, data: { description, category: text(formData, "category", 80) || "Outros", counterparty: text(formData, "counterparty", 160) || null, amountCents, dueDate, isFixed: formData.get("isFixed") === "on", notes: text(formData, "notes", 500) || null } });
    await recalculateFinancialEntry(tx, id, { syncSale: true });
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
    prisma.financialEntry.findUnique({ where: { id: entryId }, select: { amountCents: true } }),
    prisma.financialPayment.aggregate({ where: { entryId, ...(replacingId ? { id: { not: replacingId } } : {}) }, _sum: { amountCents: true } }),
    prisma.financialPayment.count({ where: { entryId } }),
  ]);
  if (!entry) return "Lançamento não encontrado.";
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
  const current = id ? await prisma.financialPayment.findUnique({ where: { id }, select: { entryId: true } }) : null;
  if (!current) back({ error: "Recebimento não encontrado." });
  await prisma.$transaction(async (tx) => {
    await tx.financialPayment.delete({ where: { id } });
    await recalculateFinancialEntry(tx, current.entryId, { syncSale: true });
  });
  revalidateFinance(current.entryId);
  backToEntry(current.entryId, { notice: "payment-deleted" });
}
