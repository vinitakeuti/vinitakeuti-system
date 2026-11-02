import { prisma } from "@/lib/prisma";
import { AiProviderError, type AiChatMessage, type AiToolCall } from "@/lib/integrations/ai/types";
import type { Prisma } from "@prisma/client";
import { loadAiRuntime } from "@/features/ai/services/ai-settings";
import { systemPrompt } from "@/features/ai/services/prompts";
import { executeToolCall } from "@/features/ai/services/tool-executor";
import { toolSpecs, toolsForScope } from "@/features/ai/tools/registry";
import { scopeForConversation, type ToolContext } from "@/features/ai/tools/tool";

/**
 * Uma resposta da IA: monta o histórico, chama o modelo e executa as ferramentas que ele pedir, em ciclos, até a
 * resposta final (no máximo MAX_STEPS chamadas ao modelo). Tudo fica gravado na conversa.
 *
 * Modelo por tarefa (definido em Integrações): a conversa usa o da gestão ou o do atendimento; quando o modelo pede
 * uma ferramenta de documentos ou de orçamentos, essa etapa é refeita com o modelo daquela tarefa, que segue até o
 * fim da resposta. As instruções fixas vão em `system` (cache do prompt) e a hora e o visitante, em `systemDynamic`.
 */

const MAX_STEPS = 8;
const HISTORY_LIMIT = 40;
const MAX_TOKENS = 1_500;
/** Resultado de ferramenta de mensagens anteriores entra resumido: o modelo já respondeu com base nele. */
const OLD_TOOL_RESULT_CHARS = 1_200;

/** Ferramentas que definem a tarefa (e o modelo) da etapa. */
const TASK_TOOLS: Record<string, "document" | "quote"> = {
  documentos_criar: "document",
  documentos_reescrever: "document",
  orcamentos_criar: "quote",
  orcamentos_alterar_servicos: "quote",
};

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
      const content = row.content.length > OLD_TOOL_RESULT_CHARS ? `${row.content.slice(0, OLD_TOOL_RESULT_CHARS)}…(resultado antigo resumido; consulte de novo se precisar)` : row.content;
      messages.push({ role: "tool", toolCallId: row.toolCallId, name: row.toolName ?? "", content });
    }
  }
  return messages;
}

export async function executeRun(runId: string) {
  const run = await prisma.aiRun.findUnique({ where: { id: runId }, select: { id: true, conversation: { select: { id: true, channel: true, clientId: true, externalKey: true, userId: true, contactName: true, contactPhone: true, contactEmail: true, client: { select: { name: true } } } } } });
  if (!run) return;
  const conversation = run.conversation;
  const loaded = await loadAiRuntime();
  if (!loaded.ok) throw new AiProviderError(loaded.error);
  const runtime = loaded.runtime;

  const scope = scopeForConversation(conversation, runtime.ownerPhones);
  const tools = toolsForScope(scope);
  const allowed = new Set(tools.map((tool) => tool.name));
  const actor = conversation.channel === "SITE" ? `site:${conversation.contactEmail ?? "visitante"}` : conversation.channel === "WHATSAPP" ? `whatsapp:${conversation.externalKey}` : conversation.userId ?? conversation.channel.toLowerCase();
  const context: ToolContext = { scope, channel: conversation.channel, conversationId: conversation.id, clientId: conversation.clientId, actor, runId: run.id };
  const prompt = systemPrompt({ scope, channel: conversation.channel, clientName: conversation.client?.name, visitor: conversation.contactName ? { name: conversation.contactName, phone: conversation.contactPhone, email: conversation.contactEmail } : null, assistantName: runtime.assistantName, generalInstructions: runtime.generalInstructions, serviceInstructions: runtime.serviceInstructions });
  const messages = await history(conversation.id);
  const specs = toolSpecs(tools);
  const usage = { inputTokens: 0, outputTokens: 0 };
  // Custo somado por chamada: o informado pelo provedor (OpenRouter) ou o calculado pelo preço do modelo.
  let costMicros = 0;
  let costKnown = true;
  let model = scope === "owner" ? runtime.models.gestao : runtime.models.attendance;
  const used = [model];
  let finished = false;
  let steps = 0;

  while (steps < MAX_STEPS) {
    steps += 1;
    const completion = await runtime.providerFor(model).complete({ system: prompt.system, systemDynamic: prompt.dynamic, messages, tools: specs, maxTokens: MAX_TOKENS });
    usage.inputTokens += completion.usage.inputTokens;
    usage.outputTokens += completion.usage.outputTokens;
    const stepCost = completion.usage.costUsd !== null ? Math.round(completion.usage.costUsd * 1_000_000) : costOf(completion.usage, runtime.priceFor(model), runtime.providerId === "anthropic");
    if (stepCost === null) costKnown = false; else costMicros += stepCost;

    // A etapa pede documento ou orçamento e essa tarefa tem outro modelo: refaz a etapa com ele (sem gravar esta).
    const task = scope === "owner" ? completion.toolCalls.map((call) => TASK_TOOLS[call.name]).find(Boolean) : undefined;
    if (task && runtime.models[task] !== model && steps < MAX_STEPS) {
      model = runtime.models[task];
      used.push(model);
      continue;
    }

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
  const models = [...new Set(used)].join(" → ").slice(0, 120);
  await prisma.aiRun.update({ where: { id: run.id }, data: { status: "DONE", provider: runtime.providerId, model: models, steps, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, costMicros: costKnown || costMicros > 0 ? costMicros : null, finishedAt: new Date(), error: null } });
  await prisma.aiConversation.update({ where: { id: conversation.id }, data: { lastMessageAt: new Date() } });
}

/**
 * Custo de uma chamada pelo preço do modelo. Na Anthropic direta, leitura do cache custa 10% e gravação 125% do
 * preço de entrada; nos demais, os tokens em cache entram pelo preço cheio (estimativa conservadora).
 */
function costOf(usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number }, price: { input: number; output: number } | null, anthropic: boolean) {
  if (!price) return null;
  const input = anthropic ? (usage.inputTokens - usage.cacheReadTokens - usage.cacheWriteTokens) + usage.cacheReadTokens * 0.1 + usage.cacheWriteTokens * 1.25 : usage.inputTokens;
  return Math.round((input * price.input + usage.outputTokens * price.output) / 1_000_000);
}
