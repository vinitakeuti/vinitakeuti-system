"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireManagementUser } from "@/features/auth/services/auth-session";
import { prisma } from "@/lib/prisma";
import { logEvent } from "@/features/system-logs/services/system-log";
import { disableAi, revokeExternalToken, rotateExternalToken, saveAiSettings, testAiConnection } from "@/features/ai/services/ai-settings";

/** Ações do painel de IA em Integrações. */

function done(params: Record<string, string>): never {
  revalidatePath("/integracoes");
  redirect(`/integracoes?${new URLSearchParams(params)}#ia`);
}

const text = (formData: FormData, name: string, max: number) => {
  const value = formData.get(name);
  return typeof value === "string" ? value.slice(0, max) : "";
};

export async function saveAiSettingsAction(formData: FormData) {
  const user = await requireManagementUser();
  const result = await saveAiSettings({
    provider: text(formData, "provider", 30),
    baseUrl: text(formData, "baseUrl", 300),
    model: text(formData, "model", 120),
    apiKey: text(formData, "apiKey", 400),
    channels: formData.getAll("channels").filter((value): value is string => typeof value === "string"),
    ownerPhones: text(formData, "ownerPhones", 300),
    requireConfirmation: formData.get("requireConfirmation") === "on",
    instructions: text(formData, "instructions", 4_000),
    dailyRunLimit: text(formData, "dailyRunLimit", 8),
  });
  if (!result.ok) done({ erro: result.error });
  await logEvent({ event: "ai.settings", message: "Configuração da IA atualizada.", actorEmail: user.email });
  done({ aviso: "ia-salva" });
}

export async function testAiConnectionAction() {
  await requireManagementUser();
  const result = await testAiConnection();
  if (!result.ok) done({ erro: result.error });
  done({ aviso: "ia-teste", ia_resposta: result.reply, ia_modelo: result.model, ia_ms: String(result.ms) });
}

export async function disableAiAction() {
  const user = await requireManagementUser();
  await disableAi();
  await logEvent({ level: "warning", event: "ai.disabled", message: "IA desligada e chave removida.", actorEmail: user.email });
  done({ aviso: "ia-desligada" });
}

export type TokenState = { token: string | null; error: string | null };

/** Gera o token de acesso externo e o devolve uma vez para a tela (nunca vai para a URL). */
export async function rotateExternalTokenAction(previous: TokenState): Promise<TokenState> {
  void previous;
  const user = await requireManagementUser();
  const token = await rotateExternalToken();
  await logEvent({ level: "warning", event: "ai.token.rotated", message: "Token de acesso externo da IA gerado (o anterior deixou de valer).", actorEmail: user.email });
  revalidatePath("/integracoes");
  return { token, error: null };
}

export async function revokeExternalTokenAction() {
  const user = await requireManagementUser();
  await revokeExternalToken();
  await logEvent({ level: "warning", event: "ai.token.revoked", message: "Token de acesso externo da IA revogado.", actorEmail: user.email });
  done({ aviso: "ia-token-revogado" });
}

/** Exclui uma conversa do assistente (mensagens e etapas). A auditoria das alterações vai junto com a conversa. */
export async function deleteAssistantConversationAction(formData: FormData) {
  await requireManagementUser();
  const id = text(formData, "conversationId", 50);
  if (id) await prisma.aiConversation.deleteMany({ where: { id, channel: "GESTAO" } });
  revalidatePath("/assistente");
  redirect("/assistente");
}
