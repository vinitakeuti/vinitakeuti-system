import { randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret, hashToken } from "@/lib/crypto";
import { AI_PROVIDERS, aiProviderBaseUrl, createAiProvider, isAiProviderId, type AiProviderId } from "@/lib/integrations/ai/providers";
import { AiProviderError } from "@/lib/integrations/ai/types";

/**
 * Configuração da IA (Integrações). A chave do provedor fica criptografada e nunca volta para a tela; o token de
 * acesso externo (MCP e mensagens do WhatsApp) é mostrado uma vez e só o hash fica guardado.
 */

export const AI_CHANNELS = ["GESTAO", "PORTAL", "SITE", "WHATSAPP"] as const;
export type AiChannelOption = (typeof AI_CHANNELS)[number];

const SETTINGS_ID = "default";

/** Configuração para a tela, sem a chave nem o hash do token. */
export async function getAiSettingsView() {
  return prisma.aiSettings.findUnique({
    where: { id: SETTINGS_ID },
    select: { isActive: true, provider: true, baseUrl: true, model: true, keyHint: true, channels: true, ownerPhones: true, requireConfirmation: true, instructions: true, dailyRunLimit: true, externalTokenHint: true, lastCheckedAt: true, lastError: true, updatedAt: true },
  });
}

export type AiRuntime = {
  providerId: AiProviderId;
  model: string;
  provider: ReturnType<typeof createAiProvider>;
  channels: Set<string>;
  ownerPhones: string[];
  requireConfirmation: boolean;
  instructions: string | null;
  dailyRunLimit: number | null;
};

/** Configuração pronta para uso (chave decifrada), ou o motivo de a IA não estar disponível. */
export async function loadAiRuntime(): Promise<{ ok: true; runtime: AiRuntime } | { ok: false; error: string }> {
  const settings = await prisma.aiSettings.findUnique({ where: { id: SETTINGS_ID } });
  if (!settings?.isActive || !settings.apiKeyEncrypted || !settings.model) return { ok: false, error: "A IA não está configurada. Conecte um provedor em Integrações." };
  const providerId = isAiProviderId(settings.provider) ? settings.provider : "custom";
  const baseUrl = aiProviderBaseUrl(providerId, settings.baseUrl);
  if (!baseUrl) return { ok: false, error: "Informe o endereço da API do provedor em Integrações." };
  let apiKey: string;
  try { apiKey = decryptSecret(settings.apiKeyEncrypted); } catch { return { ok: false, error: "Não foi possível ler a chave da IA. Salve a chave de novo em Integrações." }; }
  return {
    ok: true,
    runtime: {
      providerId,
      model: settings.model,
      provider: createAiProvider({ provider: providerId, baseUrl, apiKey, model: settings.model }),
      channels: new Set(settings.channels),
      ownerPhones: settings.ownerPhones,
      requireConfirmation: settings.requireConfirmation,
      instructions: settings.instructions,
      dailyRunLimit: settings.dailyRunLimit,
    },
  };
}

export type AiSettingsInput = {
  provider: string;
  baseUrl: string;
  model: string;
  apiKey: string;
  channels: string[];
  ownerPhones: string;
  requireConfirmation: boolean;
  instructions: string;
  dailyRunLimit: string;
};

/** Só dígitos, com DDI (5582999990000). */
export function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}

