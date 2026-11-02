import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendOwnerEmail } from "@/features/notifications/services/owner-email";
import { logEvent } from "@/features/system-logs/services/system-log";

/**
 * Atendimento com IA no site (widget). Para começar, o visitante informa nome, telefone e e-mail: os dados ficam na
 * conversa, a IA passa a chamá-lo pelo nome e você recebe um e-mail com o contato. Sem esses dados, a conversa não
 * aceita mensagens.
 */

export const SITE_SESSION_ID = /^[A-Za-z0-9_-]{16,64}$/;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i;

export type Visitor = { name: string; phone: string; email: string };

/** Valida e normaliza: nome com ao menos 2 letras, telefone brasileiro (DDD + número) e e-mail. */
export function parseVisitor(input: { nome?: unknown; telefone?: unknown; email?: unknown }): { ok: true; visitor: Visitor } | { ok: false; error: string; field: "nome" | "telefone" | "email" } {
  const name = typeof input.nome === "string" ? input.nome.replace(/\s+/g, " ").trim().slice(0, 120) : "";
  if (name.replace(/[^\p{L}]/gu, "").length < 2) return { ok: false, error: "Informe seu nome.", field: "nome" };
  let digits = typeof input.telefone === "string" ? input.telefone.replace(/\D/g, "") : "";
  if (digits.length === 12 || digits.length === 13) digits = digits.startsWith("55") ? digits : "";
  else if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  else digits = "";
  if (!digits || !/^55[1-9]{2}\d{8,9}$/.test(digits)) return { ok: false, error: "Informe um telefone com DDD.", field: "telefone" };
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase().slice(0, 254) : "";
  if (!EMAIL.test(email)) return { ok: false, error: "Informe um e-mail válido.", field: "email" };
  return { ok: true, visitor: { name, phone: digits, email } };
}

export function formatPhone(digits: string) {
  const match = digits.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  return match ? `(${match[1]}) ${match[2]}-${match[3]}` : `+${digits}`;
}

/** Inicia (ou atualiza) a sessão do visitante. Avisa você por e-mail só na primeira vez. */
export async function startSiteSession(sessionId: string, visitor: Visitor) {
  const existing = await prisma.aiConversation.findUnique({ where: { channel_externalKey: { channel: "SITE", externalKey: sessionId } }, select: { id: true, contactName: true } });
  const conversation = existing
    ? await prisma.aiConversation.update({ where: { id: existing.id }, data: { contactName: visitor.name, contactPhone: visitor.phone, contactEmail: visitor.email, lastMessageAt: new Date() }, select: { id: true } })
    : await prisma.aiConversation.create({ data: { channel: "SITE", externalKey: sessionId, contactName: visitor.name, contactPhone: visitor.phone, contactEmail: visitor.email }, select: { id: true } });
  if (!existing?.contactName) {
    const notify = async () => {
      try {
        await logEvent({ source: "sistema", event: "ai.site.started", message: `Atendimento iniciado no site por ${visitor.name}.`, metadata: { email: visitor.email, phone: visitor.phone } });
        await sendOwnerEmail({ kind: "attendance", footer: "Atendimento no site", subject: `Novo atendimento no site: ${visitor.name}`, title: "Um visitante começou a conversar com a IA no site.", lines: [`Nome: ${visitor.name}`, `Telefone: ${formatPhone(visitor.phone)}`, `E-mail: ${visitor.email}`, "A conversa aparece em Integrações › Inteligência artificial › Atividade › Atendimento."], path: "/integracoes/ia?aba=atividade&escopo=atendimento" });
      } catch { /* o aviso não pode impedir o atendimento */ }
    };
    try { after(notify); } catch { void notify(); }
  }
  return { conversationId: conversation.id, firstName: visitor.name.split(" ")[0] };
}

/** Sessão do visitante, se ele já informou os dados: nome e as últimas mensagens, para o widget retomar a conversa. */
export async function siteSession(sessionId: string) {
  const conversation = await prisma.aiConversation.findUnique({ where: { channel_externalKey: { channel: "SITE", externalKey: sessionId } }, select: { id: true, contactName: true } });
  if (!conversation?.contactName) return null;
  const [messages, run] = await Promise.all([
    prisma.aiMessage.findMany({ where: { conversationId: conversation.id, role: { in: ["user", "assistant"] }, content: { not: "" } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 40, select: { id: true, role: true, content: true, toolCalls: true } }),
    prisma.aiRun.findFirst({ where: { conversationId: conversation.id, status: { in: ["PENDING", "RUNNING"] } }, orderBy: { createdAt: "desc" }, select: { id: true } }),
  ]);
  return {
    conversationId: conversation.id,
    name: conversation.contactName,
    // Texto que acompanha pedidos de ferramenta ("vou verificar…") também aparece, como na tela do assistente.
    messages: messages.reverse().map((message) => ({ id: message.id, role: message.role as "user" | "assistant", text: message.content })),
    pendingRun: run?.id ?? null,
  };
}
