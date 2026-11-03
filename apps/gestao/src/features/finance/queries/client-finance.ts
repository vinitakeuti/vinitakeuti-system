import { FinancialEntryStatus, FinancialEntryType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Números do cliente no Financeiro (lançamentos vinculados a ele), pela data de vencimento:
 * - faturado: entradas não canceladas (recebido + a receber);
 * - saídas: custos atribuídos ao cliente já pagos (as programadas aparecem à parte);
 * - resultado: recebido menos saídas pagas.
 */

const PAGE = 20;
const ZONE = "America/Maceio";
const dayKey = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: ZONE });

type Row = { key: string; type: FinancialEntryType; amount: bigint | number; paid: bigint | number };

export async function getClientFinance(clientId: string, cursor?: string) {
  const today = dayKey.format(new Date());
  const startOfToday = new Date(`${today}T00:00:00-03:00`);
  const endOfToday = new Date(`${today}T23:59:59.999-03:00`);
  const firstMonth = new Date(`${(() => { const [y, m] = today.split("-").map(Number); const index = y * 12 + m - 1 - 11; return `${Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, "0")}`; })()}-01T00:00:00-03:00`);
  const active = { clientId, status: { not: FinancialEntryStatus.CANCELLED } };

  const [income, overdue, expensePaid, expenseScheduled, years, months, rows, recurring, total] = await Promise.all([
    prisma.financialEntry.aggregate({ where: { ...active, type: FinancialEntryType.INCOME }, _sum: { amountCents: true, paidCents: true }, _count: { _all: true } }),
    prisma.financialEntry.aggregate({ where: { clientId, type: FinancialEntryType.INCOME, status: FinancialEntryStatus.PENDING, dueDate: { lt: startOfToday } }, _sum: { amountCents: true, paidCents: true }, _count: { _all: true } }),
    prisma.financialEntry.aggregate({ where: { ...active, type: FinancialEntryType.EXPENSE, dueDate: { lte: endOfToday } }, _sum: { amountCents: true }, _count: { _all: true } }),
    prisma.financialEntry.aggregate({ where: { ...active, type: FinancialEntryType.EXPENSE, dueDate: { gt: endOfToday } }, _sum: { amountCents: true }, _count: { _all: true } }),
    prisma.$queryRaw<Row[]>`
      SELECT to_char(("dueDate" AT TIME ZONE 'UTC') AT TIME ZONE ${ZONE}, 'YYYY') AS key, "type", SUM("amountCents")::bigint AS amount, SUM("paidCents")::bigint AS paid
      FROM "FinancialEntry" WHERE "clientId" = ${clientId} AND "status" <> 'CANCELLED'
      GROUP BY 1, 2 ORDER BY 1 DESC LIMIT 80`,
    prisma.$queryRaw<Row[]>`
      SELECT to_char(("dueDate" AT TIME ZONE 'UTC') AT TIME ZONE ${ZONE}, 'YYYY-MM') AS key, "type", SUM("amountCents")::bigint AS amount, SUM("paidCents")::bigint AS paid
      FROM "FinancialEntry" WHERE "clientId" = ${clientId} AND "status" <> 'CANCELLED' AND "dueDate" >= ${firstMonth} AND "dueDate" <= ${endOfToday}
      GROUP BY 1, 2 ORDER BY 1 LIMIT 40`,
    prisma.financialEntry.findMany({
      where: { clientId },
      orderBy: [{ dueDate: "desc" }, { id: "desc" }],
      take: PAGE + 1,
      ...(cursor ? { cursor: { id: cursor.slice(0, 50) }, skip: 1 } : {}),
      select: { id: true, type: true, status: true, origin: true, description: true, category: true, amountCents: true, paidCents: true, dueDate: true, paymentCondition: true },
    }),
    prisma.recurringEntry.findMany({ where: { clientId, OR: [{ endsOn: null }, { endsOn: { gte: firstMonth } }] }, orderBy: [{ type: "asc" }, { description: "asc" }], take: 20, select: { id: true, type: true, description: true, amountCents: true, dayOfMonth: true } }),
    prisma.financialEntry.count({ where: { clientId } }),
  ]);

  const received = income._sum.paidCents ?? 0;
  const billed = income._sum.amountCents ?? 0;
  const spent = expensePaid._sum.amountCents ?? 0;
  const byYear = new Map<string, { billed: number; received: number; expenses: number }>();
  for (const row of years) {
    const year = byYear.get(row.key) ?? { billed: 0, received: 0, expenses: 0 };
    if (row.type === FinancialEntryType.INCOME) { year.billed += Number(row.amount); year.received += Number(row.paid); } else year.expenses += Number(row.amount);
    byYear.set(row.key, year);
  }
  const monthKeys = Array.from({ length: 12 }, (_, index) => { const d = new Date(firstMonth.getTime()); d.setUTCMonth(d.getUTCMonth() + index, 15); return d.toISOString().slice(0, 7); });
  const monthly = monthKeys.map((key) => ({
    key,
    billed: months.filter((row) => row.key === key && row.type === FinancialEntryType.INCOME).reduce((sum, row) => sum + Number(row.amount), 0),
    expenses: months.filter((row) => row.key === key && row.type === FinancialEntryType.EXPENSE).reduce((sum, row) => sum + Number(row.amount), 0),
  }));
  return {
    totals: {
      billed, received, receivable: billed - received, incomeCount: income._count._all,
      overdue: (overdue._sum.amountCents ?? 0) - (overdue._sum.paidCents ?? 0), overdueCount: overdue._count._all,
      spent, expenseCount: expensePaid._count._all, scheduled: expenseScheduled._sum.amountCents ?? 0, scheduledCount: expenseScheduled._count._all,
      result: received - spent,
    },
    years: [...byYear.entries()].map(([year, values]) => ({ year, ...values, result: values.received - values.expenses })),
    monthly,
    entries: rows.slice(0, PAGE),
    next: rows.length > PAGE ? rows[PAGE - 1].id : null,
    recurring,
    total,
  };
}

export const countClientFinancialEntries = (clientId: string) => prisma.financialEntry.count({ where: { clientId } });
