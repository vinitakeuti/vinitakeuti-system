"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireManagementUser } from "@/features/auth/services/auth-session";
import { concludeForgottenEvents, createCalendarEvent, deleteCalendarEvent, rescheduleCalendarEvent, saveAgendaSettings, setEventStatus, shiftCalendarEvent, updateCalendarEvent } from "@/features/agenda/services/agenda-service";
import { isDayKey, isMonthKey, isReviewFilter, isTime, monthOf, timeToMinutes, weekStart } from "@/features/agenda/types/agenda";

/** Ações da tela da Agenda. Voltam para a tela de onde vieram (semana, mês ou revisão), com aviso ou erro. */

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
 * A tela de origem, pelo campo `voltar` (semana=…, visao=mes&mes=… ou aba=revisao&mes=…&filtro=…). Com `day`, a semana ou o
 * mês passam a ser os do evento (ao criar ou mudar a data, a tela mostra onde ele ficou).
 */
function origin(formData: FormData, day?: string): Record<string, string | undefined> {
  const query = new URLSearchParams(text(formData, "voltar", 120));
  const month = query.get("mes") ?? "";
  const validMonth = isMonthKey(month) ? month : undefined;
  if (query.get("aba") === "revisao") { const filter = query.get("filtro"); return { aba: "revisao", mes: validMonth, filtro: isReviewFilter(filter) ? filter : undefined }; }
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
  // Na Revisão, a lista segue sem abrir o evento (dá para resolver vários seguidos); nas demais telas, ele fica aberto.
  const where = origin(formData);
  back({ ...where, evento: status === "CANCELLED" || (where.aba === "revisao" && text(formData, "lista", 1) === "1") ? undefined : id, aviso: status === "CANCELLED" ? "cancelado" : status === "DONE" ? "concluido" : "reaberto" });
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

/** Remarca um esquecido para hoje, amanhã ou outra data, no mesmo horário. */
export async function rescheduleEventAction(formData: FormData) {
  await requireManagementUser();
  const result = await rescheduleCalendarEvent(text(formData, "id", 50), text(formData, "dia", 10));
  if (!result.ok) back({ ...origin(formData), erro: result.error });
  back({ ...origin(formData), aviso: result.hasContact ? "remarcado-contato" : result.conflicts ? "remarcado-conflito" : "remarcado", dia: result.day });
}

/** Marca como concluídos, de uma vez, os esquecidos do mês na tela (ou todos). */
export async function concludeForgottenAction(formData: FormData) {
  await requireManagementUser();
  const month = text(formData, "mes", 7);
  const count = await concludeForgottenEvents(isMonthKey(month) ? month : null);
  back({ ...origin(formData), aviso: "esquecidos-concluidos", total: String(count) });
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