export async function saveAiSettings(input: AiSettingsInput) {
  const provider = isAiProviderId(input.provider) ? input.provider : null;
  if (!provider) return { ok: false as const, error: "Escolha um provedor." };
  const baseUrl = input.baseUrl.trim().slice(0, 300);
  if (baseUrl) {
    let url: URL;
    try { url = new URL(baseUrl); } catch { return { ok: false as const, error: "Endereço da API inválido." }; }
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.protocol !== "https:" && !(local && url.protocol === "http:")) return { ok: false as const, error: "O endereço da API precisa usar HTTPS." };
  }
  if (provider === "custom" && !baseUrl) return { ok: false as const, error: "Informe o endereço da API do serviço compatível com a OpenAI." };
  const model = input.model.trim().slice(0, 120);
  if (!model) return { ok: false as const, error: "Informe o modelo." };
  const apiKey = input.apiKey.trim();
  if (apiKey && (apiKey.length < 8 || apiKey.length > 400)) return { ok: false as const, error: "Chave de API inválida." };
  const current = await prisma.aiSettings.findUnique({ where: { id: SETTINGS_ID }, select: { apiKeyEncrypted: true, provider: true } });
  // Trocar de provedor exige a chave do novo provedor.
  if (!apiKey && (!current?.apiKeyEncrypted || current.provider !== provider)) return { ok: false as const, error: "Informe a chave de API do provedor." };
  const channels = AI_CHANNELS.filter((channel) => input.channels.includes(channel));
  const phones = input.ownerPhones.split(/[\n,;]+/).map((value) => value.trim()).filter(Boolean);
  const ownerPhones = [...new Set(phones.map(normalizePhone).filter((value): value is string => Boolean(value)))].slice(0, 5);
  if (phones.length && ownerPhones.length !== Math.min(phones.length, 5)) return { ok: false as const, error: "Informe os números de WhatsApp com DDI e DDD, só dígitos (ex.: 5582999990000)." };
  const limitText = input.dailyRunLimit.trim();
  const dailyRunLimit = limitText ? Math.floor(Number(limitText)) : null;
  if (dailyRunLimit !== null && (!Number.isFinite(dailyRunLimit) || dailyRunLimit < 1 || dailyRunLimit > 100_000)) return { ok: false as const, error: "Limite diário inválido." };
  const data = {
    provider,
    baseUrl: baseUrl || null,
    model,
    channels,
    ownerPhones,
    requireConfirmation: input.requireConfirmation,
    instructions: input.instructions.trim().slice(0, 4_000) || null,
    dailyRunLimit,
    isActive: true,
    ...(apiKey ? { apiKeyEncrypted: encryptSecret(apiKey), keyHint: apiKey.slice(-4) } : {}),
  };
  await prisma.aiSettings.upsert({ where: { id: SETTINGS_ID }, create: { id: SETTINGS_ID, ...data }, update: data });
  return { ok: true as const };
}

export async function disableAi() {
  await prisma.aiSettings.updateMany({ where: { id: SETTINGS_ID }, data: { isActive: false, apiKeyEncrypted: null, keyHint: null } });
}

/** Testa a conexão com uma pergunta mínima e guarda o resultado. */
export async function testAiConnection() {
  const loaded = await loadAiRuntime();
  if (!loaded.ok) return { ok: false as const, error: loaded.error };
  const startedAt = Date.now();
  try {
    const completion = await loaded.runtime.provider.complete({ system: "Você está sendo testado. Responda apenas com a palavra OK.", messages: [{ role: "user", content: "Teste de conexão." }], maxTokens: 20 });
    await prisma.aiSettings.update({ where: { id: SETTINGS_ID }, data: { lastCheckedAt: new Date(), lastError: null } });
    return { ok: true as const, reply: completion.text.slice(0, 120) || "(resposta vazia)", model: completion.model, ms: Date.now() - startedAt, tokens: completion.usage.inputTokens + completion.usage.outputTokens };
  } catch (error) {
    const message = error instanceof AiProviderError ? error.message : `Falha inesperada: ${error instanceof Error ? error.message : String(error)}`;
    await prisma.aiSettings.update({ where: { id: SETTINGS_ID }, data: { lastCheckedAt: new Date(), lastError: message.slice(0, 500) } });
    return { ok: false as const, error: message };
  }
}

/** Gera um token novo de acesso externo (substitui o anterior) e o devolve uma única vez. */
export async function rotateExternalToken() {
  const token = `vrg_${randomBytes(32).toString("base64url")}`;
  const data = { externalTokenHash: hashToken(token), externalTokenHint: token.slice(-4) };
  await prisma.aiSettings.upsert({ where: { id: SETTINGS_ID }, create: { id: SETTINGS_ID, ...data }, update: data });
  return token;
}

export async function revokeExternalToken() {
  await prisma.aiSettings.updateMany({ where: { id: SETTINGS_ID }, data: { externalTokenHash: null, externalTokenHint: null } });
}

/** Confere o token "Authorization: Bearer …" das integrações externas. */
export async function verifyExternalToken(header: string | null) {
  const token = header?.match(/^Bearer\s+(\S{20,200})$/i)?.[1];
  if (!token) return false;
  const settings = await prisma.aiSettings.findUnique({ where: { id: SETTINGS_ID }, select: { externalTokenHash: true } });
  if (!settings?.externalTokenHash) return false;
  const expected = Buffer.from(settings.externalTokenHash, "hex");
  const received = Buffer.from(hashToken(token), "hex");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export const providerOptions = Object.entries(AI_PROVIDERS).map(([id, info]) => ({ id, label: info.label, baseUrl: info.baseUrl, keyHint: info.keyHint, modelHint: info.modelHint }));

/** Canal liberado e IA ativa, sem decifrar a chave (checagem barata antes de abrir conversa). */
export async function isAiChannelOpen(channel: AiChannelOption) {
  const settings = await prisma.aiSettings.findUnique({ where: { id: SETTINGS_ID }, select: { isActive: true, channels: true } });
  return Boolean(settings?.isActive && settings.channels.includes(channel));
}
