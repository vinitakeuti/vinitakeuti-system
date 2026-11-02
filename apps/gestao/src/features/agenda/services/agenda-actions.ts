"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireManagementUser } from "@/features/auth/services/auth-session";
import { createCalendarEvent, deleteCalendarEvent, saveAgendaSettings, setEventStatus, updateCalendarEvent } from "@/features/agenda/services/agenda-service";
import { isDayKey, isMonthKey, isTime, monthOf, timeToMinutes, weekStart } from "@/features/agenda/types/agenda";

/** Ações da tela da Agenda. Voltam para a semana ou o mês de onde vieram, com aviso ou erro. */

const text = (formData: FormData, name: string, max: number) => {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
};

function back(params: Record<string, string | undefined>): never {
  revalidatePath("/agenda");
  const query = new URLSearchParams(Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1])));
  redirect(`/agenda${query.size ? `?${query}` : ""}`);
}

/** Semana do dia, ou o mês quando a ação veio da visão Mês. */
function place(formData: FormData, day: string | undefined, week?: string) {
  if (text(formData, "visao", 5) === "mes") {
    const month = day && isDayKey(day) ? monthOf(day) : text(formData, "mes", 7);
    return { visao: "mes", mes: isMonthKey(month) ? month : undefined };
  }
  return { semana: week ?? (day && isDayKey(day) ? weekStart(day) : undefined) };
}

function eventInput(formData: FormData) {
  return { title: text(formData, "title", 160), kind: text(formData, "kind", 20), day: text(formData, "day", 10), start: text(formData, "start", 5), end: text(formData, "end", 5), description: text(formData, "description", 4_000), location: text(formData, "location", 300), clientId: text(formData, "clientId", 50) || null };
}

export async function createEventAction(formData: FormData) {
  const user = await requireManagementUser();
  const input = eventInput(formData);
  const where = place(formData, input.day);
  const result = await createCalendarEvent({ ...input, source: "gestao", createdBy: user.email });
  if (!result.ok) back({ ...where, novo: "1", erro: result.error, dia: input.day });
  back({ ...where, evento: result.event.id, aviso: result.conflicts.length ? "conflito" : "criado" });
}

export async function updateEventAction(formData: FormData) {
  await requireManagementUser();
  const id = text(formData, "id", 50);
  const input = eventInput(formData);
  const where = place(formData, input.day);
  const result = await updateCalendarEvent(id, input);
  if (!result.ok) back({ ...where, evento: id, editar: "1", erro: result.error });
  back({ ...where, evento: id, aviso: "salvo" });
}

export async function setEventStatusAction(formData: FormData) {
  await requireManagementUser();
  const id = text(formData, "id", 50);
  const status = text(formData, "status", 20);
  const week = text(formData, "semana", 10);
  if (status === "DONE" || status === "CANCELLED" || status === "SCHEDULED") await setEventStatus(id, status);
  back({ ...place(formData, undefined, isDayKey(week) ? week : undefined), evento: status === "CANCELLED" ? undefined : id, aviso: status === "CANCELLED" ? "cancelado" : status === "DONE" ? "concluido" : "reaberto" });
}

export async function deleteEventAction(formData: FormData) {
  await requireManagementUser();
  const week = text(formData, "semana", 10);
  await deleteCalendarEvent(text(formData, "id", 50));
  back({ ...place(formData, undefined, isDayKey(week) ? week : undefined), aviso: "excluido" });
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
