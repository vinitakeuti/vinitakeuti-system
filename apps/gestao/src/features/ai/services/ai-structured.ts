import { prisma } from "@/lib/prisma";
import { AiProviderError, type AiToolSpec } from "@/lib/integrations/ai/types";
import { loadAiRuntime, type AiTask } from "@/features/ai/services/ai-settings";
import { costOf } from "@/features/ai/services/agent";

/**
 * Chamadas de "uma pergunta, uma resposta estruturada" (fora das conversas): plano de projeto, texto de documento.
 * O modelo recebe uma ferramenta e responde chamando-a; se responder em texto, o JSON do texto é aproveitado.
 */

export type StructuredCall = { task: AiTask; system: string; user: string; tool: AiToolSpec; maxTokens: number; timeoutMs: number; temperature?: number };
export type StructuredResult = { input: Record<string, unknown>; model: string; inputTokens: number; outputTokens: number; costMicros: number | null };

export async function completeWithTool(call: StructuredCall): Promise<StructuredResult> {
  const loaded = await loadAiRuntime();
  if (!loaded.ok) throw new AiProviderError(loaded.error);
  const runtime = loaded.runtime;
  const model = runtime.models[call.task];
  const completion = await runtime.providerFor(model).complete({ system: call.system, messages: [{ role: "user", content: call.user }], tools: [call.tool], maxTokens: call.maxTokens, temperature: call.temperature ?? 0.2, timeoutMs: call.timeoutMs });
  const costMicros = completion.usage.costUsd !== null ? Math.round(completion.usage.costUsd * 1_000_000) : costOf(completion.usage, runtime.priceFor(model), runtime.providerId === "anthropic");
  const usage = { model: completion.model || model, inputTokens: completion.usage.inputTokens, outputTokens: completion.usage.outputTokens, costMicros };
  const fromTool = completion.toolCalls.find((item) => item.name === call.tool.name)?.input;
  if (fromTool && Object.keys(fromTool).length) return { input: fromTool, ...usage };
  const json = completion.text.match(/\{[\s\S]*\}/)?.[0];
  if (json) { try { return { input: JSON.parse(json) as Record<string, unknown>, ...usage }; } catch { /* segue para o erro */ } }
  throw Object.assign(new Error(completion.stopReason === "length" ? "A resposta ficou longa demais e foi cortada. Divida o pedido em partes menores." : "A Eliza não devolveu o resultado no formato esperado."), { usage });
}

function startOfToday() {
  const today = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Maceio" }).format(new Date());
  return new Date(`${today}T00:00:00.000-03:00`);
}

/** Usos da IA hoje (respostas das conversas e trabalhos de projetos e documentos), para o limite diário. */
export async function aiUsageToday() {
  const since = startOfToday();
  const [runs, projectJobs, documentJobs] = await Promise.all([
    prisma.aiRun.count({ where: { createdAt: { gte: since } } }),
    prisma.projectAiJob.count({ where: { createdAt: { gte: since } } }),
    prisma.documentAiJob.count({ where: { createdAt: { gte: since } } }),
  ]);
  return runs + projectJobs + documentJobs;
}
