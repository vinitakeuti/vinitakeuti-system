import { FinancialEntryOrigin, FinancialEntryStatus, FinancialEntryType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Tx = Prisma.TransactionClient;

/** Quantos meses à frente as recorrências podem ser geradas. */
const MAX_MONTHS_AHEAD = 24;
const MAX_TEMPLATES_PER_RUN = 200;

const isoDay = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Maceio" });

/** Mês civil no formato AAAA-MM. */
export type MonthKey = string;

export function isMonthKey(value: string | undefined | null): value is MonthKey {
  return Boolean(value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value));
}

export function currentMonthKey(now = new Date()): MonthKey {
  return isoDay.format(now).slice(0, 7);
}

export function monthKeyOf(date: Date): MonthKey {
  return isoDay.format(date).slice(0, 7);
}

export function addMonths(key: MonthKey, months: number): MonthKey {
  const [year, month] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + months, 1));
  return date.toISOString().slice(0, 7);
}

/** Representação de um mês no banco: dia 1 ao meio-dia UTC. */
export function monthStart(key: MonthKey) {
  return new Date(`${key}-01T12:00:00.000Z`);
}

/** Vencimento da ocorrência: o dia escolhido ou, se o mês for mais curto, o último dia dele. */
export function occurrenceDueDate(key: MonthKey, dayOfMonth: number) {
  const [year, month] = key.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(Math.max(1, dayOfMonth), lastDay);
  return new Date(`${key}-${String(day).padStart(2, "0")}T00:00:00.000-03:00`);
}

/** "Todo dia 31": nos meses mais curtos, o vencimento cai no último dia. */
export function recurringDayLabel(day: number) {
  return day > 28 ? `Todo dia ${day} · último dia nos meses mais curtos` : `Todo dia ${day}`;
}

function monthsBetween(from: MonthKey, to: MonthKey) {
  const months: MonthKey[] = [];
  for (let key = from; key <= to && months.length <= MAX_MONTHS_AHEAD * 4; key = addMonths(key, 1)) months.push(key);
  return months;
}

type Template = { id: string; type: FinancialEntryType; description: string; category: string; counterparty: string | null; amountCents: number; dayOfMonth: number; notes: string | null };

function occurrenceId(templateId: string, key: MonthKey) {
  return `rec_${templateId}_${key.replace("-", "")}`;
}

/** Cria as ocorrências que faltam de uma recorrência nos meses informados. Saídas já entram pagas na data. */
async function createOccurrences(tx: Tx, template: Template, months: MonthKey[]) {
  if (!months.length) return;
  const sourceKeys = months.map((key) => `recurring:${template.id}:${key}`);
  const existing = new Set((await tx.financialEntry.findMany({ where: { sourceKey: { in: sourceKeys } }, select: { sourceKey: true } })).map((entry) => entry.sourceKey));
  const missing = months.filter((key) => !existing.has(`recurring:${template.id}:${key}`));
  if (!missing.length) return;
  const expense = template.type === FinancialEntryType.EXPENSE;
  const rows = missing.map((key) => {
    const dueDate = occurrenceDueDate(key, template.dayOfMonth);
    return { id: occurrenceId(template.id, key), sourceKey: `recurring:${template.id}:${key}`, recurringEntryId: template.id, origin: FinancialEntryOrigin.MANUAL, type: template.type, status: expense ? FinancialEntryStatus.SETTLED : FinancialEntryStatus.PENDING, description: template.description, category: template.category, counterparty: template.counterparty, amountCents: template.amountCents, paidCents: expense ? template.amountCents : 0, isFixed: true, dueDate, settledAt: expense ? dueDate : null, notes: template.notes };
  });
  await tx.financialEntry.createMany({ data: rows, skipDuplicates: true });
  if (expense) await tx.financialPayment.createMany({ data: rows.map((row) => ({ id: `${row.id}_p`, entryId: row.id, amountCents: row.amountCents, paidAt: row.dueDate })), skipDuplicates: true });
}

/**
 * Garante que as recorrências tenham ocorrências até o mês informado (no mínimo o mês atual, no máximo 24 meses à frente).
 * Idempotente: cada recorrência guarda até que mês já foi gerada.
 */
