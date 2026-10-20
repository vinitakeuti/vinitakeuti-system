import { sendOwnerEmail } from "@/features/notifications/services/owner-email";

/** Alerta do monitoramento por e-mail, para MONITORING_ALERT_EMAIL ou o e-mail do Perfil profissional. */
export async function sendMonitoringEmail(message: { subject: string; title: string; lines: string[]; path: string; critical?: boolean }) {
  return sendOwnerEmail({ kind: "monitoring", footer: "Monitoramento", ...message });
}

/** "17 min", "2 h 05 min", "3 dias". */
export function formatDuration(ms: number) {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h${minutes % 60 ? ` ${String(minutes % 60).padStart(2, "0")} min` : ""}`;
  return `${Math.round(hours / 24)} dias`;
}
