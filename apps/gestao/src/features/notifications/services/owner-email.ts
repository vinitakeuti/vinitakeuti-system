import { prisma } from "@/lib/prisma";
import { emailErrorDetails, sendEmail } from "@/lib/integrations/email";
import { managementUrl } from "@/features/auth/services/auth-host";
import { logEvent } from "@/features/system-logs/services/system-log";

/**
 * E-mails para você (dono da operação): alertas do monitoramento e avisos do portal do cliente.
 * Destinatário: MONITORING_ALERT_EMAIL ou, sem ela, o e-mail do Perfil profissional. Sem SMTP configurado, a falha fica
 * registrada em Configurações (registro de envios e logs), sem interromper quem disparou o envio.
 */
export async function ownerEmailRecipient() {
  const configured = process.env.MONITORING_ALERT_EMAIL?.trim();
  if (configured) return configured;
  const profile = await prisma.professionalProfile.findUnique({ where: { id: "default" }, select: { email: true } });
  return profile?.email?.trim() || null;
}

const escapeHtml = (value: string) => value.replace(/[<>&"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[char]!);

/** Corpo simples: título, linhas de detalhe e um botão para abrir na gestão. */
function emailBody(title: string, lines: string[], path: string, footer: string) {
  const link = managementUrl(path);
  const text = [title, "", ...lines, "", `Abrir na gestão: ${link}`].join("\n");
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#1f1f1f;max-width:560px"><p style="font-size:18px;font-weight:bold;margin:0 0 12px">${escapeHtml(title)}</p>${lines.map((line) => `<p style="margin:0 0 6px">${escapeHtml(line)}</p>`).join("")}<p style="margin:20px 0"><a href="${link}" style="background:#1e3f33;color:#ffffff;padding:10px 16px;text-decoration:none;font-size:13px;letter-spacing:.04em">ABRIR NA GESTÃO</a></p><p style="color:#6b706c;font-size:12px">${escapeHtml(footer)} · VR Gestão</p></div>`;
  return { text, html };
}

/** `kind` identifica o envio no registro de e-mails e prefixa os eventos de log ("monitoring" → monitoring.alert.sent). */
export async function sendOwnerEmail({ kind, footer, subject, title, lines, path, critical = false }: { kind: "monitoring" | "portal" | "payments"; footer: string; subject: string; title: string; lines: string[]; path: string; critical?: boolean }) {
  const to = await ownerEmailRecipient();
  if (!to) {
    await logEvent({ source: "sistema", level: "warning", event: `${kind}.alert.no_recipient`, message: `Alerta não enviado (sem destinatário): ${subject}`, metadata: { hint: "Preencha o e-mail no Perfil profissional ou defina MONITORING_ALERT_EMAIL." } });
    return false;
  }
  const startedAt = Date.now();
  try {
    const result = await sendEmail({ to, subject, ...emailBody(title, lines, path, footer) });
    await prisma.emailLog.create({ data: { kind, status: "SENT", toAddress: to, subject, messageId: result.messageId, response: result.response, durationMs: Date.now() - startedAt } });
    await logEvent({ source: "sistema", level: critical ? "warning" : "info", event: `${kind}.alert.sent`, message: `Alerta enviado: ${subject}` });
    return true;
  } catch (error) {
    const detail = emailErrorDetails(error);
    await prisma.emailLog.create({ data: { kind, status: "FAILED", toAddress: to, subject, error: detail, durationMs: Date.now() - startedAt } });
    await logEvent({ source: "sistema", level: "error", event: `${kind}.alert.failed`, message: `Falha ao enviar alerta: ${subject}`, metadata: { error: detail } });
    return false;
  }
}
