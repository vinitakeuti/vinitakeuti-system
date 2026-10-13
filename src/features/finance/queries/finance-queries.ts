import { FinancialEntryStatus, FinancialEntryType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const FINANCE_PAGE_SIZE = 50;

export type FinanceFilters = {
  cursor?: string;
  query?: string;
  type?: string;
  status?: string;
  from?: string;
  to?: string;
  fixed?: string;
};

function day(value: string | undefined, end = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  return new Date(`${value}T${end ? "23:59:59.999" : "00:00:00.000"}-03:00`);
}

export function financeDateRange(filters: Pick<FinanceFilters, "from" | "to">) {
  const from = day(filters.from);
  const to = day(filters.to, true);
  return from || to ? { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } : undefined;
}

function normalizedType(value?: string) {
  return value === FinancialEntryType.INCOME || value === FinancialEntryType.EXPENSE ? value : undefined;
}

function normalizedStatus(value?: string) {
  return value === FinancialEntryStatus.PENDING || value === FinancialEntryStatus.SETTLED || value === FinancialEntryStatus.CANCELLED ? value : undefined;
}

function whereFor(filters: FinanceFilters): Prisma.FinancialEntryWhereInput {
  const query = filters.query?.trim().slice(0, 120);
  return {
    ...(normalizedType(filters.type) ? { type: normalizedType(filters.type) } : {}),
    ...(normalizedStatus(filters.status) ? { status: normalizedStatus(filters.status) } : {}),
    ...(filters.fixed === "1" ? { isFixed: true } : {}),
    ...(financeDateRange(filters) ? { dueDate: financeDateRange(filters) } : {}),
    ...(query ? { OR: [{ description: { contains: query, mode: "insensitive" } }, { category: { contains: query, mode: "insensitive" } }, { counterparty: { contains: query, mode: "insensitive" } }] } : {}),
  };
}

export async function listFinancialEntries(filters: FinanceFilters = {}) {
  const rows = await prisma.financialEntry.findMany({
    where: whereFor(filters),
    take: FINANCE_PAGE_SIZE + 1,
    ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    orderBy: [{ dueDate: "desc" }, { id: "desc" }],
    select: { id: true, type: true, status: true, origin: true, isFixed: true, description: true, category: true, counterparty: true, amountCents: true, dueDate: true, settledAt: true, notes: true },
  });
  const hasMore = rows.length > FINANCE_PAGE_SIZE;
  const data = hasMore ? rows.slice(0, FINANCE_PAGE_SIZE) : rows;
  return { data, nextCursor: hasMore ? data.at(-1)?.id ?? null : null };
}

export async function listFixedFinancialEntries(filters: Omit<FinanceFilters, "fixed"> = {}) {
  return listFinancialEntries({ ...filters, fixed: "1" });
}

export async function getFixedFinanceSummary(filters: Pick<FinanceFilters, "from" | "to"> = {}) {
  const range = financeDateRange(filters);
  const groups = await prisma.financialEntry.groupBy({ where: { isFixed: true, ...(range ? { dueDate: range } : {}) }, by: ["type", "status"], _sum: { amountCents: true }, _count: { _all: true } });
  const total = (type: FinancialEntryType, status?: FinancialEntryStatus) => groups.filter((item) => item.type === type && (!status || item.status === status)).reduce((sum, item) => sum + (item._sum.amountCents ?? 0), 0);
  const count = (type: FinancialEntryType) => groups.filter((item) => item.type === type).reduce((sum, item) => sum + item._count._all, 0);
  return { income: total(FinancialEntryType.INCOME), expense: total(FinancialEntryType.EXPENSE), pendingIncome: total(FinancialEntryType.INCOME, FinancialEntryStatus.PENDING), pendingExpense: total(FinancialEntryType.EXPENSE, FinancialEntryStatus.PENDING), incomeCount: count(FinancialEntryType.INCOME), expenseCount: count(FinancialEntryType.EXPENSE) };
}

export async function getFinanceSummary(filters: Pick<FinanceFilters, "from" | "to"> = {}) {
  const base = financeDateRange(filters);
  const [groups, overdue, months] = await Promise.all([
    prisma.financialEntry.groupBy({ by: ["type", "status"], where: base ? { dueDate: base } : undefined, _sum: { amountCents: true }, _count: { _all: true } }),
    prisma.financialEntry.aggregate({ where: { status: FinancialEntryStatus.PENDING, dueDate: { lt: new Date(), ...(base ?? {}) } }, _sum: { amountCents: true }, _count: { _all: true } }),
    Promise.all(Array.from({ length: 6 }, (_, index) => {
      const now = new Date();
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (5 - index), 1));
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (4 - index), 1));
      return prisma.financialEntry.groupBy({ by: ["type", "status"], where: { dueDate: { gte: start, lt: end }, status: FinancialEntryStatus.SETTLED }, _sum: { amountCents: true } }).then((items) => ({ label: new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "America/Maceio" }).format(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (5 - index), 15))).replace(".", ""), income: items.find((item) => item.type === FinancialEntryType.INCOME)?._sum.amountCents ?? 0, expense: items.find((item) => item.type === FinancialEntryType.EXPENSE)?._sum.amountCents ?? 0 }));
    })),
  ]);
  const value = (type: FinancialEntryType, status: FinancialEntryStatus) => groups.find((item) => item.type === type && item.status === status)?._sum.amountCents ?? 0;
  const count = (type: FinancialEntryType, status: FinancialEntryStatus) => groups.find((item) => item.type === type && item.status === status)?._count._all ?? 0;
  const incomeSettled = value(FinancialEntryType.INCOME, FinancialEntryStatus.SETTLED);
  const expenseSettled = value(FinancialEntryType.EXPENSE, FinancialEntryStatus.SETTLED);
  const incomePending = value(FinancialEntryType.INCOME, FinancialEntryStatus.PENDING);
  const expensePending = value(FinancialEntryType.EXPENSE, FinancialEntryStatus.PENDING);
  return { incomeSettled, expenseSettled, incomePending, expensePending, balance: incomeSettled - expenseSettled, forecast: incomeSettled - expenseSettled + incomePending - expensePending, pendingCount: count(FinancialEntryType.INCOME, FinancialEntryStatus.PENDING) + count(FinancialEntryType.EXPENSE, FinancialEntryStatus.PENDING), overdueAmount: overdue._sum.amountCents ?? 0, overdueCount: overdue._count._all, months };
}

export const financeStatusLabel = { PENDING: "A receber / pagar", SETTLED: "Realizado", CANCELLED: "Cancelado" } as const;
export const financeTypeLabel = { INCOME: "Entrada", EXPENSE: "Saída" } as const;
