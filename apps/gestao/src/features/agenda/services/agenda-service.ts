import { after } from "next/server";
import type { CalendarEventStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendOwnerEmail } from "@/features/notifications/services/owner-email";
import { logEvent } from "@/features/system-logs/services/system-log";
import { EVENT_KINDS, addDays, atMinutes, atTime, dayKey, isDayKey, isEventKind, isTime, longDayLabel, minutesToTime, timeOf, todayKey, weekdayOf, WEEKDAYS, type EventKind } from "@/features/agenda/types/agenda";

/**
 * Regras da agenda, usadas pela tela e pela IA: disponibilidade, horários livres, criar e cancelar eventos e marcar
 * reunião pelo atendimento (com o contato e o resumo da conversa).
 */

const SETTINGS_ID = "default";
const HOUR = 60 * 60 * 1000;
const MAX_EVENT_MINUTES = 24 * 60;

export type AgendaSettingsView = Awaited<ReturnType<typeof getAgendaSettings>>;

/** Disponibilidade (com os padrões quando ainda não foi configurada). */
export async function getAgendaSettings() {
  const saved = await prisma.agendaSettings.findUnique({ where: { id: SETTINGS_ID } });
  return saved ?? { id: SETTINGS_ID, workDays: [1, 2, 3, 4, 5], dayStart: 540, dayEnd: 1080, breakStart: 720 as number | null, breakEnd: 780 as number | null, meetingMinutes: 30, bufferMinutes: 15, minNoticeHours: 12, maxDaysAhead: 21, meetingFormat: null as string | null, aiBooking: true, updatedAt: new Date(0) };
}

export type AgendaSettingsInput = { workDays: number[]; dayStart: number; dayEnd: number; breakStart: number | null; breakEnd: number | null; meetingMinutes: number; bufferMinutes: number; minNoticeHours: number; maxDaysAhead: number; meetingFormat: string; aiBooking: boolean };

export async function saveAgendaSettings(input: AgendaSettingsInput) {
  const workDays = [...new Set(input.workDays.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))].sort();
  if (!workDays.length) return { ok: false as const, error: "Escolha ao menos um dia de atendimento." };
  if (!(input.dayStart >= 0 && input.dayEnd <= 24 * 60 && input.dayStart < input.dayEnd)) return { ok: false as const, error: "O horário de início precisa ser antes do fim." };
  const hasBreak = input.breakStart !== null && input.breakEnd !== null;
  if ((input.breakStart === null) !== (input.breakEnd === null)) return { ok: false as const, error: "Informe o início e o fim da pausa, ou deixe os dois em branco." };
  if (hasBreak && !(input.breakStart! >= input.dayStart && input.breakEnd! <= input.dayEnd && input.breakStart! < input.breakEnd!)) return { ok: false as const, error: "A pausa precisa ficar dentro do horário de atendimento." };
  if (![15, 20, 30, 45, 60, 90, 120].includes(input.meetingMinutes)) return { ok: false as const, error: "Duração da reunião inválida." };
  if (!(input.bufferMinutes >= 0 && input.bufferMinutes <= 120)) return { ok: false as const, error: "Intervalo entre reuniões inválido." };
  if (!(input.minNoticeHours >= 0 && input.minNoticeHours <= 24 * 14)) return { ok: false as const, error: "Antecedência mínima inválida." };
  if (!(input.maxDaysAhead >= 1 && input.maxDaysAhead <= 120)) return { ok: false as const, error: "Limite de dias à frente inválido." };
  const data = { workDays, dayStart: input.dayStart, dayEnd: input.dayEnd, breakStart: hasBreak ? input.breakStart : null, breakEnd: hasBreak ? input.breakEnd : null, meetingMinutes: input.meetingMinutes, bufferMinutes: input.bufferMinutes, minNoticeHours: input.minNoticeHours, maxDaysAhead: input.maxDaysAhead, meetingFormat: input.meetingFormat.trim().slice(0, 300) || null, aiBooking: input.aiBooking };
  await prisma.agendaSettings.upsert({ where: { id: SETTINGS_ID }, create: { id: SETTINGS_ID, ...data }, update: data });
  return { ok: true as const };
}