export async function ensureRecurringEntries(through?: MonthKey | null) {
  const current = currentMonthKey();
  const limit = addMonths(current, MAX_MONTHS_AHEAD);
  const target = !through || through < current ? current : through > limit ? limit : through;
  const targetStart = monthStart(target);
  const templates = await prisma.recurringEntry.findMany({
    where: { startsOn: { lte: targetStart }, OR: [{ generatedThrough: null }, { generatedThrough: { lt: targetStart } }] },
    take: MAX_TEMPLATES_PER_RUN,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, type: true, description: true, category: true, counterparty: true, amountCents: true, dayOfMonth: true, notes: true, startsOn: true, endsOn: true, generatedThrough: true },
  });
  for (const template of templates) {
    const from = template.generatedThrough ? addMonths(monthKeyOf(template.generatedThrough), 1) : monthKeyOf(template.startsOn);
    const end = template.endsOn && monthKeyOf(template.endsOn) < target ? monthKeyOf(template.endsOn) : target;
    await prisma.$transaction(async (tx) => {
      await createOccurrences(tx, template, from <= end ? monthsBetween(from, end) : []);
      await tx.recurringEntry.update({ where: { id: template.id }, data: { generatedThrough: targetStart } });
    });
  }
}

/** Saída: o pagamento acompanha o valor e a data do vencimento (não precisa ser confirmado). */
export async function syncExpensePayment(tx: Tx, entryId: string) {
  const entry = await tx.financialEntry.findUnique({ where: { id: entryId }, select: { type: true, status: true, amountCents: true, dueDate: true } });
  if (!entry || entry.type !== FinancialEntryType.EXPENSE) return;
  await tx.financialPayment.deleteMany({ where: { entryId } });
  await tx.financialPayment.create({ data: { entryId, amountCents: entry.amountCents, paidAt: entry.dueDate } });
  await tx.financialEntry.update({ where: { id: entryId }, data: { paidCents: entry.amountCents, settledAt: entry.dueDate, ...(entry.status === FinancialEntryStatus.CANCELLED ? {} : { status: FinancialEntryStatus.SETTLED }) } });
}

/**
 * Leva as alterações da recorrência para as ocorrências a partir de um mês (as anteriores ficam como estavam).
 * Entradas já recebidas em parte não ficam com valor esperado abaixo do recebido.
 */
export async function applyRecurringChanges(tx: Tx, templateId: string, from: MonthKey) {
  const template = await tx.recurringEntry.findUnique({ where: { id: templateId }, select: { id: true, type: true, description: true, category: true, counterparty: true, amountCents: true, dayOfMonth: true, notes: true } });
  if (!template) return;
  const occurrences = await tx.financialEntry.findMany({ where: { recurringEntryId: templateId, dueDate: { gte: occurrenceDueDate(from, 1) } }, take: MAX_MONTHS_AHEAD * 4, select: { id: true, dueDate: true, paidCents: true, status: true } });
  for (const occurrence of occurrences) {
    const key = monthKeyOf(occurrence.dueDate);
    await tx.financialEntry.update({ where: { id: occurrence.id }, data: { description: template.description, category: template.category, counterparty: template.counterparty, notes: template.notes, dueDate: occurrenceDueDate(key, template.dayOfMonth), amountCents: Math.max(template.amountCents, template.type === FinancialEntryType.INCOME ? occurrence.paidCents : 0) } });
    if (template.type === FinancialEntryType.EXPENSE) await syncExpensePayment(tx, occurrence.id);
  }
}

/** Remove as ocorrências depois do último mês da recorrência (mantém entradas que já tiveram recebimento). */
export async function removeOccurrencesAfter(tx: Tx, templateId: string, last: MonthKey) {
  await tx.financialEntry.deleteMany({ where: { recurringEntryId: templateId, dueDate: { gte: occurrenceDueDate(addMonths(last, 1), 1) }, OR: [{ type: FinancialEntryType.EXPENSE }, { paidCents: 0 }] } });
}
