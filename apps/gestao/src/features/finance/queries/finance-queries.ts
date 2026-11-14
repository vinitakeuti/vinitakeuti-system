import { FinancialEntryStatus, FinancialEntryType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { MAX_INSTALLMENTS } from "@/features/finance/services/installments";

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
  const range = financeDateRange(filters);
  const and: Prisma.FinancialEntryWhereInput[] = [];
  // No período entram os lançamentos que vencem nele e os que tiveram algum recebimento nele.
  if (range) and.push({ OR: [{ dueDate: range }, { payments: { some: { paidAt: range } } }, { installments: { some: { dueDate: range } } }] });
  if (query) and.push({ OR: [{ description: { contains: query, mode: "insensitive" } }, { category: { contains: query, mode: "insensitive" } }, { counterparty: { contains: query, mode: "insensitive" } }] });
  return {
    ...(normalizedType(filters.type) ? { type: normalizedType(filters.type) } : {}),
    ...(normalizedStatus(filters.status) ? { status: normalizedStatus(filters.status) } : {}),
    ...(filters.fixed === "1" ? { isFixed: true } : {}),
    ...(and.length ? { AND: and } : {}),
  };
}

export async function listFinancialEntries(filters: FinanceFilters = {}) {
  const rows = await prisma.financialEntry.findMany({
    where: whereFor(filters),
    take: FINANCE_PAGE_SIZE + 1,
    ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    orderBy: [{ dueDate: "desc" }, { id: "desc" }],
    select: { id: true, type: true, status: true, origin: true, isFixed: true, description: true, category: true, counterparty: true, clientId: true, amountCents: true, paidCents: true, dueDate: true, settledAt: true, notes: true, paymentCondition: true, installments: { orderBy: { number: "asc" }, take: MAX_INSTALLMENTS, select: { number: true, dueDate: true, amountCents: true } } },
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

/**
 * Parcelas a receber das entradas em aberto, com o que falta em cada uma. Entradas sem parcelas contam como uma
 * parcela única no vencimento. Os recebimentos quitam as parcelas em ordem (a primeira primeiro).
 */
const OPEN_RECEIVABLES = Prisma.sql`
  WITH plan AS (
    SELECT i."entryId", i."number", i."dueDate", i."amountCents" AS amount, e."paidCents" AS paid,
      COALESCE(SUM(i."amountCents") OVER (PARTITION BY i."entryId" ORDER BY i."number" ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0) AS before,
      COUNT(*) OVER (PARTITION BY i."entryId") AS total
    FROM "FinancialInstallment" i JOIN "FinancialEntry" e ON e."id" = i."entryId"
    WHERE e."type" = 'INCOME' AND e."status" = 'PENDING'
    UNION ALL
    SELECT e."id", 1, e."dueDate", e."amountCents", e."paidCents", 0, 1
    FROM "FinancialEntry" e
    WHERE e."type" = 'INCOME' AND e."status" = 'PENDING' AND NOT EXISTS (SELECT 1 FROM "FinancialInstallment" i WHERE i."entryId" = e."id")
  ), receivables AS (
    SELECT *, GREATEST(0, LEAST(amount, before + amount - paid)) AS remaining FROM plan
  )`;

type ReceivableTotals = { inRange: bigint | number | null; overdue: bigint | number | null; overdueCount: bigint | number | null };

/** Início de hoje e de daqui a `days` dias, no fuso da operação. */
function todayBounds(days = 7) {
  const today = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Maceio" }).format(new Date());
  const start = new Date(`${today}T00:00:00.000-03:00`);
  return { start, end: new Date(start.getTime() + days * 24 * 60 * 60 * 1000) };
}

async function receivableTotals(range: { gte?: Date; lte?: Date } | undefined) {
  const { start } = todayBounds();
  const [row] = await prisma.$queryRaw<ReceivableTotals[]>`${OPEN_RECEIVABLES}
    SELECT
      SUM(remaining) FILTER (WHERE ${range?.gte ? Prisma.sql`"dueDate" >= ${range.gte}` : Prisma.sql`TRUE`} AND ${range?.lte ? Prisma.sql`"dueDate" <= ${range.lte}` : Prisma.sql`TRUE`}) AS "inRange",
      SUM(remaining) FILTER (WHERE "dueDate" < ${start}) AS overdue,
      COUNT(DISTINCT "entryId") FILTER (WHERE "dueDate" < ${start} AND remaining > 0) AS "overdueCount"
    FROM receivables`;
  return { inRange: Number(row?.inRange ?? 0), overdue: Number(row?.overdue ?? 0), overdueCount: Number(row?.overdueCount ?? 0) };
}

export async function getFinanceSummary(filters: Pick<FinanceFilters, "from" | "to"> = {}) {
  const base = financeDateRange(filters);
  // Realizado é o que entrou ou saiu de fato no período, pela data de cada recebimento ou pagamento.
  const realizedIn = (type: FinancialEntryType) => prisma.financialPayment.aggregate({ where: { ...(base ? { paidAt: base } : {}), entry: { type, status: { not: FinancialEntryStatus.CANCELLED } } }, _sum: { amountCents: true } }).then((result) => result._sum.amountCents ?? 0);
  const [receivables, expenses, months, incomeSettled, expenseSettled] = await Promise.all([
    // A receber: o que falta das parcelas que vencem no período. Atrasos (antes de hoje) não dependem do período.
    receivableTotals(base),
    prisma.financialEntry.aggregate({ where: { type: FinancialEntryType.EXPENSE, status: FinancialEntryStatus.PENDING, ...(base ? { dueDate: base } : {}) }, _sum: { amountCents: true, paidCents: true } }),
    realizedMonths(),
    realizedIn(FinancialEntryType.INCOME),
    realizedIn(FinancialEntryType.EXPENSE),
  ]);
  const incomePending = receivables.inRange;
  const expensePending = (expenses._sum.amountCents ?? 0) - (expenses._sum.paidCents ?? 0);
  return { incomeSettled, expenseSettled, incomePending, expensePending, balance: incomeSettled - expenseSettled, forecast: incomeSettled - expenseSettled + incomePending - expensePending, overdueAmount: receivables.overdue, overdueCount: receivables.overdueCount, months };
}

type UpcomingReceivableRow = { entryId: string; number: number; total: bigint | number; dueDate: Date; remaining: bigint | number; description: string; counterparty: string | null };

export const OPEN_INSTALLMENTS_PAGE = 50;

/** Parcela a receber, uma por linha. `isNext`: é a próxima em aberto da venda (só ela pode ser confirmada, porque os recebimentos quitam as parcelas em ordem). */
export type OpenInstallment = {
  entryId: string; number: number; total: number; dueDate: Date; amountCents: number; remaining: number;
  description: string; counterparty: string | null; clientId: string | null; isNext: boolean; overdue: boolean;
  /** Cobrança aberta no Asaas que inclui esta parcela. */
  charge: { invoiceUrl: string | null } | null;
};

type OpenInstallmentRow = { entryId: string; number: number; total: bigint | number; dueDate: Date; amount: bigint | number; remaining: bigint | number; firstOpen: number | null; description: string; counterparty: string | null; clientId: string | null };

/** Cursor da lista de parcelas: vencimento, lançamento e número da última linha mostrada. */
function installmentCursor(row: { dueDate: Date; entryId: string; number: number }) {
  return `${row.dueDate.toISOString()}~${row.entryId}~${row.number}`;
}

function parseInstallmentCursor(value?: string) {
  const [iso, entryId, number] = (value ?? "").slice(0, 120).split("~");
  const dueDate = iso ? new Date(iso) : null;
  if (!dueDate || Number.isNaN(dueDate.getTime()) || !entryId || !/^[\w-]{1,50}$/.test(entryId) || !/^\d{1,3}$/.test(number ?? "")) return null;
  return { dueDate, entryId, number: Number(number) };
}

/**
 * Filtros da lista de parcelas. O cliente vale pelo cadastro do lançamento e, para lançamentos antigos sem cliente,
 * pela proposta de origem (o mesmo critério do portal).
 */
function openInstallmentFilters({ clientId, query }: { clientId?: string; query?: string }) {
  const conditions: Prisma.Sql[] = [Prisma.sql`r.remaining > 0`];
  if (clientId) conditions.push(Prisma.sql`(e."clientId" = ${clientId} OR e."sourceKey" IN (SELECT 'quote:' || q."id" FROM "Quote" q WHERE q."clientId" = ${clientId}))`);
  const search = query?.trim().slice(0, 120);
  if (search) {
    const pattern = `%${search.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
    conditions.push(Prisma.sql`(e."description" ILIKE ${pattern} OR e."counterparty" ILIKE ${pattern})`);
  }
  return conditions;
}

/**
 * Parcelas a receber, uma por linha (as atrasadas primeiro, pela data), com a cobrança aberta no Asaas de cada uma.
 * Sem parcelas, o lançamento aparece como cobrança única. Paginação por cursor; os totais consideram todos os filtros.
 */
export async function listOpenInstallments({ clientId, query, cursor, limit = OPEN_INSTALLMENTS_PAGE }: { clientId?: string; query?: string; cursor?: string; limit?: number } = {}) {
  const { start } = todayBounds();
  const filters = openInstallmentFilters({ clientId, query });
  const after = parseInstallmentCursor(cursor);
  const pageFilters = after ? [...filters, Prisma.sql`(r."dueDate", r."entryId", r."number") > (${after.dueDate}, ${after.entryId}, ${after.number})`] : filters;
  const take = Math.min(Math.max(1, limit), 100);
  const [rows, [totals]] = await Promise.all([
    prisma.$queryRaw<OpenInstallmentRow[]>`${OPEN_RECEIVABLES}, ranked AS (
        SELECT r.*, MIN(r."number") FILTER (WHERE r.remaining > 0) OVER (PARTITION BY r."entryId") AS "firstOpen" FROM receivables r
      )
      SELECT r."entryId", r."number", r.total, r."dueDate", r.amount, r.remaining, r."firstOpen", e."description", e."counterparty", e."clientId"
      FROM ranked r JOIN "FinancialEntry" e ON e."id" = r."entryId"
      WHERE ${Prisma.join(pageFilters, " AND ")}
      ORDER BY r."dueDate" ASC, r."entryId" ASC, r."number" ASC
      LIMIT ${take + 1}`,
    prisma.$queryRaw<Array<{ overdue: bigint | number | null; overdueCount: bigint | number; open: bigint | number | null; openCount: bigint | number }>>`${OPEN_RECEIVABLES}
      SELECT SUM(r.remaining) FILTER (WHERE r."dueDate" < ${start}) AS overdue, COUNT(*) FILTER (WHERE r."dueDate" < ${start}) AS "overdueCount", SUM(r.remaining) AS open, COUNT(*) AS "openCount"
      FROM receivables r JOIN "FinancialEntry" e ON e."id" = r."entryId"
      WHERE ${Prisma.join(filters, " AND ")}`,
  ]);
  const page = rows.slice(0, take);
  const entryIds = [...new Set(page.map((row) => row.entryId))];
  const charges = entryIds.length ? await prisma.charge.findMany({ where: { financialEntryId: { in: entryIds }, status: { in: ["PENDING", "OVERDUE"] } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 200, select: { financialEntryId: true, installmentNumber: true, installmentThrough: true, invoiceUrl: true } }) : [];
  const data: OpenInstallment[] = page.map((row) => {
    const total = Number(row.total);
    const number = Number(row.number);
    // Cobrança única (sem parcelas) é registrada no Asaas com o número 0.
    const charge = charges.find((item) => item.financialEntryId === row.entryId && (total > 1 || item.installmentNumber ? number >= (item.installmentNumber ?? 0) && number <= (item.installmentThrough ?? item.installmentNumber ?? 0) : true)) ?? null;
    return { entryId: row.entryId, number, total, dueDate: new Date(row.dueDate), amountCents: Number(row.amount), remaining: Number(row.remaining), description: row.description, counterparty: row.counterparty, clientId: row.clientId, isNext: row.firstOpen !== null && Number(row.firstOpen) === number, overdue: new Date(row.dueDate) < start, charge: charge ? { invoiceUrl: charge.invoiceUrl } : null };
  });
  return {
    data,
    nextCursor: rows.length > take && page.length ? installmentCursor(page.at(-1)!) : null,
    totals: { overdue: Number(totals?.overdue ?? 0), overdueCount: Number(totals?.overdueCount ?? 0), open: Number(totals?.open ?? 0), openCount: Number(totals?.openCount ?? 0) },
  };
}

/** Cobranças próximas: parcelas a receber nos próximos 7 dias e as que já venceram (atrasadas primeiro). */
export async function getUpcomingReceivables(limit = 6) {
  const { start, end } = todayBounds();
  const [rows, [totals]] = await Promise.all([
    prisma.$queryRaw<UpcomingReceivableRow[]>`${OPEN_RECEIVABLES}
      SELECT r."entryId", r."number", r.total, r."dueDate", r.remaining, e."description", e."counterparty"
      FROM receivables r JOIN "FinancialEntry" e ON e."id" = r."entryId"
      WHERE r.remaining > 0 AND r."dueDate" < ${end}
      ORDER BY r."dueDate" ASC, r."entryId" ASC, r."number" ASC
      LIMIT ${limit}`,
    prisma.$queryRaw<Array<{ upcoming: bigint | number | null; upcomingCount: bigint | number; overdue: bigint | number | null; overdueCount: bigint | number }>>`${OPEN_RECEIVABLES}
      SELECT SUM(remaining) FILTER (WHERE "dueDate" >= ${start}) AS upcoming, COUNT(*) FILTER (WHERE "dueDate" >= ${start}) AS "upcomingCount",
        SUM(remaining) FILTER (WHERE "dueDate" < ${start}) AS overdue, COUNT(*) FILTER (WHERE "dueDate" < ${start}) AS "overdueCount"
      FROM receivables WHERE remaining > 0 AND "dueDate" < ${end}`,
  ]);
  return {
    items: rows.map((row) => ({ entryId: row.entryId, number: Number(row.number), total: Number(row.total), dueDate: new Date(row.dueDate), remaining: Number(row.remaining), description: row.description, counterparty: row.counterparty, overdue: new Date(row.dueDate) < start })),
    upcoming: Number(totals?.upcoming ?? 0), upcomingCount: Number(totals?.upcomingCount ?? 0), overdue: Number(totals?.overdue ?? 0), overdueCount: Number(totals?.overdueCount ?? 0),
  };
}

/** Compromissos próximos: saídas com data de hoje até os próximos 7 dias. */
export async function getUpcomingCommitments(limit = 6) {
  const { start, end } = todayBounds();
  const where = { type: FinancialEntryType.EXPENSE, status: { not: FinancialEntryStatus.CANCELLED }, dueDate: { gte: start, lt: end } };
  const [items, totals] = await Promise.all([
    prisma.financialEntry.findMany({ where, take: limit, orderBy: [{ dueDate: "asc" }, { id: "asc" }], select: { id: true, description: true, counterparty: true, amountCents: true, dueDate: true, recurringEntryId: true } }),
    prisma.financialEntry.aggregate({ where, _sum: { amountCents: true }, _count: { _all: true } }),
  ]);
  return { items, total: totals._sum.amountCents ?? 0, count: totals._count._all };
}

type ConfirmedSalesRow = { count: bigint | number; expected: bigint | number | null; received: bigint | number | null };

/**
 * Vendas confirmadas (contrato fechado), de todo o histórico: o valor esperado e quanto já foi recebido.
 * Vendas de proposta usam o lançamento do Financeiro (valor esperado e recebimentos editados lá);
 * vendas diretas, que não geram lançamento, contam como recebidas quando estão pagas.
 */
export async function getConfirmedSalesSummary() {
  const [row] = await prisma.$queryRaw<ConfirmedSalesRow[]>`
    SELECT COUNT(*) AS count,
      SUM(COALESCE(e."amountCents", s."amountCents")) AS expected,
      SUM(CASE WHEN e."id" IS NOT NULL THEN e."paidCents" WHEN s."status" = 'PAID' THEN s."amountCents" ELSE 0 END) AS received
    FROM "Sale" s
    LEFT JOIN "FinancialEntry" e ON e."sourceKey" = 'quote:' || s."quoteId" AND e."status" <> 'CANCELLED'
    WHERE s."status" IN ('CONFIRMED', 'PAID')`;
  const expected = Number(row?.expected ?? 0);
  const received = Number(row?.received ?? 0);
  return { count: Number(row?.count ?? 0), expected, received, remaining: Math.max(0, expected - received) };
}

/** Lançamento com seus recebimentos, para a tela de edição. */
export async function getFinancialEntryDetail(id: string) {
  if (!id || id.length > 50) return null;
  return prisma.financialEntry.findUnique({
    where: { id },
    select: {
      id: true, type: true, status: true, origin: true, sourceKey: true, isFixed: true, description: true, category: true, counterparty: true, client: { select: { id: true, name: true, company: true } }, amountCents: true, paidCents: true, dueDate: true, settledAt: true, notes: true, createdAt: true, paymentCondition: true,
      recurringEntry: { select: { id: true, description: true } },
      installments: { orderBy: { number: "asc" }, take: MAX_INSTALLMENTS, select: { id: true, number: true, dueDate: true, amountCents: true } },
      payments: { orderBy: [{ paidAt: "asc" }, { id: "asc" }], take: 200, select: { id: true, amountCents: true, paidAt: true, notes: true, fromSale: true, fromQuote: true, chargeId: true } },
    },
  });
}

export const financeStatusLabel = { PENDING: "A receber / pagar", SETTLED: "Realizado", CANCELLED: "Cancelado" } as const;
export const financeTypeLabel = { INCOME: "Entrada", EXPENSE: "Saída" } as const;

type StatusEntry = { type: keyof typeof financeTypeLabel; status: keyof typeof financeStatusLabel; paidCents: number; dueDate: Date };

/** Situação do lançamento para exibir: entradas a receber, parciais ou recebidas; saídas programadas ou pagas. */
export function financeEntryStatusKey(entry: StatusEntry, now = new Date()) {
  if (entry.status === FinancialEntryStatus.CANCELLED) return "cancelled" as const;
  if (entry.type === FinancialEntryType.EXPENSE) return entry.status === FinancialEntryStatus.PENDING ? "pending" as const : entry.dueDate.getTime() > now.getTime() ? "scheduled" as const : "settled" as const;
  if (entry.status === FinancialEntryStatus.SETTLED) return "settled" as const;
  return entry.paidCents > 0 ? "partial" as const : "pending" as const;
}

export function financeEntryStatusLabel(entry: StatusEntry, now = new Date()) {
  const key = financeEntryStatusKey(entry, now);
  const income = entry.type === FinancialEntryType.INCOME;
  return { cancelled: "Cancelado", scheduled: "Programado", settled: income ? "Recebido" : "Pago", partial: "Parcial", pending: income ? "A receber" : "A pagar" }[key];
}

/** Recorrências cadastradas (custos fixos e entradas mensais), ativas primeiro. */
export async function listRecurringEntries() {
  return prisma.recurringEntry.findMany({
    take: 200,
    orderBy: [{ endsOn: { sort: "desc", nulls: "first" } }, { type: "asc" }, { dayOfMonth: "asc" }, { id: "asc" }],
    select: { id: true, type: true, description: true, category: true, counterparty: true, amountCents: true, dayOfMonth: true, startsOn: true, endsOn: true },
  });
}

/** Totais mensais das recorrências ativas no mês atual. */
export async function getRecurringSummary() {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 12));
  const groups = await prisma.recurringEntry.groupBy({ by: ["type"], where: { startsOn: { lte: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 28)) }, OR: [{ endsOn: null }, { endsOn: { gte: monthStart } }] }, _sum: { amountCents: true }, _count: { _all: true } });
  const sum = (type: FinancialEntryType) => groups.find((item) => item.type === type)?._sum.amountCents ?? 0;
  const count = (type: FinancialEntryType) => groups.find((item) => item.type === type)?._count._all ?? 0;
  return { expense: sum(FinancialEntryType.EXPENSE), income: sum(FinancialEntryType.INCOME), expenseCount: count(FinancialEntryType.EXPENSE), incomeCount: count(FinancialEntryType.INCOME) };
}

/** Recorrência com os meses gerados mais recentes. */
export async function getRecurringEntryDetail(id: string) {
  if (!id || id.length > 50) return null;
  return prisma.recurringEntry.findUnique({
    where: { id },
    select: {
      id: true, type: true, description: true, category: true, counterparty: true, client: { select: { id: true, name: true, company: true } }, amountCents: true, dayOfMonth: true, startsOn: true, endsOn: true, notes: true,
      entries: { orderBy: [{ dueDate: "desc" }, { id: "desc" }], take: 18, select: { id: true, type: true, status: true, amountCents: true, paidCents: true, dueDate: true } },
    },
  });
}

export type ConditionFilters = { cursor?: string; condition?: string; status?: string; query?: string };

/** Condições de pagamento já usadas, para reaproveitar o mesmo nome e filtrar. */
export async function listPaymentConditions() {
  const groups = await prisma.financialEntry.groupBy({ by: ["paymentCondition"], where: { type: FinancialEntryType.INCOME, paymentCondition: { not: null } }, _count: { _all: true }, orderBy: { paymentCondition: "asc" }, take: 50 });
  return groups.filter((group) => group.paymentCondition).map((group) => ({ name: group.paymentCondition!, count: group._count._all }));
}

function conditionWhere(filters: ConditionFilters): Prisma.FinancialEntryWhereInput {
  const query = filters.query?.trim().slice(0, 120);
  const status = filters.status === "quitadas" ? FinancialEntryStatus.SETTLED : filters.status === "todas" ? { not: FinancialEntryStatus.CANCELLED } : FinancialEntryStatus.PENDING;
  return {
    type: FinancialEntryType.INCOME,
    status,
    paymentCondition: filters.condition ? filters.condition.slice(0, 80) : { not: null },
    ...(query ? { OR: [{ description: { contains: query, mode: "insensitive" } }, { counterparty: { contains: query, mode: "insensitive" } }, { paymentCondition: { contains: query, mode: "insensitive" } }] } : {}),
  };
}

/** Vendas com condição especial de pagamento, de qualquer data, pela próxima cobrança. */
export async function listConditionEntries(filters: ConditionFilters = {}) {
  const rows = await prisma.financialEntry.findMany({
    where: conditionWhere(filters),
    take: FINANCE_PAGE_SIZE + 1,
    ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    orderBy: [{ dueDate: "asc" }, { id: "asc" }],
    select: { id: true, status: true, description: true, counterparty: true, paymentCondition: true, amountCents: true, paidCents: true, dueDate: true, installments: { orderBy: { number: "asc" }, take: MAX_INSTALLMENTS, select: { number: true, dueDate: true, amountCents: true } } },
  });
  const hasMore = rows.length > FINANCE_PAGE_SIZE;
  const data = hasMore ? rows.slice(0, FINANCE_PAGE_SIZE) : rows;
  return { data, nextCursor: hasMore ? data.at(-1)?.id ?? null : null };
}

/** Totais das vendas com condição especial (com os filtros aplicados) e quantas têm cobrança atrasada. */
export async function getConditionSummary(filters: ConditionFilters = {}) {
  const { start } = todayBounds();
  const condition = filters.condition ? filters.condition.slice(0, 80) : null;
  const [totals, [late]] = await Promise.all([
    prisma.financialEntry.aggregate({ where: conditionWhere({ ...filters, cursor: undefined }), _sum: { amountCents: true, paidCents: true }, _count: { _all: true } }),
    prisma.$queryRaw<Array<{ count: bigint | number; amount: bigint | number | null }>>`${OPEN_RECEIVABLES}
      SELECT COUNT(DISTINCT r."entryId") AS count, SUM(r.remaining) AS amount
      FROM receivables r JOIN "FinancialEntry" e ON e."id" = r."entryId"
      WHERE r.remaining > 0 AND r."dueDate" < ${start} AND e."paymentCondition" IS NOT NULL ${condition ? Prisma.sql`AND e."paymentCondition" = ${condition}` : Prisma.empty}`,
  ]);
  const expected = totals._sum.amountCents ?? 0;
  const received = totals._sum.paidCents ?? 0;
  return { count: totals._count._all, expected, received, remaining: expected - received, lateCount: Number(late?.count ?? 0), lateAmount: Number(late?.amount ?? 0) };
}

/** Pagamentos registrados na proposta da venda, para trazer à entrada quando ainda não estão lá. */
export async function getQuotePaymentsForEntry(sourceKey: string | null) {
  const quoteId = sourceKey?.startsWith("quote:") ? sourceKey.slice("quote:".length) : null;
  if (!quoteId) return [];
  return prisma.quotePayment.findMany({ where: { quoteId }, orderBy: [{ paidAt: "asc" }, { id: "asc" }], take: 50, select: { amountCents: true, paidAt: true } });
}
