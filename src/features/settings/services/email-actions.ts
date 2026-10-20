"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireManagementUser } from "@/features/auth/services/auth-session";
import { emailErrorDetails, sendEmail, verifyEmailConnection } from "@/lib/integrations/email";
import { logEvent } from "@/features/system-logs/services/system-log";

export type EmailTestState = { status: "idle" } | { status: "ok"; message: string; detail: string | null } | { status: "error"; message: string; detail: string | null };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(formData: FormData, name: string, max: number) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** Envia um e-mail de teste e registra o resultado (resposta do servidor ou o motivo da falha). */
export async function sendTestEmailAction(_previous: EmailTestState, formData: FormData): Promise<EmailTestState> {
  const actor = await requireManagementUser();
  const to = text(formData, "to", 254).toLowerCase();
  const subject = text(formData, "subject", 160) || "Teste de envio · VR Gestão";
  const body = text(formData, "message", 2_000) || "Este é um e-mail de teste enviado pelas Configurações da VR Gestão.";
  if (!EMAIL_PATTERN.test(to)) return { status: "error", message: "Informe um destinatário válido.", detail: null };

  const startedAt = Date.now();
  try {
    const result = await sendEmail({ to, subject, text: body, html: `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#1f1f1f"><p>${body.replace(/[<>&]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[char]!).replace(/\n/g, "<br>")}</p><p style="color:#6b706c;font-size:12px">Enviado pela VR Gestão · ${new Date().toLocaleString("pt-BR", { timeZone: "America/Maceio" })}</p></div>` });
    const durationMs = Date.now() - startedAt;
    const detail = [result.response, result.rejected.length ? `recusados: ${result.rejected.join(", ")}` : null].filter(Boolean).join(" · ") || null;
    await prisma.emailLog.create({ data: { kind: "test", status: "SENT", toAddress: to, subject, messageId: result.messageId, response: detail, durationMs, actorEmail: actor.email } });
    await logEvent({ event: "email.test.sent", message: `E-mail de teste enviado para ${to}.`, actorEmail: actor.email, metadata: { messageId: result.messageId, durationMs } });
    revalidatePath("/configuracoes");
    return { status: "ok", message: `Enviado para ${to} em ${durationMs} ms.`, detail };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const detail = emailErrorDetails(error);
    await prisma.emailLog.create({ data: { kind: "test", status: "FAILED", toAddress: to, subject, error: detail, durationMs, actorEmail: actor.email } });
    await logEvent({ level: "error", event: "email.test.failed", message: `Falha ao enviar e-mail de teste para ${to}.`, actorEmail: actor.email, metadata: { error: detail, durationMs } });
    revalidatePath("/configuracoes");
    return { status: "error", message: "O envio falhou.", detail };
  }
}

/** Testa conexão e login no servidor SMTP, sem enviar e-mail. */
export async function verifyEmailConnectionAction(_previous: EmailTestState): Promise<EmailTestState> {
  const actor = await requireManagementUser();
  const startedAt = Date.now();
  try {
    const detail = await verifyEmailConnection();
    const durationMs = Date.now() - startedAt;
    await prisma.emailLog.create({ data: { kind: "verify", status: "SENT", toAddress: "—", subject: "Teste de conexão SMTP", response: detail, durationMs, actorEmail: actor.email } });
    await logEvent({ event: "email.smtp.verified", message: "Conexão SMTP verificada.", actorEmail: actor.email, metadata: { durationMs } });
    revalidatePath("/configuracoes");
    return { status: "ok", message: `Conexão aceita em ${durationMs} ms.`, detail };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const detail = emailErrorDetails(error);
    await prisma.emailLog.create({ data: { kind: "verify", status: "FAILED", toAddress: "—", subject: "Teste de conexão SMTP", error: detail, durationMs, actorEmail: actor.email } });
    await logEvent({ level: "error", event: "email.smtp.failed", message: "Falha na conexão SMTP.", actorEmail: actor.email, metadata: { error: detail, durationMs } });
    revalidatePath("/configuracoes");
    return { status: "error", message: "A conexão falhou.", detail };
  }
}
