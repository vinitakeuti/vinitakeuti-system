"use server";

import { FinancialEntryType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { applyRecurringChanges, currentMonthKey, ensureRecurringEntries, isMonthKey, monthKeyOf, monthStart, removeOccurrencesAfter } from "@/features/finance/services/recurring-entries";
import { requireManagementUser } from "@/features/auth/services/auth-session";

const LIST_HREF = "/financeiro/custos-fixos";

function text(formData: FormData, name: string, max: number) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function amountToCents(value: string) {
  const normalized = value.includes(",") ? value.replace(/\./g, "").replace(",", ".") : value.replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

function detailHref(id: string) {
  return `${LIST_HREF}/${encodeURIComponent(id)}`;
}

function go(href: string, params: { error?: string; notice?: string }): never {
  const query = new URLSearchParams();
  if (params.error) query.set("error", params.error);
  if (params.notice) query.set("notice", params.notice);
  redirect(`${href}?${query.toString()}`);
}

function revalidateRecurring(id?: string) {
  revalidatePath("/financeiro");
  revalidatePath(LIST_HREF);
  if (id) revalidatePath(detailHref(id));
}

type RecurringInput = { type: FinancialEntryType; description: string; category: string; counterparty: string | null; amountCents: number; dayOfMonth: number; notes: string | null };

function recurringFromForm(formData: FormData): RecurringInput | { error: string } {
  const description = text(formData, "description", 180);
  const amountCents = amountToCents(text(formData, "amount", 24));
  const dayOfMonth = Number(text(formData, "dayOfMonth", 2));
  if (!description || amountCents < 1) return { error: "Preencha descrição e valor." };
  if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) return { error: "Escolha um dia de vencimento entre 1 e 31." };
  return { type: text(formData, "type", 20) === FinancialEntryType.INCOME ? FinancialEntryType.INCOME : FinancialEntryType.EXPENSE, description, category: text(formData, "category", 80) || "Outros", counterparty: text(formData, "counterparty", 160) || null, amountCents, dayOfMonth, notes: text(formData, "notes", 500) || null };
}

export async function createRecurringEntryAction(formData: FormData) {
  await requireManagementUser();
  const input = recurringFromForm(formData);
  if ("error" in input) go(LIST_HREF, { error: input.error });
  const start = text(formData, "startsOn", 7);
  const month = isMonthKey(start) ? start : currentMonthKey();
  await prisma.recurringEntry.create({ data: { ...input, startsOn: monthStart(month) } });
  await ensureRecurringEntries(month);
  revalidateRecurring();
  go(LIST_HREF, { notice: "created" });
}

/** Salva a recorrência e leva as mudanças para as ocorrências a partir do mês escolhido. */
export async function updateRecurringEntryAction(formData: FormData) {
  await requireManagementUser();
  const id = text(formData, "id", 50);
  if (!id) redirect(LIST_HREF);
  const input = recurringFromForm(formData);
  if ("error" in input) go(detailHref(id), { error: input.error });
  const from = text(formData, "applyFrom", 7);
  const current = await prisma.recurringEntry.findUnique({ where: { id }, select: { type: true } });
  if (!current) redirect(LIST_HREF);
  await prisma.$transaction(async (tx) => {
    // O tipo (entrada ou saída) não muda depois de criado: as ocorrências já registradas dependem dele.
    await tx.recurringEntry.update({ where: { id }, data: { ...input, type: current.type } });
    await applyRecurringChanges(tx, id, isMonthKey(from) ? from : currentMonthKey());
  });
  revalidateRecurring(id);
  go(detailHref(id), { notice: "updated" });
}

/** Encerra a recorrência no mês escolhido: os meses seguintes deixam de existir. */
export async function endRecurringEntryAction(formData: FormData) {
  await requireManagementUser();
  const id = text(formData, "id", 50);
  if (!id) redirect(LIST_HREF);
  const last = text(formData, "endsOn", 7);
  const template = await prisma.recurringEntry.findUnique({ where: { id }, select: { startsOn: true } });
  if (!template) redirect(LIST_HREF);
  const month = isMonthKey(last) ? last : currentMonthKey();
  if (month < monthKeyOf(template.startsOn)) go(detailHref(id), { error: "O último mês não pode ser anterior ao início da recorrência." });
  await prisma.$transaction(async (tx) => {
    await tx.recurringEntry.update({ where: { id }, data: { endsOn: monthStart(month) } });
    await removeOccurrencesAfter(tx, id, month);
  });
  revalidateRecurring(id);
  go(detailHref(id), { notice: "ended" });
}

/** Reativa: os meses depois do encerramento voltam a ser gerados. */
export async function reactivateRecurringEntryAction(formData: FormData) {
  await requireManagementUser();
  const id = text(formData, "id", 50);
  if (!id) redirect(LIST_HREF);
  const template = await prisma.recurringEntry.findUnique({ where: { id }, select: { endsOn: true, generatedThrough: true } });
  if (!template?.endsOn) redirect(detailHref(id));
  const resumeAfter = template.generatedThrough && template.generatedThrough < template.endsOn ? template.generatedThrough : template.endsOn;
  await prisma.recurringEntry.update({ where: { id }, data: { endsOn: null, generatedThrough: resumeAfter } });
  await ensureRecurringEntries();
  revalidateRecurring(id);
  go(detailHref(id), { notice: "reactivated" });
}
