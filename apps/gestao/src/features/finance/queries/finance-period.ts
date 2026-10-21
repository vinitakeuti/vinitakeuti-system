/** Atalhos de período do Financeiro. Os dias são civis, no fuso da operação. */
export type FinancePeriodKey = "hoje" | "ontem" | "7d" | "mes" | "tudo" | "personalizado";

export const FINANCE_PERIOD_SHORTCUTS: Array<{ key: Exclude<FinancePeriodKey, "personalizado">; label: string }> = [
  { key: "hoje", label: "HOJE" },
  { key: "ontem", label: "ONTEM" },
  { key: "7d", label: "7 DIAS" },
  { key: "mes", label: "MÊS" },
  { key: "tudo", label: "TUDO" },
];

const isoDay = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Maceio" });

function shift(day: string, days: number) {
  const date = new Date(`${day}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function validDay(value?: string) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

export function financePeriodRange(key: Exclude<FinancePeriodKey, "personalizado" | "tudo">, now = new Date()) {
  const today = isoDay.format(now);
  if (key === "hoje") return { from: today, to: today };
  if (key === "ontem") return { from: shift(today, -1), to: shift(today, -1) };
  if (key === "7d") return { from: shift(today, -6), to: today };
  const [year, month] = today.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from: `${today.slice(0, 7)}-01`, to: `${today.slice(0, 7)}-${String(lastDay).padStart(2, "0")}` };
}

/**
 * Período em uso: datas escolhidas no filtro, um atalho (`periodo`) ou, sem nada informado, o mês atual.
 * `tudo` remove o limite de datas.
 */
export function resolveFinancePeriod(params: { periodo?: string; from?: string; to?: string }, now = new Date()): { key: FinancePeriodKey; from?: string; to?: string } {
  const from = validDay(params.from);
  const to = validDay(params.to);
  if (from || to) {
    const match = (["hoje", "ontem", "7d", "mes"] as const).find((key) => { const range = financePeriodRange(key, now); return range.from === from && range.to === to; });
    return { key: match ?? "personalizado", from, to };
  }
  if (params.periodo === "tudo") return { key: "tudo" };
  const key = params.periodo === "hoje" || params.periodo === "ontem" || params.periodo === "7d" ? params.periodo : "mes";
  return { key, ...financePeriodRange(key, now) };
}

export function financePeriodLabel(period: { key: FinancePeriodKey; from?: string; to?: string }) {
  const format = (value: string) => { const [year, month, day] = value.split("-"); return `${day}/${month}/${year}`; };
  const prefix = period.key === "hoje" ? "HOJE · " : period.key === "ontem" ? "ONTEM · " : period.key === "7d" ? "ÚLTIMOS 7 DIAS · " : period.key === "mes" ? "MÊS ATUAL · " : "";
  if (period.from && period.to) return period.from === period.to ? `${prefix}${format(period.from)}` : `${prefix}${format(period.from)} ATÉ ${format(period.to)}`;
  if (period.from) return `A PARTIR DE ${format(period.from)}`;
  if (period.to) return `ATÉ ${format(period.to)}`;
  return "TODO O HISTÓRICO";
}