/** Eventos ativos que ocupam algum momento entre `from` e `to`. */
async function busyBetween(from: Date, to: Date, ignoreId?: string) {
  return prisma.calendarEvent.findMany({ where: { status: "SCHEDULED", startsAt: { lt: to }, endsAt: { gt: from }, ...(ignoreId ? { id: { not: ignoreId } } : {}) }, orderBy: [{ startsAt: "asc" }, { id: "asc" }], take: 500, select: { id: true, title: true, startsAt: true, endsAt: true } });
}

export type FreeDay = { data: string; dia: string; horarios: string[] };

/**
 * Horários livres para reunião: dentro dos dias e horários de atendimento, fora da pausa, sem conflito com a agenda
 * (respeitando o intervalo entre reuniões), depois da antecedência mínima e até o limite de dias à frente.
 */
export async function findFreeSlots({ fromDay, days = 4, perDay = 8, now = new Date() }: { fromDay?: string; days?: number; perDay?: number; now?: Date } = {}): Promise<FreeDay[]> {
  const settings = await getAgendaSettings();
  const earliest = new Date(now.getTime() + settings.minNoticeHours * HOUR);
  const today = dayKey(now);
  const lastDay = addDays(today, settings.maxDaysAhead);
  let day = fromDay && isDayKey(fromDay) && fromDay > today ? fromDay : today;
  if (day > lastDay) return [];
  const busy = await busyBetween(atMinutes(day, 0), atMinutes(addDays(lastDay, 1), 0));
  const buffer = settings.bufferMinutes * 60_000;
  const step = Math.min(settings.meetingMinutes, 30);
  const result: FreeDay[] = [];
  for (; day <= lastDay && result.length < days; day = addDays(day, 1)) {
    const weekday = weekdayOf(day);
    if (!settings.workDays.includes(weekday)) continue;
    const slots: string[] = [];
    for (let minute = settings.dayStart; minute + settings.meetingMinutes <= settings.dayEnd && slots.length < perDay; minute += step) {
      const end = minute + settings.meetingMinutes;
      if (settings.breakStart !== null && settings.breakEnd !== null && minute < settings.breakEnd && end > settings.breakStart) continue;
      const start = atMinutes(day, minute);
      if (start < earliest) continue;
      const finish = atMinutes(day, end);
      if (busy.some((event) => event.startsAt.getTime() < finish.getTime() + buffer && event.endsAt.getTime() > start.getTime() - buffer)) continue;
      slots.push(minutesToTime(minute));
    }
    if (slots.length) result.push({ data: day, dia: `${WEEKDAYS[weekday]}, ${day.slice(8, 10)}/${day.slice(5, 7)}`, horarios: slots });
  }
  return result;
}

/** O horário ainda está livre para reunião? (Confere de novo na hora de marcar.) */
async function slotIsFree(day: string, time: string) {
  const free = await findFreeSlots({ fromDay: day, days: 1, perDay: 200 });
  return free[0]?.data === day && free[0].horarios.includes(time);
}

export type NewEvent = { title: string; kind?: string; day: string; start: string; end?: string | null; durationMinutes?: number | null; description?: string | null; location?: string | null; clientId?: string | null; contactName?: string | null; contactPhone?: string | null; contactEmail?: string | null; conversationId?: string | null; source?: string; createdBy?: string | null };

/** Cria um evento. Conflitos com outros eventos não impedem (é a sua agenda): voltam como aviso. */
export async function createCalendarEvent(input: NewEvent) {
  const title = input.title.trim().slice(0, 160);
  if (!title) return { ok: false as const, error: "Dê um título ao evento." };
  if (!isDayKey(input.day) || !isTime(input.start)) return { ok: false as const, error: "Informe a data (AAAA-MM-DD) e o horário de início (HH:MM)." };
  const kind: EventKind = input.kind && isEventKind(input.kind) ? input.kind : "MEETING";
  const startsAt = atTime(input.day, input.start);
  const endsAt = input.end && isTime(input.end) ? atTime(input.day, input.end) : new Date(startsAt.getTime() + Math.min(Math.max(input.durationMinutes ?? 30, 5), MAX_EVENT_MINUTES) * 60_000);
  if (endsAt <= startsAt) return { ok: false as const, error: "O fim precisa ser depois do início." };
  if (input.clientId && !(await prisma.client.findUnique({ where: { id: input.clientId }, select: { id: true } }))) return { ok: false as const, error: "Cliente não encontrado." };
  const conflicts = await busyBetween(startsAt, endsAt);
  const event = await prisma.calendarEvent.create({
    data: { title, kind, startsAt, endsAt, description: input.description?.trim().slice(0, 4_000) || null, location: input.location?.trim().slice(0, 300) || null, clientId: input.clientId || null, contactName: input.contactName?.trim().slice(0, 120) || null, contactPhone: input.contactPhone?.trim().slice(0, 30) || null, contactEmail: input.contactEmail?.trim().slice(0, 254) || null, conversationId: input.conversationId || null, source: input.source ?? "gestao", createdBy: input.createdBy?.slice(0, 120) || null },
    select: { id: true, startsAt: true, endsAt: true },
  });
  return { ok: true as const, event, conflicts: conflicts.map((item) => ({ id: item.id, titulo: item.title, inicio: timeOf(item.startsAt), fim: timeOf(item.endsAt) })) };
}

