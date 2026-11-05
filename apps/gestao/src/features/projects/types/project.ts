import type { ProjectStatus, ProjectTaskStatus } from "@prisma/client";

/** Rótulos, pesos e limites do gestor de projetos (compartilhados entre telas, serviços e a Eliza). */

export const PROJECT_LIMITS = { features: 60, tasks: 600, tasksPerFeature: 80, title: 160, description: 4_000, prompt: 30_000, summary: 4_000 } as const;

export const projectStatusLabel: Record<ProjectStatus, string> = {
  LEAD: "Prospecção",
  PROPOSAL: "Proposta",
  PLANNING: "Planejamento",
  IN_PROGRESS: "Em execução",
  WAITING_CLIENT: "Aguardando cliente",
  DELIVERED: "Entregue",
  PAUSED: "Pausado",
  CANCELLED: "Cancelado",
};

/** Situações que a tela oferece; Prospecção e Proposta só aparecem quando o projeto já está nelas. */
export const PROJECT_STATUS_OPTIONS = ["PLANNING", "IN_PROGRESS", "WAITING_CLIENT", "PAUSED", "DELIVERED", "CANCELLED"] as const satisfies readonly ProjectStatus[];
export const ACTIVE_PROJECT_STATUSES = ["LEAD", "PROPOSAL", "PLANNING", "IN_PROGRESS", "WAITING_CLIENT", "PAUSED"] as const satisfies readonly ProjectStatus[];

export const taskStatusLabel: Record<ProjectTaskStatus, string> = {
  TODO: "A fazer",
  DOING: "Fazendo",
  WAITING_CLIENT: "Aguardando cliente",
  BLOCKED: "Bloqueada",
  DONE: "Feita",
};
export const TASK_STATUS_OPTIONS = ["TODO", "DOING", "WAITING_CLIENT", "BLOCKED", "DONE"] as const satisfies readonly ProjectTaskStatus[];

/** Peso das subatividades: pequena (até umas 2 h), média (meio dia a um dia) e grande (mais de um dia). */
export const TASK_SIZES = [
  { id: "P", weight: 1, label: "Pequena" },
  { id: "M", weight: 3, label: "Média" },
  { id: "G", weight: 8, label: "Grande" },
] as const;
export type TaskSize = (typeof TASK_SIZES)[number]["id"];

export function weightOfSize(size: string) {
  return TASK_SIZES.find((item) => item.id === size)?.weight ?? 3;
}

export function sizeOfWeight(weight: number): TaskSize {
  return weight <= 1 ? "P" : weight <= 3 ? "M" : "G";
}

/** Percentual inteiro, arredondado para baixo: só mostra 100% quando tudo estiver concluído. */
export function percentOf(done: number, total: number) {
  return total > 0 ? Math.min(100, Math.floor((done * 100) / total)) : 0;
}

const isoDay = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Maceio" });

/** Hoje no fuso de Brasília, AAAA-MM-DD. */
export const todayKey = () => isoDay.format(new Date());
export const dayKeyOf = (date: Date) => isoDay.format(date);
export const isDayKey = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());

/** Início e fim (exclusivo) de um dia de Brasília, para filtrar instantes. */
export function dayRange(day: string) {
  const start = new Date(`${day}T00:00:00.000-03:00`);
  return { gte: start, lt: new Date(start.getTime() + 86_400_000) };
}

/** Coluna DATE do banco: meia-noite UTC do dia. */
export const dayColumn = (day: string) => new Date(`${day}T00:00:00.000Z`);

/** Minutos a partir de "1,5" ou "2" (horas). Vazio ou inválido: null. */
export function minutesFromHours(value: string) {
  const hours = Number(value.trim().replace(",", "."));
  return value.trim() && Number.isFinite(hours) && hours > 0 && hours <= 24 ? Math.round(hours * 60) : null;
}

export function hoursLabel(minutes: number) {
  const hours = minutes / 60;
  return `${hours.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`;
}
