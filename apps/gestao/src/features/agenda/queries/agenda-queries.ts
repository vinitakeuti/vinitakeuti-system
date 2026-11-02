import { prisma } from "@/lib/prisma";
import { addDays, atMinutes } from "@/features/agenda/types/agenda";

const eventSelect = { id: true, title: true, kind: true, status: true, startsAt: true, endsAt: true, location: true, description: true, source: true, contactName: true, contactPhone: true, contactEmail: true, clientId: true, conversationId: true, client: { select: { id: true, name: true } } } as const;

/** Eventos de uma semana (de segunda a domingo), sem os cancelados, em ordem de horário. */
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
