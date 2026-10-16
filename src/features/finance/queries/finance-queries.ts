import { FinancialEntryStatus, FinancialEntryType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const FINANCE_PAGE_SIZE = 50;
export const FINANCE_CATEGORIES = ["Vendas", "Serviços recorrentes", "Impostos", "Marketing", "Infraestrutura", "Ferramentas", "Administrativo", "Pró-labore", "Outros"];

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
    select: { id: true, type: true, status: true, origin: true, isFixed: true, description: true, category: true, counterparty: true, amountCents: true, paidCents: true, dueDate: true, settledAt: true, notes: true },
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
  const groups = await prisma.financialEntry.groupBy({ where: { isFixed: true, ...(range ? { dueDate: range } : {}) }, by: ["type", "status"], _sum: { amountCents: true, paidCents: true }, _count: { _all: true } });
  const total = (type: FinancialEntryType) => groups.filter((item) => item.type === type).reduce((sum, item) => sum + (item._sum.amountCents ?? 0), 0);
  // Pendente é o que ainda falta dos lançamentos em aberto (descontados os recebimentos parciais).
  const pending = (type: FinancialEntryType) => groups.filter((item) => item.type === type && item.status === FinancialEntryStatus.PENDING).reduce((sum, item) => sum + (item._sum.amountCents ?? 0) - (item._sum.paidCents ?? 0), 0);
  const count = (type: FinancialEntryType) => groups.filter((item) => item.type === type).reduce((sum, item) => sum + item._count._all, 0);
  return { income: total(FinancialEntryType.INCOME), expense: total(FinancialEntryType.EXPENSE), pendingIncome: pending(FinancialEntryType.INCOME), pendingExpense: pending(FinancialEntryType.EXPENSE), incomeCount: count(FinancialEntryType.INCOME), expenseCount: count(FinancialEntryType.EXPENSE) };
}

type MonthRow = { month: Date; type: FinancialEntryType; total: bigint | number | null };

/** Recebimentos e pagamentos realizados nos últimos seis meses, pela data em que aconteceram. */
async function realizedMonths() {
  const now = new Date();
  const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  const rows = await prisma.$queryRaw<MonthRow[]>`
    SELECT date_trunc('month', p."paidAt") AS month, e."type" AS type, SUM(p."amountCents") AS total
    FROM "FinancialPayment" p JOIN "FinancialEntry" e ON e."id" = p."entryId"
    WHERE p."paidAt" >= ${first} AND e."status" <> 'CANCELLED'
    GROUP BY 1, 2`;
  return Array.from({ length: 6 }, (_, index) => {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (5 - index), 1));
    const sum = (type: FinancialEntryType) => Number(rows.find((row) => row.type === type && new Date(row.month).getTime() === start.getTime())?.total ?? 0);
    return { label: new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "America/Maceio" }).format(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (5 - index), 15))).replace(".", ""), income: sum(FinancialEntryType.INCOME), expense: sum(FinancialEntryType.EXPENSE) };
  });
}

export async function getFinanceSummary(filters: Pick<FinanceFilters, "from" | "to"> = {}) {
  const base = financeDateRange(filters);
  const [groups, overdue, months] = await Promise.all([
    prisma.financialEntry.groupBy({ by: ["type", "status"], where: base ? { dueDate: base } : undefined, _sum: { amountCents: true, paidCents: true }, _count: { _all: true } }),
    prisma.financialEntry.aggregate({ where: { status: FinancialEntryStatus.PENDING, dueDate: { lt: new Date(), ...(base ?? {}) } }, _sum: { amountCents: true, paidCents: true }, _count: { _all: true } }),
    realizedMonths(),
  ]);
  // Realizado é o que foi recebido ou pago (inclusive parcelas de lançamentos ainda em aberto); previsto é o que falta.
  const realized = (type: FinancialEntryType) => groups.filter((item) => item.type === type && item.status !== FinancialEntryStatus.CANCELLED).reduce((sum, item) => sum + (item._sum.paidCents ?? 0), 0);
  const remaining = (type: FinancialEntryType) => groups.filter((item) => item.type === type && item.status === FinancialEntryStatus.PENDING).reduce((sum, item) => sum + (item._sum.amountCents ?? 0) - (item._sum.paidCents ?? 0), 0);
  const count = (type: FinancialEntryType, status: FinancialEntryStatus) => groups.find((item) => item.type === type && item.status === status)?._count._all ?? 0;
  const incomeSettled = realized(FinancialEntryType.INCOME);
  const expenseSettled = realized(FinancialEntryType.EXPENSE);
  const incomePending = remaining(FinancialEntryType.INCOME);
  const expensePending = remaining(FinancialEntryType.EXPENSE);
  return { incomeSettled, expenseSettled, incomePending, expensePending, balance: incomeSettled - expenseSettled, forecast: incomeSettled - expenseSettled + incomePending - expensePending, pendingCount: count(FinancialEntryType.INCOME, FinancialEntryStatus.PENDING) + count(FinancialEntryType.EXPENSE, FinancialEntryStatus.PENDING), overdueAmount: (overdue._sum.amountCents ?? 0) - (overdue._sum.paidCents ?? 0), overdueCount: overdue._count._all, months };
}

/** Lançamento com seus recebimentos, para a tela de edição. */
export async function getFinancialEntryDetail(id: string) {
  if (!id || id.length > 50) return null;
  return prisma.financialEntry.findUnique({
    where: { id },
    select: {
      id: true, type: true, status: true, origin: true, sourceKey: true, isFixed: true, description: true, category: true, counterparty: true, amountCents: true, paidCents: true, dueDate: true, settledAt: true, notes: true, createdAt: true,
      payments: { orderBy: [{ paidAt: "asc" }, { id: "asc" }], take: 200, select: { id: true, amountCents: true, paidAt: true, notes: true, fromSale: true } },
    },
  });
}

export const financeStatusLabel = { PENDING: "A receber / pagar", SETTLED: "Realizado", CANCELLED: "Cancelado" } as const;

/** Rótulo do status considerando recebimentos parciais. */
export function financeEntryStatusLabel(entry: { status: keyof typeof financeStatusLabel; paidCents: number }) {
  return entry.status === FinancialEntryStatus.PENDING && entry.paidCents > 0 ? "Parcial" : financeStatusLabel[entry.status];
}
export const financeTypeLabel = { INCOME: "Entrada", EXPENSE: "Saída" } as const;
