import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { AiProviderError } from "@/lib/integrations/ai/types";
import { logEvent } from "@/features/system-logs/services/system-log";
import { executeRun } from "@/features/ai/services/agent";
import { loadAiRuntime } from "@/features/ai/services/ai-settings";
import { MAX_USER_MESSAGE } from "@/features/ai/services/conversations";
import { aiUsageToday } from "@/features/ai/services/ai-structured";

/**
 * Fila das respostas da IA. A mensagem da pessoa é gravada e a resposta é gerada fora da requisição (after), com
 * novas tentativas pelo agendador (a cada minuto) quando o provedor falha de forma passageira. Quem enviou
 * acompanha pela situação da execução (GET), como as telas e o WhatsApp fazem.
 */

const MAX_ATTEMPTS = 3;
const STUCK_AFTER_MS = 5 * 60_000;
const BATCH = 5;
const DAY = 24 * 60 * 60 * 1000;
const RETENTION = { SITE: 30 * DAY, default: 180 * DAY };

export class AiUnavailableError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "AiUnavailableError";
  }
}

/**
 * Grava a mensagem da pessoa e põe a resposta na fila. Recusa se o canal estiver desligado, se o limite diário
 * acabou ou se a resposta anterior desta conversa ainda não saiu.
 */
export async function sendAiMessage({ conversationId, channel, text }: { conversationId: string; channel: string; text: string }) {
  const content = text.trim().slice(0, MAX_USER_MESSAGE);
  if (!content) throw new AiUnavailableError("Escreva uma mensagem.", 400);
  const loaded = await loadAiRuntime();
  if (!loaded.ok) throw new AiUnavailableError(loaded.error, 503);
  if (channel !== "SISTEMA" && !loaded.runtime.channels.has(channel)) throw new AiUnavailableError("A IA não está liberada neste canal.", 403);
  if (loaded.runtime.dailyRunLimit !== null) {
    const used = await aiUsageToday();
    if (used >= loaded.runtime.dailyRunLimit) throw new AiUnavailableError("O limite diário de uso da IA foi atingido. Tente amanhã.", 429);
  }
  const run = await prisma.$transaction(async (tx) => {
    // Uma resposta por vez em cada conversa: a trava serializa mensagens simultâneas da mesma conversa.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${conversationId}))`;
    const busy = await tx.aiRun.findFirst({ where: { conversationId, status: { in: ["PENDING", "RUNNING"] } }, select: { id: true } });
    if (busy) throw new AiUnavailableError("Aguarde a resposta anterior.", 409);
    await tx.aiMessage.create({ data: { conversationId, role: "user", content } });
    const conversation = await tx.aiConversation.update({ where: { id: conversationId }, data: { lastMessageAt: new Date() }, select: { title: true } });
    if (!conversation.title) await tx.aiConversation.update({ where: { id: conversationId }, data: { title: content.replace(/\s+/g, " ").slice(0, 80) } });
    return tx.aiRun.create({ data: { conversationId }, select: { id: true } });
  });
  try { after(() => processAiRuns()); } catch { /* fora de uma requisição: o agendador processa */ }
  return run.id;
}

/** Processa as respostas na fila. Chamado depois das requisições e pelo agendador. */
export async function processAiRuns() {
  await prisma.aiRun.updateMany({ where: { status: "RUNNING", startedAt: { lt: new Date(Date.now() - STUCK_AFTER_MS) } }, data: { status: "PENDING" } });
  const due = await prisma.aiRun.findMany({ where: { status: "PENDING" }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: BATCH, select: { id: true } });
  let done = 0;
  for (const { id } of due) {
    const claimed = await prisma.aiRun.updateMany({ where: { id, status: "PENDING" }, data: { status: "RUNNING", startedAt: new Date(), attempts: { increment: 1 } } });
    if (!claimed.count) continue;
    try {
      await executeRun(id);
      done += 1;
    } catch (error) {
      const run = await prisma.aiRun.findUnique({ where: { id }, select: { attempts: true, conversationId: true } });
      const retry = error instanceof AiProviderError && error.retryable && (run?.attempts ?? MAX_ATTEMPTS) < MAX_ATTEMPTS;
      const message = (error instanceof Error ? error.message : String(error)).slice(0, 500);
      await prisma.aiRun.update({ where: { id }, data: retry ? { status: "PENDING", error: message } : { status: "FAILED", error: message, finishedAt: new Date() } });
      if (!retry && run) {
        await prisma.aiMessage.create({ data: { conversationId: run.conversationId, role: "assistant", content: "Não consegui responder agora. Tente de novo em instantes." } });
        await logEvent({ source: "sistema", level: "error", event: "ai.run.failed", message: `A IA não respondeu: ${message}` });
      }
    }
  }
  return done;
}

/** Retenção: conversas do site somem em 30 dias; as demais, em 180 dias sem mensagens. */
export async function pruneAiHistory(now = new Date()) {
  const [site, others] = await Promise.all([
    prisma.aiConversation.deleteMany({ where: { channel: "SITE", lastMessageAt: { lt: new Date(now.getTime() - RETENTION.SITE) } } }),
    prisma.aiConversation.deleteMany({ where: { channel: { not: "SITE" }, lastMessageAt: { lt: new Date(now.getTime() - RETENTION.default) } } }),
  ]);
  return site.count + others.count;
}
