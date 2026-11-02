/**
 * Agenda no horário de Brasília (UTC−3, sem horário de verão desde 2019). Datas trafegam como AAAA-MM-DD e horas
 * como HH:MM; no banco, tudo em UTC.
 */

export const EVENT_KINDS = { MEETING: "Reunião", APPOINTMENT: "Compromisso", REMINDER: "Lembrete" } as const;
export type EventKind = keyof typeof EVENT_KINDS;
export const isEventKind = (value: string): value is EventKind => Object.hasOwn(EVENT_KINDS, value);

export const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"] as const;
export const WEEKDAYS_SHORT = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"] as const;

const OFFSET = "-03:00";
const DAY_MS = 24 * 60 * 60 * 1000;
const isoDay = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Maceio" });
const hourMinute = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "America/Maceio" });

export const isDayKey = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T12:00:00${OFFSET}`).getTime());
export const isTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

/** Dia (AAAA-MM-DD) de uma data, no horário de Brasília. */
export const dayKey = (date: Date) => isoDay.format(date);
/** HH:MM de uma data, no horário de Brasília. */
export const timeOf = (date: Date) => hourMinute.format(date);
export const todayKey = () => dayKey(new Date());

/** Data em UTC a partir do dia e dos minutos desde a meia-noite (horário de Brasília). */
export function atMinutes(day: string, minutes: number) {
  const hours = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mins = String(minutes % 60).padStart(2, "0");
  return new Date(`${day}T${hours}:${mins}:00${OFFSET}`);
}

export function atTime(day: string, time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return atMinutes(day, hours * 60 + minutes);
}

export const minutesToTime = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
export const timeToMinutes = (time: string) => { const [hours, minutes] = time.split(":").map(Number); return hours * 60 + minutes; };

/** Soma dias a um dia (AAAA-MM-DD). */
export function addDays(day: string, amount: number) {
  return dayKey(new Date(new Date(`${day}T12:00:00${OFFSET}`).getTime() + amount * DAY_MS));
}

/** Dia da semana (0 = domingo) de um dia AAAA-MM-DD. */
export const weekdayOf = (day: string) => new Date(`${day}T12:00:00${OFFSET}`).getUTCDay();

/** Segunda-feira da semana do dia. */
export function weekStart(day: string) {
  const weekday = weekdayOf(day);
  return addDays(day, weekday === 0 ? -6 : 1 - weekday);
}

const longDay = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long", timeZone: "America/Maceio" });
/** "segunda-feira, 10 de novembro". */
export const longDayLabel = (day: string) => longDay.format(new Date(`${day}T12:00:00${OFFSET}`));
