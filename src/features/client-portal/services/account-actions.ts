"use server";

import { prisma } from "@/lib/prisma";
import { requireClientUser, revokeOtherSessions } from "@/features/auth/services/auth-session";
import { hashPassword, verifyPassword } from "@/features/auth/services/passwords";

export type PasswordChangeState = { status: "idle" } | { status: "error"; message: string } | { status: "ok"; message: string };

const MIN_PASSWORD_LENGTH = 8;

/** O cliente troca a própria senha no portal (por exemplo, a provisória do primeiro acesso). */
export async function changePortalPasswordAction(_previous: PasswordChangeState, formData: FormData): Promise<PasswordChangeState> {
  const user = await requireClientUser();
  const value = (name: string) => { const field = formData.get(name); return typeof field === "string" ? field.slice(0, 512) : ""; };
  const current = value("current");
  const next = value("next");
  if (next.length < MIN_PASSWORD_LENGTH) return { status: "error", message: `A nova senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.` };
  if (next !== value("confirm")) return { status: "error", message: "A confirmação não é igual à nova senha." };
  const stored = await prisma.user.findUnique({ where: { id: user.id }, select: { passwordHash: true } });
  if (!stored || !(await verifyPassword(current, stored.passwordHash))) return { status: "error", message: "A senha atual não confere." };
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next) } });
  await revokeOtherSessions(user.id);
  return { status: "ok", message: "Senha alterada. Outros aparelhos conectados precisam entrar de novo." };
}
