"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireManagementUser } from "@/features/auth/services/auth-session";
import { prisma } from "@/lib/prisma";
import { archiveDoneBetween, createCalendarEvent, deleteCalendarEvent, saveAgendaSettings, setEventArchived, setEventStatus, shiftCalendarEvent, updateCalendarEvent } from "@/features/agenda/services/agenda-service";
import { dayKey, isDayKey, isMonthKey, isTime, monthOf, timeToMinutes, weekStart } from "@/features/agenda/types/agenda";

/** Ações da tela da Agenda. Voltam para a tela de onde vieram (semana, mês ou arquivo), com aviso ou erro. */

const text = (formData: FormData, name: string, max: number) => {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
};

function back(params: Record<string, string | undefined>): never {
  revalidatePath("/agenda");
  const query = new URLSearchParams(Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1])));
  redirect(`/agenda${query.size ? `?${query}` : ""}`);
}

/**
 * A tela de origem, pelo campo `voltar` (semana=…, visao=mes&mes=… ou aba=arquivo&mes=…). Com `day`, a semana ou o
 * mês passam a ser os do evento (ao criar ou mudar a data, a tela mostra onde ele ficou).
 */
function origin(formData: FormData, day?: string): Record<string, string | undefined> {
  const query = new URLSearchParams(text(formData, "voltar", 120));
  const month = query.get("mes") ?? "";
  const validMonth = isMonthKey(month) ? month : undefined;
  if (query.get("aba") === "arquivo") return { aba: "arquivo", mes: validMonth };
  if (query.get("visao") === "mes") return { visao: "mes", mes: day && isDayKey(day) ? monthOf(day) : validMonth };
  const week = query.get("semana") ?? "";
  return { semana: day && isDayKey(day) ? weekStart(day) : isDayKey(week) ? week : undefined };
}

function eventInput(formData: FormData) {
  return { title: text(formData, "title", 160), kind: text(formData, "kind", 20), day: text(formData, "day", 10), start: text(formData, "start", 5), end: text(formData, "end", 5), description: text(formData, "description", 4_000), location: text(formData, "location", 300), clientId: text(formData, "clientId", 50) || null };
}

export async function createEventAction(formData: FormData) {
  const user = await requireManagementUser();
  const input = eventInput(formData);
  const result = await createCalendarEvent({ ...input, source: "gestao", createdBy: user.email });
  if (!result.ok) back({ ...origin(formData), novo: "1", erro: result.error, dia: input.day });
  back({ ...origin(formData, input.day), destaque: result.event.id, aviso: result.conflicts.length ? "conflito" : "criado" });
}

export async function updateEventAction(formData: FormData) {
  await requireManagementUser();
  const id = text(formData, "id", 50);
  const input = eventInput(formData);
  const result = await updateCalendarEvent(id, input);
  if (!result.ok) back({ ...origin(formData), evento: id, editar: "1", erro: result.error });
  back({ ...origin(formData, input.day), evento: id, aviso: "salvo" });
}

export async function setEventStatusAction(formData: FormData) {
  await requireManagementUser();
  const id = text(formData, "id", 50);
  const status = text(formData, "status", 20);
  if (status === "DONE" || status === "CANCELLED" || status === "SCHEDULED") await setEventStatus(id, status);
  const where = origin(formData);
  // Reaberto a partir do arquivo: volta para a semana do evento, onde ele reaparece.
  if (status === "SCHEDULED" && where.aba === "arquivo") {
    const event = await prisma.calendarEvent.findUnique({ where: { id }, select: { startsAt: true } });
    back({ semana: event ? weekStart(dayKey(event.startsAt)) : undefined, evento: id, aviso: "reaberto" });
  }
  back({ ...where, evento: status === "CANCELLED" ? undefined : id, aviso: status === "CANCELLED" ? "cancelado" : status === "DONE" ? "concluido" : "reaberto" });
}

/** Setas da semana: passa o evento para o dia anterior ou o seguinte, no mesmo horário. */
export async function shiftEventAction(formData: FormData) {
  await requireManagementUser();
  const id = text(formData, "id", 50);
  const result = await shiftCalendarEvent(id, Number(text(formData, "dias", 3)));
  if (!result.ok) back({ ...origin(formData), erro: result.error });
  // Pelo pop-up, ele continua aberto: dá para remarcar vários dias seguidos.
  back({ ...origin(formData), ...(text(formData, "manter", 1) === "1" ? { evento: id } : {}), destaque: id, aviso: result.hasContact ? "remarcado-contato" : result.conflicts ? "remarcado-conflito" : "remarcado", dia: result.day });
}

export async function archiveEventAction(formData: FormData) {
  await requireManagementUser();
  const archived = text(formData, "arquivar", 1) !== "0";
  await setEventArchived(text(formData, "id", 50), archived);
  back({ ...origin(formData), aviso: archived ? "arquivado" : "desarquivado" });
}

/** Arquiva de uma vez os concluídos da semana ou do mês que está na tela. */
export async function archiveDoneAction(formData: FormData) {
  await requireManagementUser();
  const count = await archiveDoneBetween(text(formData, "de", 10), text(formData, "ate", 10));
  back({ ...origin(formData), aviso: count ? "arquivados" : "nada-arquivar", total: count ? String(count) : undefined });
}

export async function deleteEventAction(formData: FormData) {
  await requireManagementUser();
  await deleteCalendarEvent(text(formData, "id", 50));
  back({ ...origin(formData), aviso: "excluido" });
}

export async function saveAgendaSettingsAction(formData: FormData) {
  await requireManagementUser();
  const time = (name: string) => { const value = text(formData, name, 5); return isTime(value) ? timeToMinutes(value) : null; };
  const number = (name: string) => Number(text(formData, name, 6));
  const dayStart = time("dayStart");
  const dayEnd = time("dayEnd");
  if (dayStart === null || dayEnd === null) back({ aba: "disponibilidade", erro: "Informe o horário de início e de fim do atendimento." });
  const result = await saveAgendaSettings({
    workDays: formData.getAll("workDays").map((value) => Number(value)),
    dayStart, dayEnd,
    breakStart: time("breakStart"), breakEnd: time("breakEnd"),
    meetingMinutes: number("meetingMinutes"), bufferMinutes: number("bufferMinutes"), minNoticeHours: number("minNoticeHours"), maxDaysAhead: number("maxDaysAhead"),
    meetingFormat: text(formData, "meetingFormat", 300),
    aiBooking: formData.get("aiBooking") === "on",
  });
  if (!result.ok) back({ aba: "disponibilidade", erro: result.error });
  back({ aba: "disponibilidade", aviso: "disponibilidade" });
}
