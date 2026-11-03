"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireManagementUser } from "@/features/auth/services/auth-session";
import { prisma } from "@/lib/prisma";
import { logEvent } from "@/features/system-logs/services/system-log";
import { AI_INSTRUCTIONS_MAX, disableAi, listModelsForKey, revokeExternalToken, rotateExternalToken, saveAiConnection, saveAiContext, saveAiRules, testAiConnection } from "@/features/ai/services/ai-settings";
import type { AiModelInfo } from "@/lib/integrations/ai/types";

/** Ações do painel de IA em Integrações. */

export type AiTab = "conexao" | "contexto" | "regras" | "acesso" | "atividade";

/** Volta para a aba da IA com um aviso ou erro. */
function done(tab: AiTab, params: Record<string, string>): never {
  revalidatePath("/integracoes/ia");
  revalidatePath("/integracoes");
  redirect(`/integracoes/ia?${new URLSearchParams({ ...(tab === "conexao" ? {} : { aba: tab }), ...params })}`);
}

const text = (formData: FormData, name: string, max: number) => {
  const value = formData.get(name);
  return typeof value === "string" ? value.slice(0, max) : "";
};

export async function saveAiConnectionAction(formData: FormData) {
  const user = await requireManagementUser();
  const tasks = ["gestao", "attendance", "document", "quote"] as const;
  const result = await saveAiConnection({
    provider: text(formData, "provider", 30), baseUrl: text(formData, "baseUrl", 300), apiKey: text(formData, "apiKey", 400), usdBrl: text(formData, "usdBrl", 10),
    models: Object.fromEntries(tasks.map((task) => [task, text(formData, `model_${task}`, 120)])) as Record<(typeof tasks)[number], string>,
    prices: Object.fromEntries(tasks.map((task) => [task, { input: text(formData, `price_${task}_input`, 20), output: text(formData, `price_${task}_output`, 20) }])) as Record<(typeof tasks)[number], { input: string; output: string }>,
  });
  if (!result.ok) done("conexao", { erro: result.error });
  await logEvent({ event: "ai.settings", message: "Conexão da IA atualizada (provedor, chave ou modelo).", actorEmail: user.email });
  done("conexao", { aviso: "salva" });
}

export async function saveAiRulesAction(formData: FormData) {
  const user = await requireManagementUser();
  const result = await saveAiRules({
    channels: formData.getAll("channels").filter((value): value is string => typeof value === "string"),
    ownerPhones: text(formData, "ownerPhones", 300),
    whatsappAttendance: formData.get("whatsappAttendance") === "on",
    requireConfirmation: formData.get("requireConfirmation") === "on",
    dailyRunLimit: text(formData, "dailyRunLimit", 8),
  });
  if (!result.ok) done("regras", { erro: result.error });
  await logEvent({ event: "ai.settings", message: "Canais e regras da IA atualizados.", actorEmail: user.email });
  done("regras", { aviso: "regras" });
}

export async function saveAiContextAction(formData: FormData) {
  const user = await requireManagementUser();
  const result = await saveAiContext({ assistantName: text(formData, "assistantName", 60), generalInstructions: text(formData, "generalInstructions", AI_INSTRUCTIONS_MAX + 1), serviceInstructions: text(formData, "serviceInstructions", AI_INSTRUCTIONS_MAX + 1) });
  if (!result.ok) done("contexto", { erro: result.error });
  await logEvent({ event: "ai.settings", message: "Contexto da IA atualizado (instruções gerais e de atendimento).", actorEmail: user.email });
  done("contexto", { aviso: "contexto" });
}

export async function testAiConnectionAction() {
  await requireManagementUser();
  const result = await testAiConnection();
  if (!result.ok) done("conexao", { erro: result.error });
  done("conexao", { aviso: "teste", resultado: result.results.map((item) => `${item.model} respondeu “${item.reply}” em ${item.ms} ms`).join(" · ").slice(0, 700) });
}

export async function disableAiAction() {
  const user = await requireManagementUser();
  await disableAi();
  await logEvent({ level: "warning", event: "ai.disabled", message: "IA desligada e chave removida.", actorEmail: user.email });
  done("conexao", { aviso: "desligada" });
}

export type TokenState = { token: string | null; error: string | null };

/** Gera o token de acesso externo e o devolve uma vez para a tela (nunca vai para a URL). */
export async function rotateExternalTokenAction(previous: TokenState): Promise<TokenState> {
  void previous;
  const user = await requireManagementUser();
  const token = await rotateExternalToken();
  await logEvent({ level: "warning", event: "ai.token.rotated", message: "Token de acesso externo da IA gerado (o anterior deixou de valer).", actorEmail: user.email });
  revalidatePath("/integracoes/ia");
  return { token, error: null };
}

export async function revokeExternalTokenAction() {
  const user = await requireManagementUser();
  await revokeExternalToken();
  await logEvent({ level: "warning", event: "ai.token.revoked", message: "Token de acesso externo da IA revogado.", actorEmail: user.email });
  done("acesso", { aviso: "token-revogado" });
}

/** Renomeia uma conversa com a Eliza (o título do histórico). O título automático só é gerado quando ainda não há um. */
export async function renameAssistantConversationAction(input: { conversationId: string; title: string }): Promise<{ ok: true; title: string } | { ok: false; error: string }> {
  await requireManagementUser();
  const id = typeof input?.conversationId === "string" ? input.conversationId.slice(0, 50) : "";
  const title = typeof input?.title === "string" ? input.title.replace(/\s+/g, " ").trim().slice(0, 80) : "";
  if (!title) return { ok: false, error: "Dê um nome à conversa." };
  const result = await prisma.aiConversation.updateMany({ where: { id, channel: "GESTAO" }, data: { title } });
  if (!result.count) return { ok: false, error: "Conversa não encontrada." };
  revalidatePath("/assistente");
  return { ok: true, title };
}

/** Exclui uma conversa do assistente (mensagens e etapas). A auditoria das alterações vai junto com a conversa. */
export async function deleteAssistantConversationAction(formData: FormData) {
  await requireManagementUser();
  const id = text(formData, "conversationId", 50);
  if (id) await prisma.aiConversation.deleteMany({ where: { id, channel: "GESTAO" } });
  revalidatePath("/assistente");
  redirect("/assistente");
}

export type ModelListResult = { ok: true; models: AiModelInfo[] } | { ok: false; error: string };

/** BUSCAR MODELOS: consulta os modelos com a chave digitada (sem salvar) ou com a já salva. */
export async function listAiModelsAction(input: { provider: string; baseUrl: string; apiKey: string }): Promise<ModelListResult> {
  await requireManagementUser();
  return listModelsForKey({ provider: String(input.provider ?? "").slice(0, 30), baseUrl: String(input.baseUrl ?? "").slice(0, 300), apiKey: String(input.apiKey ?? "").slice(0, 400) });
}
