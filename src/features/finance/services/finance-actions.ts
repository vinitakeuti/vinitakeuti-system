"use server";

import { FinancialEntryOrigin, FinancialEntryStatus, FinancialEntryType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

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

function back(params?: { error?: string; notice?: string }) {
  if (!params?.error && !params?.notice) redirect("/financeiro");
  const query = new URLSearchParams();
  if (params.error) query.set("error", params.error);
  if (params.notice) query.set(params.notice, "1");
  redirect(`/financeiro?${query.toString()}`);
}

export async function createFinancialEntryAction(formData: FormData) {
  const type = text(formData, "type", 20) === FinancialEntryType.EXPENSE ? FinancialEntryType.EXPENSE : FinancialEntryType.INCOME;
  const description = text(formData, "description", 180);
  const category = text(formData, "category", 80) || "Outros";
  const amountCents = amountToCents(text(formData, "amount", 24));
  const dueDate = dateValue(text(formData, "dueDate", 10));
  const status = text(formData, "status", 20) === FinancialEntryStatus.SETTLED ? FinancialEntryStatus.SETTLED : FinancialEntryStatus.PENDING;
  if (!description || amountCents < 1 || !dueDate) back({ error: "Preencha descrição, valor e data de vencimento." });
  const now = new Date();
  await prisma.financialEntry.create({ data: { type, status, origin: FinancialEntryOrigin.MANUAL, description, category, counterparty: text(formData, "counterparty", 160) || null, amountCents, isFixed: formData.get("isFixed") === "on", dueDate: dueDate!, settledAt: status === FinancialEntryStatus.SETTLED ? now : null, notes: text(formData, "notes", 500) || null } });
  revalidatePath("/financeiro");
  back({ notice: "created" });
}

export async function settleFinancialEntryAction(formData: FormData) {
  const id = text(formData, "id", 50);
  if (!id) back({ error: "Lançamento inválido." });
  await prisma.financialEntry.updateMany({ where: { id, status: FinancialEntryStatus.PENDING }, data: { status: FinancialEntryStatus.SETTLED, settledAt: new Date() } });
  revalidatePath("/financeiro");
  back({ notice: "settled" });
}

export async function cancelFinancialEntryAction(formData: FormData) {
  const id = text(formData, "id", 50);
  if (!id) back({ error: "Lançamento inválido." });
  await prisma.financialEntry.updateMany({ where: { id, status: FinancialEntryStatus.PENDING }, data: { status: FinancialEntryStatus.CANCELLED } });
  revalidatePath("/financeiro");
  back({ notice: "cancelled" });
}