export async function setEventStatus(id: string, status: CalendarEventStatus) {
  const result = await prisma.calendarEvent.updateMany({ where: { id: id.slice(0, 50) }, data: { status } });
  return result.count > 0;
}

export async function deleteCalendarEvent(id: string) {
  const result = await prisma.calendarEvent.deleteMany({ where: { id: id.slice(0, 50) } });
  return result.count > 0;
}

export async function updateCalendarEvent(id: string, input: NewEvent) {
  const current = await prisma.calendarEvent.findUnique({ where: { id: id.slice(0, 50) }, select: { id: true } });
  if (!current) return { ok: false as const, error: "Evento não encontrado." };
  const title = input.title.trim().slice(0, 160);
  if (!title) return { ok: false as const, error: "Dê um título ao evento." };
  if (!isDayKey(input.day) || !isTime(input.start) || !input.end || !isTime(input.end)) return { ok: false as const, error: "Informe a data e os horários de início e fim." };
  const startsAt = atTime(input.day, input.start);
  const endsAt = atTime(input.day, input.end);
  if (endsAt <= startsAt) return { ok: false as const, error: "O fim precisa ser depois do início." };
  await prisma.calendarEvent.update({ where: { id: current.id }, data: { title, kind: input.kind && isEventKind(input.kind) ? input.kind : "MEETING", startsAt, endsAt, description: input.description?.trim().slice(0, 4_000) || null, location: input.location?.trim().slice(0, 300) || null, clientId: input.clientId || null } });
  return { ok: true as const };
}

/** Resumo do atendimento na conversa (objetivo do cliente, serviços de interesse, próximo passo). */
export async function saveConversationSummary(conversationId: string, summary: string) {
  const text = summary.trim().slice(0, 2_000);
  if (!text) return false;
  await prisma.aiConversation.update({ where: { id: conversationId }, data: { summary: text, summaryUpdatedAt: new Date() } });
  return true;
}

/** Contato da conversa de atendimento: o informado no site, o número do WhatsApp ou o cliente do portal. */
async function conversationContact(conversationId: string) {
  const conversation = await prisma.aiConversation.findUnique({ where: { id: conversationId }, select: { channel: true, externalKey: true, contactName: true, contactPhone: true, contactEmail: true, clientId: true, client: { select: { name: true, email: true, phone: true } } } });
  if (!conversation) return null;
  if (conversation.channel === "PORTAL" && conversation.client) return { clientId: conversation.clientId, name: conversation.client.name, phone: conversation.client.phone, email: conversation.client.email, channel: "Área do cliente" };
  if (conversation.channel === "WHATSAPP") return { clientId: null, name: conversation.contactName, phone: conversation.externalKey, email: conversation.contactEmail, channel: "WhatsApp" };
  return { clientId: null, name: conversation.contactName, phone: conversation.contactPhone, email: conversation.contactEmail, channel: "Site" };
}

/**
 * Reunião marcada pela IA do atendimento: só em horário livre, uma por conversa, com o contato e o resumo. Você
 * recebe um e-mail com tudo.
 */
