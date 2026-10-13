import type { MonitoringStatus } from "@prisma/client";

export const monitoringStatusLabel: Record<MonitoringStatus, string> = { OPERATIONAL: "Operacional", DEGRADED: "Degradado", DOWN: "Indisponível", UNKNOWN: "Não verificado" };
export const monitoringStatusClass: Record<MonitoringStatus, string> = { OPERATIONAL: "operational", DEGRADED: "degraded", DOWN: "down", UNKNOWN: "unknown" };

export const monitoringEnvironments = [
  { value: "production", label: "Produção" },
  { value: "staging", label: "Staging" },
  { value: "development", label: "Desenvolvimento" },
] as const;

export function monitoringEnvironmentLabel(value: string) {
  return monitoringEnvironments.find((environment) => environment.value === value)?.label ?? value;
}
