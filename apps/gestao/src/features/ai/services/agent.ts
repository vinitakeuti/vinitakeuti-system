import { prisma } from "@/lib/prisma";
import { AiProviderError, type AiChatMessage, type AiToolCall } from "@/lib/integrations/ai/types";
import type { Prisma } from "@prisma/client";
import { loadAiRuntime } from "@/features/ai/services/ai-settings";
import { systemPrompt } from "@/features/ai/services/prompts";
import { executeToolCall } from "@/features/ai/services/tool-executor";
import { toolSpecs, toolsForScope } from "@/features/ai/tools/registry";
import { scopeForChannel, type ToolContext } from "@/features/ai/tools/tool";

/**
 * Uma resposta da IA: monta o histórico, chama o modelo e executa as ferramentas que ele pedir, em ciclos, até a
 * resposta final (no máximo MAX_STEPS chamadas ao modelo). Tudo fica gravado na conversa.
 */

const MAX_STEPS = 8;
const HISTORY_LIMIT = 40;
const MAX_TOKENS = 1_500;

/** Histórico para o modelo: começa numa mensagem da pessoa e descarta resultados de ferramenta sem o pedido. */
async function history(conversationId: string): Promise<AiChatMessage[]> {
  const rows = (await prisma.aiMessage.findMany({ where: { conversationId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: HISTORY_LIMIT, select: { role: true, content: true, toolCalls: true, toolCallId: true, toolName: true } })).reverse();
  const start = rows.findIndex((row) => row.role === "user");
  const messages: AiChatMessage[] = [];
  const pending = new Set<string>();
  for (const row of start >= 0 ? rows.slice(start) : []) {
    if (row.role === "user") messages.push({ role: "user", content: row.content });
    else if (row.role === "assistant") {
      const toolCalls = Array.isArray(row.toolCalls) ? row.toolCalls as AiToolCall[] : [];
      toolCalls.forEach((call) => pending.add(call.id));
      messages.push({ role: "assistant", content: row.content, ...(toolCalls.length ? { toolCalls } : {}) });
    } else if (row.role === "tool" && row.toolCallId && pending.has(row.toolCallId)) {
      messages.push({ role: "tool", toolCallId: row.toolCallId, name: row.toolName ?? "", content: row.content });
    }
  }
  return messages;
}

export async function executeRun(runId: string) {
  const run = await prisma.aiRun.findUnique({ where: { id: runId }, select: { id: true, conversation: { select: { id: true, channel: true, clientId: true, externalKey: true, userId: true, client: { select: { name: true } } } } } });
  if (!run) return;
  const conversation = run.conversation;
  const loaded = await loadAiRuntime();
  if (!loaded.ok) throw new AiProviderError(loaded.error);
  const runtime = loaded.runtime;

  const scope = scopeForChannel(conversation.channel);
  const tools = toolsForScope(scope);
  const allowed = new Set(tools.map((tool) => tool.name));
  const actor = conversation.channel === "SITE" ? "visitante do site" : conversation.externalKey ?? conversation.userId ?? conversation.channel.toLowerCase();
  const context: ToolContext = { scope, channel: conversation.channel, conversationId: conversation.id, clientId: conversation.clientId, actor, runId: run.id };
  const system = systemPrompt({ scope, channel: conversation.channel, clientName: conversation.client?.name, instructions: runtime.instructions });
  const messages = await history(conversation.id);
  const usage = { inputTokens: 0, outputTokens: 0 };
  let model = runtime.model;
  let finished = false;
  let steps = 0;

  while (steps < MAX_STEPS) {
    steps += 1;
    const completion = await runtime.provider.complete({ system, messages, tools: toolSpecs(tools), maxTokens: MAX_TOKENS });
    usage.inputTokens += completion.usage.inputTokens;
    usage.outputTokens += completion.usage.outputTokens;
    model = completion.model;

    if (!completion.toolCalls.length) {
      const text = completion.text || (completion.stopReason === "length" ? "A resposta ficou longa demais e foi cortada. Pode pedir de novo, de forma mais específica?" : "Não consegui formular uma resposta. Pode reformular?");
      await prisma.aiMessage.create({ data: { conversationId: conversation.id, role: "assistant", content: text.slice(0, 20_000) } });
      finished = true;
      break;
    }

    const calls = completion.toolCalls.slice(0, 8);
    await prisma.aiMessage.create({ data: { conversationId: conversation.id, role: "assistant", content: completion.text.slice(0, 20_000), toolCalls: calls as unknown as Prisma.InputJsonValue } });
    messages.push({ role: "assistant", content: completion.text, toolCalls: calls });
    for (const call of calls) {
      const content = await executeToolCall(call, context, { allowed, requireConfirmation: runtime.requireConfirmation });
      await prisma.aiMessage.create({ data: { conversationId: conversation.id, role: "tool", content, toolCallId: call.id, toolName: call.name } });
      messages.push({ role: "tool", toolCallId: call.id, name: call.name, content });
    }
    await prisma.aiRun.update({ where: { id: run.id }, data: { steps, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens } });
  }

  if (!finished) await prisma.aiMessage.create({ data: { conversationId: conversation.id, role: "assistant", content: "Precisei de mais etapas do que o permitido para responder. Pode dividir o pedido em partes menores?" } });
  await prisma.aiRun.update({ where: { id: run.id }, data: { status: "DONE", provider: runtime.providerId, model: model.slice(0, 120), steps, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, finishedAt: new Date(), error: null } });
  await prisma.aiConversation.update({ where: { id: conversation.id }, data: { lastMessageAt: new Date() } });
}