export async function bookAttendanceMeeting({ conversationId, day, time, summary, subject }: { conversationId: string; day: string; time: string; summary: string; subject?: string | null }) {
  const settings = await getAgendaSettings();
  if (!settings.aiBooking) return { ok: false as const, error: "O agendamento pela assistente está desligado. Oriente a pessoa a falar com Vinicius pelo WhatsApp." };
  if (!isDayKey(day) || !isTime(time)) return { ok: false as const, error: "Use a data AAAA-MM-DD e o horário HH:MM de um dos horários livres." };
  const existing = await prisma.calendarEvent.findFirst({ where: { conversationId, status: "SCHEDULED", startsAt: { gt: new Date() } }, select: { startsAt: true } });
  if (existing) return { ok: false as const, error: `Já há uma reunião marcada nesta conversa (${longDayLabel(dayKey(existing.startsAt))}, ${timeOf(existing.startsAt)}). Para mudar, cancele a atual antes.` };
  if (!(await slotIsFree(day, time))) return { ok: false as const, error: "Este horário não está mais livre. Consulte os horários livres de novo e ofereça outras opções." };
  const contact = await conversationContact(conversationId);
  if (!contact) return { ok: false as const, error: "Conversa não encontrada." };
  const who = contact.name ?? "contato do atendimento";
  await saveConversationSummary(conversationId, summary);
  const created = await createCalendarEvent({ title: `Reunião · ${who}`.slice(0, 160), kind: "MEETING", day, start: time, durationMinutes: settings.meetingMinutes, description: [subject?.trim() ? `Assunto: ${subject.trim()}` : null, `Resumo do atendimento (${contact.channel}):\n${summary.trim()}`].filter(Boolean).join("\n\n"), location: settings.meetingFormat, clientId: contact.clientId, contactName: contact.name, contactPhone: contact.phone, contactEmail: contact.email, conversationId, source: "ia-atendimento", createdBy: "ia" });
  if (!created.ok) return created;
  const when = `${longDayLabel(day)}, às ${time}`;
  const notify = async () => {
    try {
      await logEvent({ source: "sistema", event: "agenda.meeting.booked", message: `Reunião marcada pelo atendimento com ${who}: ${when}.` });
      await sendOwnerEmail({ kind: "attendance", footer: "Agenda", subject: `Reunião marcada: ${who} · ${day.slice(8, 10)}/${day.slice(5, 7)} às ${time}`, title: "A assistente marcou uma reunião com um cliente.", lines: [`Quando: ${when} (${settings.meetingMinutes} min)`, `Contato: ${who}`, contact.phone ? `Telefone: +${contact.phone.replace(/\D/g, "")}` : "", contact.email ? `E-mail: ${contact.email}` : "", `Origem: ${contact.channel}`, subject ? `Assunto: ${subject}` : "", `Resumo: ${summary.trim()}`].filter(Boolean), path: `/agenda?evento=${created.event.id}` });
    } catch { /* o aviso não pode desfazer a reunião */ }
  };
  try { after(notify); } catch { void notify(); }
  return { ok: true as const, eventId: created.event.id, when, minutes: settings.meetingMinutes, format: settings.meetingFormat };
}

/** Cancela a reunião futura marcada nesta conversa (a pessoa desistiu ou quer outro horário). */
export async function cancelAttendanceMeeting(conversationId: string) {
  const event = await prisma.calendarEvent.findFirst({ where: { conversationId, status: "SCHEDULED", startsAt: { gt: new Date() } }, select: { id: true, title: true, startsAt: true } });
  if (!event) return { ok: false as const, error: "Não há reunião futura marcada nesta conversa." };
  await prisma.calendarEvent.update({ where: { id: event.id }, data: { status: "CANCELLED" } });
  const when = `${longDayLabel(dayKey(event.startsAt))}, às ${timeOf(event.startsAt)}`;
  const notify = async () => {
    try { await sendOwnerEmail({ kind: "attendance", footer: "Agenda", subject: `Reunião cancelada: ${event.title}`, title: "Uma reunião marcada pelo atendimento foi cancelada.", lines: [`Era: ${when}`, "A pessoa pediu o cancelamento na conversa com a assistente."], path: `/agenda?evento=${event.id}` }); } catch { /* sem aviso */ }
  };
  try { after(notify); } catch { void notify(); }
  return { ok: true as const, when };
}

export const eventKindLabel = (kind: string) => EVENT_KINDS[kind as EventKind] ?? "Evento";
export { todayKey };
