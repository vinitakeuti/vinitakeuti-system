import { createHash, randomBytes } from "node:crypto";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isManagementRole } from "@/features/auth/services/auth-session";
import type { AuthPortal } from "@/features/auth/types/auth";

/**
 * "Esqueci minha senha". O token sai só no link do e-mail (ou no comando de emergência scripts/redefinir-senha.mjs,
 * que repete este formato); o banco guarda o hash SHA-256. Cada link vale 30 minutos e uma única vez.
 */

export const RESET_TOKEN_MINUTES = 30;
/** Pedidos por conta numa hora. Passando disso, o pedido é ignorado em silêncio (a tela responde igual). */
const MAX_REQUESTS_PER_HOUR = 3;
const HOUR_MS = 60 * 60 * 1000;
/** Pedidos vencidos ficam um dia para consulta e depois são apagados. */
const KEEP_EXPIRED_MS = 24 * HOUR_MS;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export const hashResetToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const isResetTokenShape = (token: string) => TOKEN_PATTERN.test(token);

/** A conta pode entrar pelo portal da requisição: gestão para a equipe, área do cliente para clientes com cadastro. */
export function accountFitsPortal(user: { role: UserRole; clientId: string | null }, portal: AuthPortal) {
  if (portal === "management") return isManagementRole(user.role);
  if (portal === "client") return user.role === UserRole.CLIENT && Boolean(user.clientId);
  return false;
}

/** Gera um novo link para a conta, ou null se ela já pediu demais na última hora. */
export async function issuePasswordResetToken(userId: string, now = new Date()) {
  await prisma.passwordResetToken.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - KEEP_EXPIRED_MS) } } });
  const recent = await prisma.passwordResetToken.count({ where: { userId, createdAt: { gt: new Date(now.getTime() - HOUR_MS) } } });
  if (recent >= MAX_REQUESTS_PER_HOUR) return null;
  const token = randomBytes(32).toString("base64url");
  await prisma.passwordResetToken.create({ data: { userId, tokenHash: hashResetToken(token), expiresAt: new Date(now.getTime() + RESET_TOKEN_MINUTES * 60_000) } });
  return token;
}

const resetUserSelect = { id: true, name: true, email: true, role: true, clientId: true, isActive: true, mustChangePassword: true } as const;

/** Pedido válido (existe, não venceu, não foi usado e a conta está ativa), com a conta. */
export async function findValidResetToken(token: string, now = new Date()) {
  if (!isResetTokenShape(token)) return null;
  const found = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashResetToken(token) }, select: { id: true, expiresAt: true, usedAt: true, user: { select: resetUserSelect } } });
  if (!found || found.usedAt || found.expiresAt.getTime() <= now.getTime() || !found.user.isActive) return null;
  return { id: found.id, user: found.user };
}
