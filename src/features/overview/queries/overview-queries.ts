import { DocumentStatus, FinancialEntryStatus, FinancialEntryType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getFinanceSummary } from "@/features/finance/queries/finance-queries";
import { getMonitoringSummary } from "@/features/monitoring/queries/monitoring-queries";

function currentMonthRange() {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Maceio", year: "numeric", month: "numeric" }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    from: `${year}-${String(month).padStart(2, "0")}-01`,
    to: `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`,
    year,
    month,
  };
}

export async function getOverviewData() {
  const period = currentMonthRange();
  const now = new Date();
  const [finance, payments, monitoredApps, monitoring, openQuotes] = await Promise.all([
    getFinanceSummary({ from: period.from, to: period.to }),
    prisma.financialEntry.findMany({
      where: { type: FinancialEntryType.INCOME, status: FinancialEntryStatus.PENDING, dueDate: { gte: now } },
      take: 5,
      orderBy: [{ dueDate: "asc" }, { id: "asc" }],
      select: { id: true, description: true, counterparty: true, amountCents: true, dueDate: true },
    }),
    prisma.monitoredApp.findMany({
      take: 6,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      select: { id: true, name: true, status: true, lastCheckedAt: true, lastResponseMs: true, healthEndpoint: true },
    }),
    getMonitoringSummary(),
    prisma.quote.aggregate({
      where: { status: { in: [DocumentStatus.DRAFT, DocumentStatus.SENT] }, sale: null },
      _count: { _all: true },
    }),
  ]);

  return { period, finance, payments, monitoredApps, monitoring, openQuotes: openQuotes._count._all };
}
