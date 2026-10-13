"use server";

import { UserRole } from "@prisma/client";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getAuthPortal } from "@/features/auth/services/auth-host";
import { createAuthenticatedSession, destroyAuthenticatedSession, isManagementRole } from "@/features/auth/services/auth-session";
import { hashPassword, verifyPassword } from "@/features/auth/services/passwords";
import { isAuthSecretConfigured } from "@/features/auth/services/session-token";

type LoginError = "credenciais" | "acesso" | "configuracao";
const LOCAL_TEST_ACCOUNT = {
  name: "Conta de teste",
  email: "teste@vinitakeuti.com",
  password: "Teste@Gestao2026",
};

function loginRedirect(error: LoginError): never {
  redirect(`/entrar?erro=${error}`);
}

function formText(formData: FormData, name: string, maxLength: number) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function passwordText(formData: FormData) {
  const value = formData.get("password");
  return typeof value === "string" ? value.slice(0, 512) : "";
}

async function ensureLocalTestAccount() {
  if (process.env.NODE_ENV === "production") return;
  await prisma.user.upsert({
    where: { email: LOCAL_TEST_ACCOUNT.email },
    update: { name: LOCAL_TEST_ACCOUNT.name, passwordHash: await hashPassword(LOCAL_TEST_ACCOUNT.password), role: UserRole.PROFESSIONAL, clientId: null, isActive: true },
    create: { name: LOCAL_TEST_ACCOUNT.name, email: LOCAL_TEST_ACCOUNT.email, passwordHash: await hashPassword(LOCAL_TEST_ACCOUNT.password), role: UserRole.PROFESSIONAL },
  });
}

export async function loginAction(formData: FormData) {
  const requestHeaders = await headers();
  const portal = getAuthPortal(requestHeaders.get("host"));
  if (portal === "landing") redirect("/");

  const email = formText(formData, "email", 254).toLowerCase();
  const password = passwordText(formData);
  if (!email || !password) loginRedirect("credenciais");
  if (!isAuthSecretConfigured()) loginRedirect("configuracao");

  await ensureLocalTestAccount();
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, passwordHash: true, role: true, clientId: true, isActive: true },
  });
  if (!user || !user.isActive || !(await verifyPassword(password, user.passwordHash))) loginRedirect("credenciais");

  const allowsPortal = portal === "management" ? isManagementRole(user.role) : user.role === UserRole.CLIENT && Boolean(user.clientId);
  if (!allowsPortal) loginRedirect("acesso");

  await prisma.$transaction([
    prisma.authSession.deleteMany({ where: { userId: user.id, expiresAt: { lt: new Date() } } }),
    prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }),
  ]);
  await createAuthenticatedSession(user);
  redirect("/");
}

export async function logoutAction() {
  const requestHeaders = await headers();
  const portal = getAuthPortal(requestHeaders.get("host"));
  await destroyAuthenticatedSession();
  redirect(portal === "landing" ? "/" : "/entrar");
}
