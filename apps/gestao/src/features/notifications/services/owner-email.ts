import { prisma } from "@/lib/prisma";
import { emailErrorDetails, sendEmail } from "@/lib/integrations/email";
import { managementUrl } from "@/features/auth/services/auth-host";
import { logEvent } from "@/features/system-logs/services/system-log";
import { renderBrandEmail } from "@/features/notifications/templates/brand-email";
import { emailProfessional } from "@/features/notifications/services/email-outbox";

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

/** Linhas "Rótulo: valor" viram linhas de detalhe; o restante, parágrafos. */
function splitLines(lines: string[]) {
  const details: Array<[string, string]> = [];
  const paragraphs: string[] = [];
  for (const line of lines) {
    const match = /^([^:]{2,32}): (.+)$/.exec(line);
    if (match) details.push([match[1], match[2]]);
    else paragraphs.push(line);
  }
  return { details, paragraphs };
}

/** Aviso para você no layout da marca: título, detalhes, observações e um botão para abrir na gestão. */
async function emailBody({ subject, title, lines, path, footer, critical }: { subject: string; title: string; lines: string[]; path: string; footer: string; critical: boolean }) {
  const { details, paragraphs } = splitLines(lines);
  return renderBrandEmail({
    subject,
    preheader: lines[0] ?? title,
    kicker: critical ? `ALERTA · ${footer.toUpperCase()}` : footer.toUpperCase(),
    title,
    paragraphs,
    details,
    action: { label: "Abrir na gestão", href: managementUrl(path) },
    reason: `Aviso automático da VR Gestão · ${footer}.`,
    professional: await emailProfessional(),
  });
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
    const { html, text } = await emailBody({ subject, title, lines, path, footer, critical });
    const result = await sendEmail({ to, subject, html, text });
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
