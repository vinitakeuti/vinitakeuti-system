import { DocumentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getFinanceSummary, getUpcomingCommitments, getUpcomingReceivables } from "@/features/finance/queries/finance-queries";
import { getMonitoringSummary } from "@/features/monitoring/queries/monitoring-queries";
import { ensureRecurringEntries } from "@/features/finance/services/recurring-entries";
import { listEventsBetween } from "@/features/agenda/queries/agenda-queries";
import { todayKey } from "@/features/agenda/types/agenda";
import { countAttendances } from "@/features/attendance/queries/attendance-queries";
import { countPendingQuotes } from "@/features/quotes/queries/quote-queries";

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

/**
 * Dados da Visão geral: os números do mês, o dia (agenda e vencimentos), os próximos 7 dias de caixa e o que pede
 * atenção na operação. Todas as consultas são as mesmas usadas nas telas de cada área, com limites pequenos.
 */
export async function getOverviewData() {
  const period = currentMonthRange();
  const today = todayKey();
  // Os custos fixos do mês precisam existir antes do resumo.
  await ensureRecurringEntries();
  const [finance, receivables, commitments, events, attentionApps, monitoring, openQuotes, pendingQuotes, attendances] = await Promise.all([
    getFinanceSummary({ from: period.from, to: period.to }),
    getUpcomingReceivables(6),
    getUpcomingCommitments(6),
    listEventsBetween(today, today, { take: 8 }),
    prisma.monitoredApp.findMany({
      where: { status: { in: ["DOWN", "DEGRADED"] } },
      take: 3,
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }, { id: "desc" }],
      select: { id: true, name: true, status: true, lastIncidentAt: true, lastResponseMs: true },
    }),
    getMonitoringSummary(),
    prisma.quote.aggregate({
      where: { status: { in: [DocumentStatus.DRAFT, DocumentStatus.SENT] }, sale: null, lostAt: null },
      _count: { _all: true },
    }),
    countPendingQuotes(),
    countAttendances({}),
  ]);

  return {
    period,
    today,
    finance,
    receivables,
    commitments,
    events,
    attentionApps,
    monitoring,
    openQuotes: openQuotes._count._all,
    pendingQuotes,
    newAttendances: attendances.NEW,
  };
}
