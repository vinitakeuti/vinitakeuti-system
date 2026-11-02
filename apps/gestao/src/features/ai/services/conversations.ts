import type { AiChannel } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Conversas com a IA. Cada canal só enxerga as próprias conversas: a gestão as da gestão, o cliente as dele, o
 * visitante e o WhatsApp a do seu identificador (sessão do site ou número).
 */

export const MAX_USER_MESSAGE = 4_000;

export type ConversationOwner =
  | { channel: "GESTAO"; userId: string }
  | { channel: "PORTAL"; clientId: string; userId: string }
  | { channel: "SITE" | "WHATSAPP"; externalKey: string }
  | { channel: "SISTEMA"; externalKey: string };

function ownerWhere(owner: ConversationOwner) {
  if (owner.channel === "GESTAO") return { channel: owner.channel as AiChannel };
  if (owner.channel === "PORTAL") return { channel: owner.channel as AiChannel, clientId: owner.clientId };
  return { channel: owner.channel as AiChannel, externalKey: owner.externalKey };
}

/** Só localiza (não cria): para as leituras. */
export async function findConversation(owner: ConversationOwner, conversationId?: string | null) {
  if (owner.channel === "GESTAO" || owner.channel === "PORTAL") {
    if (!conversationId) return null;
    return prisma.aiConversation.findFirst({ where: { id: conversationId.slice(0, 50), ...ownerWhere(owner) }, select: { id: true, clientId: true } });
  }
  return prisma.aiConversation.findFirst({ where: ownerWhere(owner), select: { id: true, clientId: true } });
}

/** A conversa informada (se for de quem pede) ou uma nova. No site e no WhatsApp, uma conversa por identificador. */
export async function openConversation(owner: ConversationOwner, conversationId?: string | null) {
  if (conversationId) {
    const found = await prisma.aiConversation.findFirst({ where: { id: conversationId.slice(0, 50), ...ownerWhere(owner) }, select: { id: true, clientId: true } });
    if (found) return found;
    if (owner.channel === "GESTAO" || owner.channel === "PORTAL") return null;
  }
  if (owner.channel === "GESTAO") return prisma.aiConversation.create({ data: { channel: "GESTAO", userId: owner.userId }, select: { id: true, clientId: true } });
  if (owner.channel === "PORTAL") return prisma.aiConversation.create({ data: { channel: "PORTAL", clientId: owner.clientId, userId: owner.userId }, select: { id: true, clientId: true } });
  return prisma.aiConversation.upsert({ where: { channel_externalKey: { channel: owner.channel, externalKey: owner.externalKey } }, create: { channel: owner.channel, externalKey: owner.externalKey }, update: {}, select: { id: true, clientId: true } });
}

export type ConversationItem =
  | { kind: "user" | "assistant"; id: string; text: string; at: string }
  | { kind: "tools"; id: string; at: string; tools: Array<{ name: string; status: ToolStepStatus }> };

/** done: feita · error: não concluída · pending: aguardando confirmação · cancelled: recusada ou expirada. */
export type ToolStepStatus = "done" | "error" | "pending" | "cancelled";

const VIEW_ROWS = 120;

const ACTION_ID = /"acao_id":"([A-Za-z0-9_-]{1,50})"/;
const DECIDED: Record<string, ToolStepStatus> = { CONFIRMED: "done", DONE: "done", ERROR: "error", CANCELLED: "cancelled", EXPIRED: "cancelled" };

/** Situação de uma ferramenta pelo resultado guardado; a que pediu confirmação mostra o desfecho (confirmada ou não). */
function toolStatus(content: string, decisions: Map<string, string>): ToolStepStatus {
  const pending = content.includes('"aguardando_confirmacao":true') ? content.match(ACTION_ID)?.[1] : null;
  if (pending) return DECIDED[decisions.get(pending) ?? ""] ?? "pending";
  if (content.startsWith('{"erro"') || content.includes('"cadastrado":false')) return "error";
  return "done";
}

