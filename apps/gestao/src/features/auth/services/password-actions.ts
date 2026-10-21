"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser, revokeOtherSessions } from "@/features/auth/services/auth-session";
import { hashPassword, verifyPassword } from "@/features/auth/services/passwords";
import { logEvent } from "@/features/system-logs/services/system-log";

export type PasswordChangeState = { status: "idle" } | { status: "error"; message: string } | { status: "ok"; message: string };

const MIN_PASSWORD_LENGTH = 8;

/** Troca da própria senha (gestão ou portal do cliente). As outras sessões abertas são encerradas. */
export async function changeOwnPasswordAction(_previous: PasswordChangeState, formData: FormData): Promise<PasswordChangeState> {
  const current = await getAuthenticatedUser();
  if (!current) redirect("/entrar");
  const value = (name: string) => { const field = formData.get(name); return typeof field === "string" ? field.slice(0, 512) : ""; };
  const next = value("next");
  if (next.length < MIN_PASSWORD_LENGTH) return { status: "error", message: `A nova senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.` };
  if (next !== value("confirm")) return { status: "error", message: "A confirmação não é igual à nova senha." };
  const stored = await prisma.user.findUnique({ where: { id: current.user.id }, select: { passwordHash: true } });
  if (!stored || !(await verifyPassword(value("current"), stored.passwordHash))) {
    await logEvent({ level: "warning", event: "auth.password.change_failed", message: "Troca de senha com a senha atual incorreta.", actorEmail: current.user.email });
    return { status: "error", message: "A senha atual não confere." };
  }
  await prisma.user.update({ where: { id: current.user.id }, data: { passwordHash: await hashPassword(next) } });
  await revokeOtherSessions(current.user.id);
  await logEvent({ event: "auth.password.changed", message: `Senha alterada por ${current.user.name}.`, actorEmail: current.user.email });
  return { status: "ok", message: "Senha alterada. Outros aparelhos conectados precisam entrar de novo." };
}
