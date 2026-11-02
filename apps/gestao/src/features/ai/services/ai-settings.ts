import { randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret, hashToken } from "@/lib/crypto";
import { AI_PROVIDERS, aiProviderBaseUrl, createAiProvider, isAiProviderId, listAiModels, type AiProviderId } from "@/lib/integrations/ai/providers";
import { AiProviderError } from "@/lib/integrations/ai/types";
import { parseUsd } from "@/features/ai/services/ai-costs";

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
    select: { isActive: true, provider: true, baseUrl: true, model: true, keyHint: true, channels: true, ownerPhones: true, requireConfirmation: true, instructions: true, serviceInstructions: true, whatsappAttendance: true, assistantName: true, dailyRunLimit: true, inputPriceMicros: true, outputPriceMicros: true, usdBrlCents: true, externalTokenHint: true, lastCheckedAt: true, lastError: true, updatedAt: true },
  });
}

export type AiRuntime = {
  providerId: AiProviderId;
  model: string;
  provider: ReturnType<typeof createAiProvider>;
  channels: Set<string>;
  ownerPhones: string[];
  requireConfirmation: boolean;
  generalInstructions: string | null;
  serviceInstructions: string | null;
  whatsappAttendance: boolean;
  assistantName: string | null;
  inputPriceMicros: number | null;
  outputPriceMicros: number | null;
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
      generalInstructions: settings.instructions,
      serviceInstructions: settings.serviceInstructions,
      whatsappAttendance: settings.whatsappAttendance,
      assistantName: settings.assistantName,
      inputPriceMicros: settings.inputPriceMicros,
      outputPriceMicros: settings.outputPriceMicros,
      dailyRunLimit: settings.dailyRunLimit,
    },
  };
}

/** Preços em dólar por milhão de tokens e cotação em reais por dólar, como digitados ("3,00"); vazio = sem valor. */
export type AiConnectionInput = { provider: string; baseUrl: string; model: string; apiKey: string; inputPrice: string; outputPrice: string; usdBrl: string };
export type AiRulesInput = { channels: string[]; ownerPhones: string; whatsappAttendance: boolean; requireConfirmation: boolean; dailyRunLimit: string };
export type AiContextInput = { assistantName: string; generalInstructions: string; serviceInstructions: string };

/** Limite de cada bloco de instruções: entram em toda resposta, então contam no custo de cada mensagem. */
export const AI_INSTRUCTIONS_MAX = 6_000;

/** Só dígitos, com DDI (5582999990000). */
export function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15 ? digits : null;
}

/** Endereço da API: HTTPS (ou HTTP só no próprio computador, para Ollama e LM Studio). Null quando inválido. */
function checkBaseUrl(provider: AiProviderId, value: string): { baseUrl: string } | { error: string } {
  const baseUrl = value.trim().slice(0, 300);
  if (baseUrl) {
    let url: URL;
    try { url = new URL(baseUrl); } catch { return { error: "Endereço da API inválido." }; }
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.protocol !== "https:" && !(local && url.protocol === "http:")) return { error: "O endereço da API precisa usar HTTPS." };
  }
  if (provider === "custom" && !baseUrl) return { error: "Informe o endereço da API do serviço compatível com a OpenAI." };
  return { baseUrl };
}

/**
 * Modelos disponíveis para a chave informada na tela ou, em branco, para a chave já salva (se for do mesmo
 * provedor). A chave digitada só é usada nesta consulta: só é gravada ao salvar.
 */
export async function listModelsForKey(input: { provider: string; baseUrl: string; apiKey: string }) {
  const provider = isAiProviderId(input.provider) ? input.provider : null;
  if (!provider) return { ok: false as const, error: "Escolha um provedor." };
  const checked = checkBaseUrl(provider, input.baseUrl);
  if ("error" in checked) return { ok: false as const, error: checked.error };
  let apiKey = input.apiKey.trim();
  if (!apiKey) {
    const saved = await prisma.aiSettings.findUnique({ where: { id: SETTINGS_ID }, select: { provider: true, apiKeyEncrypted: true } });
    if (!saved?.apiKeyEncrypted || saved.provider !== provider) return { ok: false as const, error: "Cole a chave de API para buscar os modelos." };
    try { apiKey = decryptSecret(saved.apiKeyEncrypted); } catch { return { ok: false as const, error: "Não foi possível ler a chave salva. Cole a chave de novo." }; }
  }
  if (apiKey.length < 8 || apiKey.length > 400) return { ok: false as const, error: "Chave de API inválida." };
  try {
    const models = await listAiModels({ provider, baseUrl: aiProviderBaseUrl(provider, checked.baseUrl), apiKey });
    if (!models.length) return { ok: false as const, error: "O provedor não devolveu nenhum modelo de conversa para esta chave. Digite o nome do modelo." };
    return { ok: true as const, models };
  } catch (error) {
    return { ok: false as const, error: error instanceof AiProviderError ? error.message : "Não foi possível consultar os modelos." };
  }
}

