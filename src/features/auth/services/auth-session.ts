import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AuthenticatedUser, SessionAudience } from "@/features/auth/types/auth";
import { AUTH_SESSION_COOKIE, createSessionToken, readSessionToken } from "@/features/auth/services/session-token";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const managementRoles = new Set<UserRole>([UserRole.PROFESSIONAL, UserRole.COMMERCIAL, UserRole.MARKETING, UserRole.AFFILIATE, UserRole.ACCOUNTANT]);

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  clientId: true,
  isActive: true,
} as const;

export function isManagementRole(role: UserRole) {
  return managementRoles.has(role);
}

export function sessionAudienceForRole(role: UserRole): SessionAudience {
  return isManagementRole(role) ? "management" : "client";
}

export async function getAuthenticatedUser(): Promise<{ user: AuthenticatedUser; audience: SessionAudience } | null> {
  const cookieStore = await cookies();
  const payload = await readSessionToken(cookieStore.get(AUTH_SESSION_COOKIE)?.value);
  if (!payload) return null;

  const session = await prisma.authSession.findUnique({
    where: { id: payload.sessionId },
    select: { expiresAt: true, user: { select: userSelect } },
  });
  if (!session || session.expiresAt.getTime() <= Date.now() || !session.user.isActive) return null;

  const { isActive: _, ...user } = session.user;
  return { user, audience: payload.audience };
}

export async function createAuthenticatedSession(user: AuthenticatedUser) {
  const audience = sessionAudienceForRole(user.role);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1_000);
  const session = await prisma.authSession.create({ data: { userId: user.id, expiresAt } });
  const token = await createSessionToken({ sessionId: session.id, expiresAt: expiresAt.getTime(), audience });
  const cookieStore = await cookies();
  cookieStore.set(AUTH_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroyAuthenticatedSession() {
  const cookieStore = await cookies();
  const payload = await readSessionToken(cookieStore.get(AUTH_SESSION_COOKIE)?.value);
  if (payload) await prisma.authSession.deleteMany({ where: { id: payload.sessionId } });
  cookieStore.delete(AUTH_SESSION_COOKIE);
}

export async function requireManagementUser() {
  const current = await getAuthenticatedUser();
  if (!current || current.audience !== "management" || !isManagementRole(current.user.role)) redirect("/entrar?erro=acesso");
  return current.user;
}

export async function requireClientUser() {
  const current = await getAuthenticatedUser();
  if (!current || current.audience !== "client" || current.user.role !== UserRole.CLIENT || !current.user.clientId) redirect("/entrar?erro=acesso");
  return current.user;
}

/** Encerra as outras sessões do usuário (outros navegadores e aparelhos), mantendo a atual. */
export async function revokeOtherSessions(userId: string) {
  const cookieStore = await cookies();
  const payload = await readSessionToken(cookieStore.get(AUTH_SESSION_COOKIE)?.value);
  await prisma.authSession.deleteMany({ where: { userId, ...(payload ? { id: { not: payload.sessionId } } : {}) } });
}
