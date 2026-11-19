"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { emailConfigStatus } from "@/lib/integrations/email";
import { clientPortalUrl, managementUrl, portalForRequest, requestHost } from "@/features/auth/services/auth-host";
import { createAuthenticatedSession } from "@/features/auth/services/auth-session";
import { hashPassword } from "@/features/auth/services/passwords";
import { accountFitsPortal, findValidResetToken, issuePasswordResetToken, RESET_TOKEN_MINUTES } from "@/features/auth/services/password-reset";
import { isAuthSecretConfigured } from "@/features/auth/services/session-token";
import type { SessionAudience } from "@/features/auth/types/auth";
import { passwordResetEmail } from "@/features/notifications/services/account-emails";
import { emailProfessional, enqueueEmail, firstName } from "@/features/notifications/services/email-outbox";
import { logEvent } from "@/features/system-logs/services/system-log";

export type PasswordResetState = { status: "idle" } | { status: "error"; message: string };

const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SENT = "/esqueci-senha?enviado=1";

function field(formData: FormData, name: string, max: number) {
  const value = formData.get(name);
  return typeof value === "string" ? value.slice(0, max) : "";
}

/**
 * Link do e-mail. Em produção, sempre o domínio configurado do portal (nunca o Host da requisição, que pode ser
 * forjado para desviar o link); em desenvolvimento, o endereço local em uso.
 */
function resetLink(portal: SessionAudience, token: string, host: string | null) {
  const path = `/redefinir-senha?token=${token}`;
  if (process.env.NODE_ENV === "production") return portal === "client" ? `${clientPortalUrl()}${path}` : managementUrl(path);
  return `http://${host || "localhost:3000"}${path}`;
}

/**
 * "Esqueci minha senha": se o e-mail for de uma conta ativa deste portal, gera o link e põe o e-mail na fila. A
 * resposta é sempre a mesma, exista a conta ou não, para a tela não revelar quais e-mails têm acesso.
 */
export async function requestPasswordResetAction(formData: FormData) {
  const requestHeaders = await headers();
  const portal = portalForRequest(requestHeaders);
  if (portal === "landing") redirect("/");
  const email = field(formData, "email", 254).trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) redirect("/esqueci-senha?erro=email");
  if (!emailConfigStatus().configured) redirect("/esqueci-senha");

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, email: true, role: true, clientId: true, isActive: true } });
  if (!user || !user.isActive || !accountFitsPortal(user, portal)) {
    await logEvent({ level: "warning", event: "auth.password.reset_ignored", message: !user ? "Redefinição de senha pedida para e-mail não cadastrado." : !user.isActive ? "Redefinição de senha pedida para conta desativada." : "Redefinição de senha pedida num portal sem acesso para a conta.", actorEmail: email });
    redirect(SENT);
  }

  const token = await issuePasswordResetToken(user.id);
  if (!token) {
    await logEvent({ level: "warning", event: "auth.password.reset_throttled", message: "Pedidos de redefinição de senha demais na última hora; o novo foi ignorado.", actorEmail: user.email });
    redirect(SENT);
  }

  const client = portal === "client";
  try {
    const message = passwordResetEmail({ name: firstName(user.name), email: user.email, link: resetLink(portal, token, requestHost(requestHeaders)), minutes: RESET_TOKEN_MINUTES, client, professional: await emailProfessional() });
    await enqueueEmail({ kind: "auth.password_reset", to: user.email, clientId: user.clientId, email: message });
    await logEvent({ event: "auth.password.reset_requested", message: `Link de redefinição de senha enviado para ${user.name}.`, actorEmail: user.email });
  } catch (error) {
    await logEvent({ source: "sistema", level: "error", event: "auth.password.reset_enqueue_failed", message: `E-mail de redefinição de senha não entrou na fila: ${error instanceof Error ? error.message : String(error)}`.slice(0, 500), actorEmail: user.email });
  }
  redirect(SENT);
}

/**
 * Nova senha pelo link. O pedido é marcado como usado na mesma transação que troca a senha (dois envios do mesmo
 * link não passam os dois); os outros pedidos e todas as sessões da conta são apagados, e a pessoa já entra.
 */
export async function resetPasswordAction(_previous: PasswordResetState, formData: FormData): Promise<PasswordResetState> {
  const requestHeaders = await headers();
  const portal = portalForRequest(requestHeaders);
  if (portal === "landing") redirect("/");
  const token = field(formData, "token", 100);
  const next = field(formData, "next", 512);
  if (next.length < MIN_PASSWORD_LENGTH) return { status: "error", message: `A nova senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.` };
  if (next !== field(formData, "confirm", 512)) return { status: "error", message: "A confirmação não é igual à nova senha." };
  if (!isAuthSecretConfigured()) return { status: "error", message: "O acesso ainda não foi configurado. Defina AUTH_SECRET no ambiente do sistema." };

  const found = await findValidResetToken(token);
  if (!found || !accountFitsPortal(found.user, portal)) redirect("/redefinir-senha");
  const { user } = found;
  const now = new Date();
  const passwordHash = await hashPassword(next);
  const done = await prisma.$transaction(async (tx) => {
    const claimed = await tx.passwordResetToken.updateMany({ where: { id: found.id, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } });
    if (claimed.count !== 1) return false;
    await tx.user.update({ where: { id: user.id }, data: { passwordHash, mustChangePassword: false, lastLoginAt: now } });
    await tx.passwordResetToken.deleteMany({ where: { userId: user.id, id: { not: found.id } } });
    await tx.authSession.deleteMany({ where: { userId: user.id } });
    return true;
  });
  if (!done) redirect("/redefinir-senha");

  await createAuthenticatedSession({ id: user.id, name: user.name, email: user.email, role: user.role, clientId: user.clientId, mustChangePassword: false });
  await logEvent({ event: "auth.password.reset_completed", message: `Senha redefinida pelo link por ${user.name}. As outras sessões foram encerradas.`, actorEmail: user.email });
  redirect("/");
}