/**
 * Conexão: provedor, endereço, chave e modelo. Na primeira conexão o canal Gestão já vem liberado, para o assistente
 * funcionar na hora; os demais canais são liberados em "Canais e regras".
 */
export async function saveAiConnection(input: AiConnectionInput) {
  const provider = isAiProviderId(input.provider) ? input.provider : null;
  if (!provider) return { ok: false as const, error: "Escolha um provedor." };
  const checked = checkBaseUrl(provider, input.baseUrl);
  if ("error" in checked) return { ok: false as const, error: checked.error };
  const model = input.model.trim().slice(0, 120);
  if (!model) return { ok: false as const, error: "Escolha o modelo na lista (ou digite o nome)." };
  const apiKey = input.apiKey.trim();
  if (apiKey && (apiKey.length < 8 || apiKey.length > 400)) return { ok: false as const, error: "Chave de API inválida." };
  const current = await prisma.aiSettings.findUnique({ where: { id: SETTINGS_ID }, select: { apiKeyEncrypted: true, provider: true } });
  // Trocar de provedor exige a chave do novo provedor.
  if (!apiKey && (!current?.apiKeyEncrypted || current.provider !== provider)) return { ok: false as const, error: "Informe a chave de API do provedor." };
  const inputPriceMicros = parseUsd(input.inputPrice);
  const outputPriceMicros = parseUsd(input.outputPrice);
  if (Number.isNaN(inputPriceMicros) || Number.isNaN(outputPriceMicros)) return { ok: false as const, error: "Preço por milhão de tokens inválido. Use dólares, como 3,00." };
  if ((inputPriceMicros === null) !== (outputPriceMicros === null)) return { ok: false as const, error: "Informe os dois preços (entrada e saída) ou deixe os dois em branco." };
  const rateText = input.usdBrl.trim().replace(/^R\$\s*/i, "");
  const rate = rateText ? Number(rateText.replace(",", ".")) : null;
  if (rate !== null && (!Number.isFinite(rate) || rate < 1 || rate > 50)) return { ok: false as const, error: "Cotação do dólar inválida (ex.: 5,50)." };
  const data = { provider, baseUrl: checked.baseUrl || null, model, isActive: true, inputPriceMicros, outputPriceMicros, usdBrlCents: rate === null ? null : Math.round(rate * 100), ...(apiKey ? { apiKeyEncrypted: encryptSecret(apiKey), keyHint: apiKey.slice(-4) } : {}) };
  await prisma.aiSettings.upsert({ where: { id: SETTINGS_ID }, create: { id: SETTINGS_ID, ...data, channels: ["GESTAO"] }, update: data });
  return { ok: true as const };
}

/** Canais liberados, números do dono no WhatsApp, limite diário, confirmação e instruções extras. */
export async function saveAiRules(input: AiRulesInput) {
  const channels = AI_CHANNELS.filter((channel) => input.channels.includes(channel));
  const phones = input.ownerPhones.split(/[\n,;]+/).map((value) => value.trim()).filter(Boolean);
  const ownerPhones = [...new Set(phones.map(normalizePhone).filter((value): value is string => Boolean(value)))].slice(0, 5);
  if (phones.length && ownerPhones.length !== Math.min(phones.length, 5)) return { ok: false as const, error: "Informe os números de WhatsApp com DDI e DDD, só dígitos (ex.: 5582999990000)." };
  if (channels.includes("WHATSAPP") && !ownerPhones.length && !input.whatsappAttendance) return { ok: false as const, error: "Para liberar o WhatsApp, informe ao menos um número seu ou ative o atendimento de outros números." };
  const limitText = input.dailyRunLimit.trim();
  const dailyRunLimit = limitText ? Math.floor(Number(limitText)) : null;
  if (dailyRunLimit !== null && (!Number.isFinite(dailyRunLimit) || dailyRunLimit < 1 || dailyRunLimit > 100_000)) return { ok: false as const, error: "Limite diário inválido." };
  const data = { channels, ownerPhones, whatsappAttendance: input.whatsappAttendance, requireConfirmation: input.requireConfirmation, dailyRunLimit };
  await prisma.aiSettings.upsert({ where: { id: SETTINGS_ID }, create: { id: SETTINGS_ID, ...data }, update: data });
  return { ok: true as const };
}

/** Contexto: instruções gerais (todas as conversas) e de atendimento (clientes e visitantes). */
export async function saveAiContext(input: AiContextInput) {
  const general = input.generalInstructions.trim();
  const service = input.serviceInstructions.trim();
  if (general.length > AI_INSTRUCTIONS_MAX || service.length > AI_INSTRUCTIONS_MAX) return { ok: false as const, error: `Cada bloco de instruções aceita até ${AI_INSTRUCTIONS_MAX.toLocaleString("pt-BR")} caracteres.` };
  const name = input.assistantName.replace(/\s+/g, " ").trim().slice(0, 40);
  if (name && !/^[\p{L}][\p{L} .'-]*$/u.test(name)) return { ok: false as const, error: "O nome da assistente aceita só letras, espaço, ponto, hífen e apóstrofo." };
  const data = { assistantName: name || null, instructions: general || null, serviceInstructions: service || null };
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
