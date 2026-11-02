import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AiToolCall } from "@/lib/integrations/ai/types";
import { findTool } from "@/features/ai/tools/registry";
import { ToolInputError } from "@/features/ai/tools/schema";
import type { AiTool, ToolContext } from "@/features/ai/tools/tool";

/**
 * Executa as ferramentas pedidas pela IA: confere se a ferramenta vale no canal, valida a entrada, segura as
 * alterações que pedem confirmação e registra tudo na auditoria (AiAction). O resultado volta ao modelo em JSON.
 */

const MAX_RESULT_FOR_MODEL = 8_000;
const MAX_RESULT_STORED = 4_000;
export const CONFIRMATION_WINDOW_MS = 30 * 60_000;

export type ExecuteOptions = { allowed: ReadonlySet<string>; requireConfirmation: boolean };

function serialize(value: unknown, max: number) {
  const text = JSON.stringify(value ?? null) ?? "null";
  return text.length > max ? `${text.slice(0, max)}…(cortado)` : text;
}

/** O resultado guardado na auditoria é limitado: uma lista grande vira o começo dela. */
function storedResult(value: unknown): Prisma.InputJsonValue {
  const text = serialize(value, MAX_RESULT_STORED);
  return text.length >= MAX_RESULT_STORED ? { resumo: text } : JSON.parse(text) as Prisma.InputJsonValue;
}

const isError = (value: unknown) => Boolean(value) && typeof value === "object" && "erro" in (value as object);

async function record(context: ToolContext, tool: AiTool<never>, input: unknown, status: string, result: unknown) {
  await prisma.aiAction.create({ data: { conversationId: context.conversationId, runId: context.runId, tool: tool.name, input: (input ?? {}) as Prisma.InputJsonValue, result: result === undefined ? undefined : storedResult(result), status, mutates: tool.mutates, actor: context.actor.slice(0, 120) } });
}

/**
 * Executa de fato (sem pedir confirmação) e registra. Usado direto pelo MCP e depois de um "sim". A auditoria guarda
 * a entrada como o modelo mandou (`raw`, valores em reais), não a convertida (centavos): é ela que a confirmação
 * valida de novo, e convertê-la duas vezes multiplicaria os valores.
 */
export async function runToolNow(tool: AiTool<never>, input: never, context: ToolContext, raw: unknown) {
  try {
    const result = await tool.run(input, context);
    await record(context, tool, raw, isError(result) ? "ERROR" : "DONE", result);
    return result;
  } catch (error) {
    const result = { erro: `Falha ao executar: ${error instanceof Error ? error.message : String(error)}`.slice(0, 300) };
    await record(context, tool, raw, "ERROR", result);
    return result;
  }
}

export async function executeToolCall(call: AiToolCall, context: ToolContext, options: ExecuteOptions): Promise<string> {
  const tool = findTool(call.name) as AiTool<never> | null;
  if (!tool || !options.allowed.has(call.name) || !tool.scopes.includes(context.scope)) return serialize({ erro: "Ferramenta indisponível nesta conversa." }, MAX_RESULT_FOR_MODEL);

  let input: never;
  try { input = tool.input.parse(call.input) as never; }
  catch (error) {
    if (error instanceof ToolInputError) return serialize({ erro: `Entrada inválida. ${error.message}` }, MAX_RESULT_FOR_MODEL);
    throw error;
  }

  if (options.requireConfirmation && context.scope === "owner" && (tool.confirm ?? tool.mutates)) {
    const action = await prisma.aiAction.create({ data: { conversationId: context.conversationId, runId: context.runId, tool: tool.name, input: call.input as Prisma.InputJsonValue, status: "PENDING_CONFIRMATION", mutates: true, actor: context.actor.slice(0, 120) }, select: { id: true } });
    const summary = tool.summarize ? (tool.summarize as (value: unknown) => string)(input) : tool.name;
    return serialize({ aguardando_confirmacao: true, acao_id: action.id, resumo: summary, instrucao: "Nada foi alterado ainda. Mostre o resumo à pessoa e pergunte se pode executar. Só depois de ela responder que sim, chame confirmar_acao com este acao_id. Se ela recusar, chame cancelar_acao." }, MAX_RESULT_FOR_MODEL);
  }

  return serialize(await runToolNow(tool, input, context, call.input), MAX_RESULT_FOR_MODEL);
}
