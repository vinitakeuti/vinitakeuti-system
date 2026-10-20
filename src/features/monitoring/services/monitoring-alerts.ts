import { prisma } from "@/lib/prisma";
import { emailErrorDetails, sendEmail } from "@/lib/integrations/email";
import { managementUrl } from "@/features/auth/services/auth-host";
import { logEvent } from "@/features/system-logs/services/system-log";

/**
 * E-mails do monitoramento. Destinatário: MONITORING_ALERT_EMAIL ou, sem ela, o e-mail do Perfil profissional.
 * Sem SMTP configurado, a falha fica registrada em Configurações (registro de envios e logs), sem interromper a verificação.
 */
export async function alertRecipient() {
  const configured = process.env.MONITORING_ALERT_EMAIL?.trim();
  if (configured) return configured;
  const profile = await prisma.professionalProfile.findUnique({ where: { id: "default" }, select: { email: true } });
  return profile?.email?.trim() || null;
}

const escapeHtml = (value: string) => value.replace(/[<>&"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[char]!);

/** Corpo simples: título, linhas de detalhe e um botão para abrir na gestão. */
function emailBody(title: string, lines: string[], path: string) {
  const link = managementUrl(path);
  const text = [title, "", ...lines, "", `Abrir na gestão: ${link}`].join("\n");
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#1f1f1f;max-width:560px"><p style="font-size:18px;font-weight:bold;margin:0 0 12px">${escapeHtml(title)}</p>${lines.map((line) => `<p style="margin:0 0 6px">${escapeHtml(line)}</p>`).join("")}<p style="margin:20px 0"><a href="${link}" style="background:#1e3f33;color:#ffffff;padding:10px 16px;text-decoration:none;font-size:13px;letter-spacing:.04em">ABRIR NA GESTÃO</a></p><p style="color:#6b706c;font-size:12px">Monitoramento · VR Gestão</p></div>`;
  return { text, html };
}

export async function sendMonitoringEmail({ subject, title, lines, path, critical = false }: { subject: string; title: string; lines: string[]; path: string; critical?: boolean }) {
  const to = await alertRecipient();
  if (!to) {
    await logEvent({ source: "sistema", level: "warning", event: "monitoring.alert.no_recipient", message: `Alerta não enviado (sem destinatário): ${subject}`, metadata: { hint: "Preencha o e-mail no Perfil profissional ou defina MONITORING_ALERT_EMAIL." } });
    return false;
  }
  const startedAt = Date.now();
  try {
    const result = await sendEmail({ to, subject, ...emailBody(title, lines, path) });
    await prisma.emailLog.create({ data: { kind: "monitoring", status: "SENT", toAddress: to, subject, messageId: result.messageId, response: result.response, durationMs: Date.now() - startedAt } });
    await logEvent({ source: "sistema", level: critical ? "warning" : "info", event: "monitoring.alert.sent", message: `Alerta enviado: ${subject}` });
    return true;
  } catch (error) {
    const detail = emailErrorDetails(error);
    await prisma.emailLog.create({ data: { kind: "monitoring", status: "FAILED", toAddress: to, subject, error: detail, durationMs: Date.now() - startedAt } });
    await logEvent({ source: "sistema", level: "error", event: "monitoring.alert.failed", message: `Falha ao enviar alerta: ${subject}`, metadata: { error: detail } });
    return false;
  }
}

/** "17 min", "2 h 05 min", "3 dias". */
export function formatDuration(ms: number) {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h${minutes % 60 ? ` ${String(minutes % 60).padStart(2, "0")} min` : ""}`;
  return `${Math.round(hours / 24)} dias`;
}
