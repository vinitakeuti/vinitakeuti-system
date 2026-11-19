// Redefinição de senha pelo terminal do servidor, para quando o e-mail não chega (SMTP fora do ar ou não configurado).
//
//   node scripts/redefinir-senha.mjs                 lista as contas da gestão
//   node scripts/redefinir-senha.mjs voce@email.com  mostra um link de redefinição para a conta
//
// O link é o mesmo do "Esqueci minha senha": vale 30 minutos, funciona uma vez, e ao usá-lo a pessoa cria a nova senha
// e já entra. Nenhuma senha passa pelo terminal. O formato do token e do hash acompanha
// src/features/auth/services/password-reset.ts. Localmente: node --env-file=.env.local scripts/redefinir-senha.mjs
import { createHash, randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const MINUTES = 30;
const prisma = new PrismaClient();

const host = (name, fallback) => (process.env[name] ?? "").trim().toLowerCase().replace(/:\d+$/, "") || fallback;
const baseUrl = (role) => {
  if (process.env.NODE_ENV !== "production") return `http://${role === "CLIENT" ? "clientes.localhost" : "localhost"}:${process.env.PORT ?? "3000"}`;
  return role === "CLIENT" ? `https://${host("CLIENT_PORTAL_HOST", "clientes.viniciusriudi.com")}` : `https://${host("MANAGEMENT_HOST", "gestao.viniciusriudi.com")}`;
};

async function listManagementAccounts() {
  const users = await prisma.user.findMany({ where: { role: { not: "CLIENT" } }, orderBy: { createdAt: "asc" }, take: 50, select: { name: true, email: true, role: true, isActive: true } });
  if (!users.length) {
    console.log("Nenhuma conta da gestão cadastrada.");
    return;
  }
  console.log("Contas da gestão:");
  for (const user of users) console.log(`  ${user.email}  (${user.name}${user.isActive ? "" : ", desativada"})`);
  console.log("\nRode de novo com o e-mail: node scripts/redefinir-senha.mjs voce@email.com");
}

async function issueLink(email) {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, role: true, clientId: true, isActive: true } });
  if (!user) {
    console.error(`Nenhuma conta com o e-mail ${email}. Rode sem o e-mail para ver as contas da gestão.`);
    process.exitCode = 1;
    return;
  }
  if (!user.isActive) {
    console.error("Esta conta está desativada. Reative o acesso antes de redefinir a senha.");
    process.exitCode = 1;
    return;
  }
  if (user.role === "CLIENT" && !user.clientId) {
    console.error("Esta conta de cliente não está vinculada a um cadastro e não entra no portal.");
    process.exitCode = 1;
    return;
  }
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + MINUTES * 60_000);
  await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: createHash("sha256").update(token).digest("hex"), expiresAt } });
  await prisma.systemLog.create({ data: { source: "sistema", level: "warning", event: "auth.password.reset_cli", message: `Link de redefinição de senha gerado pelo terminal do servidor para ${user.name}.`, actorEmail: email } });
  console.log(`Link para ${user.name} (vale ${MINUTES} minutos, uma vez):\n\n${baseUrl(user.role)}/redefinir-senha?token=${token}\n`);
}

const email = (process.argv[2] ?? "").trim().toLowerCase();
try {
  if (email) await issueLink(email);
  else await listManagementAccounts();
} finally {
  await prisma.$disconnect();
}
