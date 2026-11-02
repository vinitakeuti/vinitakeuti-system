import { after } from "next/server";
import { Prisma, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { emailErrorDetails, sendEmail } from "@/lib/integrations/email";
import { logEvent } from "@/features/system-logs/services/system-log";
import { getProfessionalProfile } from "@/features/professional-profile/queries/professional-profile-queries";
import { BRAND_TITLE } from "@/features/professional-profile/types/brand";
import type { EmailProfessional } from "@/features/notifications/templates/brand-email";

/**
 * Fila dos e-mails para clientes. Quem dispara só grava a mensagem; o envio acontece logo depois da resposta (after)
 * e, se falhar, de novo no ciclo do agendador (a cada minuto), até 3 tentativas. Enviado ou abandonado, o corpo é
 * apagado (a mensagem de acesso leva a senha provisória); o resultado de cada tentativa fica no registro de envios.
 */

const MAX_ATTEMPTS = 3;
const RETRY_AFTER_MS = [5 * 60_000, 30 * 60_000];
const STUCK_AFTER_MS = 10 * 60_000;
const BATCH = 20;

/** Assinatura dos e-mails: nome, título e contato do Perfil profissional. */
export async function emailProfessional(): Promise<EmailProfessional> {
  const profile = await getProfessionalProfile();
  return { name: profile?.name?.trim() || "Vinicius Riudi", title: BRAND_TITLE, email: profile?.email, phone: profile?.phone, website: profile?.website };
}

/** O cliente recebe e-mails no endereço do acesso ativo ao portal: todo e-mail leva para lá. Sem acesso, nada é enviado. */
export async function clientRecipient(clientId: string) {
  const user = await prisma.user.findFirst({ where: { clientId, role: UserRole.CLIENT, isActive: true }, orderBy: { createdAt: "asc" }, select: { email: true, client: { select: { name: true } } } });
  return user ? { email: user.email, firstName: firstName(user.client?.name ?? "") } : null;
}

export function firstName(name: string) {
  const first = name.trim().split(/\s+/)[0] ?? "";
  return first ? `${first.charAt(0).toUpperCase()}${first.slice(1).toLowerCase()}` : "";
}

/** Inicia o envio depois da resposta. Fora de uma requisição (agendador), quem envia é o próprio ciclo. */
function deliverSoon() {
  try { after(() => deliverEmailOutbox()); } catch { /* sem requisição em andamento */ }
}

/** Grava a mensagem na fila. Com `dedupeKey`, a mesma mensagem não é gravada duas vezes. Devolve se entrou na fila. */
export async function enqueueEmail({ kind, to, clientId, dedupeKey, email }: { kind: string; to: string; clientId?: string | null; dedupeKey?: string; email: { subject: string; html: string; text: string } }) {
  try {
    await prisma.emailOutbox.create({ data: { kind, toAddress: to, clientId: clientId ?? null, dedupeKey: dedupeKey ?? null, subject: email.subject.slice(0, 300), html: email.html, text: email.text } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return false;
    throw error;
  }
  deliverSoon();
  return true;
}

/** Envia o que está na fila e venceu o horário. Chamado depois das requisições e pelo agendador. */
export async function deliverEmailOutbox(now = new Date()) {
  // Envio interrompido no meio (processo reiniciado): volta para a fila.
  await prisma.emailOutbox.updateMany({ where: { status: "SENDING", sendAfter: { lt: new Date(now.getTime() - STUCK_AFTER_MS) } }, data: { status: "PENDING" } });
  const due = await prisma.emailOutbox.findMany({ where: { status: "PENDING", sendAfter: { lte: now } }, orderBy: [{ sendAfter: "asc" }, { id: "asc" }], take: BATCH, select: { id: true } });
  let sent = 0;
  for (const { id } of due) {
    const claimed = await prisma.emailOutbox.updateMany({ where: { id, status: "PENDING" }, data: { status: "SENDING", sendAfter: new Date(), attempts: { increment: 1 } } });
    if (!claimed.count) continue;
    const message = await prisma.emailOutbox.findUnique({ where: { id }, select: { kind: true, toAddress: true, subject: true, html: true, text: true, attempts: true } });
    if (!message) continue;
    const startedAt = Date.now();
    try {
      const result = await sendEmail({ to: message.toAddress, subject: message.subject, html: message.html, text: message.text });
      await prisma.emailOutbox.update({ where: { id }, data: { status: "SENT", sentAt: new Date(), lastError: null, html: "", text: "" } });
      await prisma.emailLog.create({ data: { kind: message.kind, status: "SENT", toAddress: message.toAddress, subject: message.subject, messageId: result.messageId, response: result.response, durationMs: Date.now() - startedAt } });
      sent += 1;
    } catch (error) {
      const detail = emailErrorDetails(error);
      const gaveUp = message.attempts >= MAX_ATTEMPTS;
      await prisma.emailOutbox.update({ where: { id }, data: gaveUp ? { status: "FAILED", lastError: detail, html: "", text: "" } : { status: "PENDING", lastError: detail, sendAfter: new Date(Date.now() + RETRY_AFTER_MS[message.attempts - 1]) } });
      await prisma.emailLog.create({ data: { kind: message.kind, status: "FAILED", toAddress: message.toAddress, subject: message.subject, error: `${gaveUp ? "Envio abandonado depois de 3 tentativas" : `Tentativa ${message.attempts} de ${MAX_ATTEMPTS}`}: ${detail}`.slice(0, 1_000), durationMs: Date.now() - startedAt } });
      if (gaveUp) await logEvent({ source: "sistema", level: "error", event: "email.client.failed", message: `E-mail para cliente não enviado: ${message.subject}`, metadata: { to: message.toAddress, error: detail } });
    }
  }
  return sent;
}