/**
 * A conversa para as telas: mensagens da pessoa, respostas da IA e, entre elas, as etapas (ferramentas usadas, com
 * a situação de cada uma). Também diz se há alteração aguardando confirmação e a situação da última resposta.
 */
export async function conversationView(conversationId: string, { take = VIEW_ROWS }: { take?: number } = {}) {
  const [rows, run, pending] = await Promise.all([
    prisma.aiMessage.findMany({ where: { conversationId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: Math.min(take, 600), select: { id: true, role: true, content: true, toolCalls: true, toolCallId: true, createdAt: true } }),
    prisma.aiRun.findFirst({ where: { conversationId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true, status: true, error: true } }),
    prisma.aiAction.count({ where: { conversationId, status: "PENDING_CONFIRMATION", createdAt: { gte: new Date(Date.now() - 30 * 60_000) } } }),
  ]);
  const ordered = rows.reverse();
  const results = new Map(ordered.filter((row) => row.role === "tool" && row.toolCallId).map((row) => [row.toolCallId!, row.content]));
  const actionIds = [...results.values()].flatMap((content) => content.includes('"aguardando_confirmacao":true') ? [content.match(ACTION_ID)?.[1]].filter((id): id is string => Boolean(id)) : []);
  const decisions = new Map((actionIds.length ? await prisma.aiAction.findMany({ where: { id: { in: actionIds }, conversationId }, take: 100, select: { id: true, status: true } }) : []).map((action) => [action.id, action.status]));
  const items: ConversationItem[] = [];
  for (const row of ordered) {
    const at = row.createdAt.toISOString();
    if (row.role === "user") items.push({ kind: "user", id: row.id, text: row.content, at });
    else if (row.role === "assistant") {
      if (row.content.trim()) items.push({ kind: "assistant", id: row.id, text: row.content, at });
      const calls = Array.isArray(row.toolCalls) ? row.toolCalls as Array<{ id: string; name: string }> : [];
      if (calls.length) items.push({ kind: "tools", id: `${row.id}-tools`, at, tools: calls.map((call) => ({ name: call.name, status: results.has(call.id) ? toolStatus(results.get(call.id)!, decisions) : "pending" })) });
    }
  }
  // Etapas seguidas (várias chamadas ao modelo antes da resposta) aparecem num bloco só.
  const merged: ConversationItem[] = [];
  for (const item of items) {
    const last = merged.at(-1);
    if (item.kind === "tools" && last?.kind === "tools") last.tools.push(...item.tools);
    else merged.push(item.kind === "tools" ? { ...item, tools: [...item.tools] } : item);
  }
  return {
    conversationId,
    items: merged,
    messages: merged.filter((item): item is Extract<ConversationItem, { kind: "user" | "assistant" }> => item.kind !== "tools").map((item) => ({ id: item.id, role: item.kind, content: item.text, createdAt: item.at })),
    pendingConfirmation: pending > 0,
    run: run ? { id: run.id, status: run.status, error: run.status === "FAILED" ? run.error : null } : null,
  };
}

export type ConversationView = Awaited<ReturnType<typeof conversationView>>;

/** Situação de uma resposta e, quando pronta, o texto final. */
export async function runView(conversationId: string, runId: string) {
  const run = await prisma.aiRun.findFirst({ where: { id: runId.slice(0, 50), conversationId }, select: { id: true, status: true, error: true, finishedAt: true, createdAt: true } });
  if (!run) return null;
  const reply = run.status === "DONE" || run.status === "FAILED"
    ? await prisma.aiMessage.findFirst({ where: { conversationId, role: "assistant", content: { not: "" }, createdAt: { gte: run.createdAt } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { content: true } })
    : null;
  return { id: run.id, status: run.status, reply: reply?.content ?? null, error: run.status === "FAILED" ? run.error : null };
}
