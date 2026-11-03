import { prisma } from "@/lib/prisma";
import { addDays, atMinutes } from "@/features/agenda/types/agenda";

import { addMonths } from "@/features/agenda/types/agenda";

const eventSelect = { id: true, title: true, kind: true, status: true, startsAt: true, endsAt: true, location: true, description: true, source: true, contactName: true, contactPhone: true, contactEmail: true, clientId: true, conversationId: true, archivedAt: true, rescheduledFrom: true, rescheduledCount: true, client: { select: { id: true, name: true } } } as const;

/** Eventos de uma semana (de segunda a domingo), sem os cancelados e os arquivados, em ordem de horário. */
export async function listWeekEvents(monday: string) {
  return prisma.calendarEvent.findMany({ where: { status: { not: "CANCELLED" }, archivedAt: null, startsAt: { lt: atMinutes(addDays(monday, 7), 0) }, endsAt: { gt: atMinutes(monday, 0) } }, orderBy: [{ startsAt: "asc" }, { id: "asc" }], take: 300, select: eventSelect });
}

/** Eventos entre dois dias (inclusive), para a IA e para listas. Cancelados e arquivados só quando pedidos. */
export async function listEventsBetween(fromDay: string, toDay: string, { includeCancelled = false, includeArchived = false, take = 100 } = {}) {
  return prisma.calendarEvent.findMany({ where: { ...(includeCancelled ? {} : { status: { not: "CANCELLED" } }), ...(includeArchived ? {} : { archivedAt: null }), startsAt: { lt: atMinutes(addDays(toDay, 1), 0) }, endsAt: { gt: atMinutes(fromDay, 0) } }, orderBy: [{ startsAt: "asc" }, { id: "asc" }], take, select: eventSelect });
}

/** Evento com o resumo da conversa de atendimento que o gerou. */
export async function getCalendarEvent(id: string) {
  return prisma.calendarEvent.findUnique({ where: { id: id.slice(0, 50) }, select: { ...eventSelect, createdAt: true, createdBy: true, conversation: { select: { id: true, channel: true, summary: true, summaryUpdatedAt: true } } } });
}

/** Próximos eventos (a partir de agora), para o resumo da agenda. */
export async function listUpcomingEvents(take = 6) {
  return prisma.calendarEvent.findMany({ where: { status: "SCHEDULED", endsAt: { gt: new Date() } }, orderBy: [{ startsAt: "asc" }, { id: "asc" }], take, select: eventSelect });
}

/** Clientes para escolher no evento (por nome). */
export async function listClientOptions() {
  return prisma.client.findMany({ orderBy: [{ name: "asc" }, { id: "asc" }], take: 300, select: { id: true, name: true, company: true } });
}

const ARCHIVE_PAGE = 60;

/** Meses que têm eventos arquivados (pelo mês do evento, no horário de Brasília), do mais recente ao mais antigo. No máximo 12 por ano: 240 cobre 20 anos. */
export async function listArchiveMonths() {
  const rows = await prisma.$queryRaw<Array<{ month: string; count: bigint }>>`
    SELECT to_char(("startsAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Maceio', 'YYYY-MM') AS month, COUNT(*) AS count
    FROM "CalendarEvent" WHERE "archivedAt" IS NOT NULL
    GROUP BY 1 ORDER BY 1 DESC LIMIT 240`;
  return rows.map((row) => ({ month: row.month, count: Number(row.count) }));
}

/** Eventos arquivados de um mês, do fim para o começo, em páginas (cursor pelo id do último da página anterior). */
export async function listArchivedEvents(month: string, cursor?: string) {
  const rows = await prisma.calendarEvent.findMany({
    where: { archivedAt: { not: null }, startsAt: { gte: atMinutes(`${month}-01`, 0), lt: atMinutes(`${addMonths(month, 1)}-01`, 0) } },
    orderBy: [{ startsAt: "desc" }, { id: "desc" }],
    take: ARCHIVE_PAGE + 1,
    ...(cursor ? { cursor: { id: cursor.slice(0, 50) }, skip: 1 } : {}),
    select: eventSelect,
  });
  return { events: rows.slice(0, ARCHIVE_PAGE), next: rows.length > ARCHIVE_PAGE ? rows[ARCHIVE_PAGE - 1].id : null };
}
