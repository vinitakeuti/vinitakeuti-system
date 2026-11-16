import { prisma } from "@/lib/prisma";
import { addDays, addMonths, atMinutes, startOfToday, type ReviewFilter } from "@/features/agenda/types/agenda";

const eventSelect = { id: true, title: true, kind: true, status: true, startsAt: true, endsAt: true, location: true, description: true, source: true, contactName: true, contactPhone: true, contactEmail: true, clientId: true, conversationId: true, rescheduledFrom: true, rescheduledCount: true, client: { select: { id: true, name: true } } } as const;

/** Eventos de uma semana (de segunda a domingo), sem os cancelados, em ordem de horário. Concluídos continuam. */
export async function listWeekEvents(monday: string) {
  return prisma.calendarEvent.findMany({ where: { status: { not: "CANCELLED" }, startsAt: { lt: atMinutes(addDays(monday, 7), 0) }, endsAt: { gt: atMinutes(monday, 0) } }, orderBy: [{ startsAt: "asc" }, { id: "asc" }], take: 300, select: eventSelect });
}

/** Eventos entre dois dias (inclusive), para a IA e para listas. Cancelados só quando pedidos. */
export async function listEventsBetween(fromDay: string, toDay: string, { includeCancelled = false, take = 100 } = {}) {
  return prisma.calendarEvent.findMany({ where: { ...(includeCancelled ? {} : { status: { not: "CANCELLED" } }), startsAt: { lt: atMinutes(addDays(toDay, 1), 0) }, endsAt: { gt: atMinutes(fromDay, 0) } }, orderBy: [{ startsAt: "asc" }, { id: "asc" }], take, select: eventSelect });
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

const REVIEW_PAGE = 60;

export type ReviewMonth = { month: string; done: number; forgotten: number; cancelled: number };

/**
 * Meses para a Revisão (pelo mês do evento, no horário de Brasília), do mais recente ao mais antigo, com quantos
 * eventos foram concluídos, esquecidos e cancelados. No máximo 12 por ano: 240 cobre 20 anos.
 */
export async function listReviewMonths(): Promise<ReviewMonth[]> {
  const rows = await prisma.$queryRaw<Array<{ month: string; done: bigint; forgotten: bigint; cancelled: bigint }>>`
    SELECT to_char(("startsAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Maceio', 'YYYY-MM') AS month,
      COUNT(*) FILTER (WHERE "status" = 'DONE') AS done,
      COUNT(*) FILTER (WHERE "status" = 'SCHEDULED') AS forgotten,
      COUNT(*) FILTER (WHERE "status" = 'CANCELLED') AS cancelled
    FROM "CalendarEvent"
    WHERE "status" IN ('DONE', 'CANCELLED') OR ("status" = 'SCHEDULED' AND "endsAt" < ${startOfToday()})
    GROUP BY 1 ORDER BY 1 DESC LIMIT 240`;
  return rows.map((row) => ({ month: row.month, done: Number(row.done), forgotten: Number(row.forgotten), cancelled: Number(row.cancelled) }));
}

/** Quantos eventos foram esquecidos (marcados, de dias anteriores a hoje): o aviso da agenda e a aba Revisão. */
export async function countForgottenEvents() {
  return prisma.calendarEvent.count({ where: { status: "SCHEDULED", endsAt: { lt: startOfToday() } } });
}

/**
 * Eventos da Revisão: esquecidos, concluídos ou cancelados de um mês (ou, sem mês, todos os esquecidos), do mais
 * recente ao mais antigo, em páginas (cursor pelo id do último da página anterior). Eles continuam no calendário.
 */
export async function listReviewEvents(filter: ReviewFilter, month: string | null, cursor?: string) {
  const status = filter === "esquecidos" ? { status: "SCHEDULED" as const, endsAt: { lt: startOfToday() } } : { status: filter === "cancelados" ? "CANCELLED" as const : "DONE" as const };
  const rows = await prisma.calendarEvent.findMany({
    where: { ...status, ...(month ? { startsAt: { gte: atMinutes(`${month}-01`, 0), lt: atMinutes(`${addMonths(month, 1)}-01`, 0) } } : {}) },
    orderBy: [{ startsAt: "desc" }, { id: "desc" }],
    take: REVIEW_PAGE + 1,
    ...(cursor ? { cursor: { id: cursor.slice(0, 50) }, skip: 1 } : {}),
    select: eventSelect,
  });
  return { events: rows.slice(0, REVIEW_PAGE), next: rows.length > REVIEW_PAGE ? rows[REVIEW_PAGE - 1].id : null };
}
