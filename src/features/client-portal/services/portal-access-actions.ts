"use server";

import { randomInt } from "node:crypto";
import { Prisma, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireManagementUser } from "@/features/auth/services/auth-session";
import { hashPassword } from "@/features/auth/services/passwords";

export type PortalAccessState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "ok"; message: string }
  | { status: "password"; email: string; password: string; created: boolean };

/** Sem caracteres que se confundem (0/O, 1/l/I), para o cliente digitar sem erro. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function temporaryPassword() {
  const group = () => Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return `${group()}-${group()}-${group()}`;
}

function text(formData: FormData, name: string, max: number) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** Acesso do cliente: só contas de cliente vinculadas a este cadastro. */
async function clientAccess(clientId: string, userId: string) {
  return prisma.user.findFirst({ where: { id: userId, clientId, role: UserRole.CLIENT }, select: { id: true, email: true } });
}

function isEmailTaken(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/**
 * Acesso do cliente ao portal, a partir do perfil na gestão: criar a conta com uma senha provisória, gerar uma
 * nova senha, desativar, reativar ou trocar o e-mail. A senha gerada aparece uma única vez, para ser enviada ao cliente.
 */
export async function portalAccessAction(_previous: PortalAccessState, formData: FormData): Promise<PortalAccessState> {
  await requireManagementUser();
  const clientId = text(formData, "clientId", 50);
  const intent = text(formData, "intent", 20);
  const client = clientId ? await prisma.client.findUnique({ where: { id: clientId }, select: { id: true, name: true } }) : null;
  if (!client) return { status: "error", message: "Cliente não encontrado." };
  const profilePath = `/clientes/${client.id}`;

  if (intent === "create") {
    const email = text(formData, "email", 254).toLowerCase();
    if (!EMAIL_PATTERN.test(email)) return { status: "error", message: "Informe um e-mail válido para o acesso." };
    const existing = await prisma.user.findFirst({ where: { clientId: client.id, role: UserRole.CLIENT }, select: { id: true } });
    if (existing) return { status: "error", message: "Este cliente já tem acesso ao portal." };
    const password = temporaryPassword();
    try {
      await prisma.user.create({ data: { name: client.name, email, passwordHash: await hashPassword(password), role: UserRole.CLIENT, clientId: client.id } });
    } catch (error) {
      if (isEmailTaken(error)) return { status: "error", message: "Este e-mail já é usado por outra conta." };
      throw error;
    }
    revalidatePath(profilePath);
    return { status: "password", email, password, created: true };
  }

  const access = await clientAccess(client.id, text(formData, "userId", 50));
  if (!access) return { status: "error", message: "Acesso não encontrado." };

  if (intent === "reset") {
    const password = temporaryPassword();
    // A senha antiga deixa de valer e quem estava conectado precisa entrar de novo.
    await prisma.$transaction([
      prisma.user.update({ where: { id: access.id }, data: { passwordHash: await hashPassword(password), isActive: true } }),
      prisma.authSession.deleteMany({ where: { userId: access.id } }),
    ]);
    revalidatePath(profilePath);
    return { status: "password", email: access.email, password, created: false };
  }

  if (intent === "deactivate" || intent === "activate") {
    const active = intent === "activate";
    await prisma.$transaction([
      prisma.user.update({ where: { id: access.id }, data: { isActive: active } }),
      ...(active ? [] : [prisma.authSession.deleteMany({ where: { userId: access.id } })]),
    ]);
    revalidatePath(profilePath);
    return { status: "ok", message: active ? "Acesso reativado." : "Acesso desativado: o cliente não consegue mais entrar no portal." };
  }

  if (intent === "email") {
    const email = text(formData, "email", 254).toLowerCase();
    if (!EMAIL_PATTERN.test(email)) return { status: "error", message: "Informe um e-mail válido." };
    try {
      await prisma.user.update({ where: { id: access.id }, data: { email } });
    } catch (error) {
      if (isEmailTaken(error)) return { status: "error", message: "Este e-mail já é usado por outra conta." };
      throw error;
    }
    revalidatePath(profilePath);
    return { status: "ok", message: `E-mail de acesso alterado para ${email}.` };
  }

  return { status: "error", message: "Ação inválida." };
}
