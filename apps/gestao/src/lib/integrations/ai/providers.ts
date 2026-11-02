import { createAnthropicProvider, listAnthropicModels } from "@/lib/integrations/ai/anthropic";
import { createOpenAiCompatibleProvider, listOpenAiCompatibleModels } from "@/lib/integrations/ai/openai-compatible";
import type { AiModelInfo, AiProvider, AiProviderConfig } from "@/lib/integrations/ai/types";

/**
 * Provedores de IA suportados. Trocar de provedor é só configuração (Integrações): o restante do sistema usa a
 * interface AiProvider. "custom" aceita qualquer API compatível com a da OpenAI (Groq, DeepSeek, Ollama, LM Studio).
 */
export const AI_PROVIDERS = {
  openrouter: { label: "OpenRouter", api: "openai", baseUrl: "https://openrouter.ai/api/v1", keyHint: "sk-or-…", modelHint: "provedor/modelo, como na lista do OpenRouter" },
  anthropic: { label: "Anthropic (Claude)", api: "anthropic", baseUrl: "https://api.anthropic.com/v1", keyHint: "sk-ant-…", modelHint: "nome do modelo Claude, como na documentação da Anthropic" },
  openai: { label: "OpenAI (ChatGPT)", api: "openai", baseUrl: "https://api.openai.com/v1", keyHint: "sk-…", modelHint: "nome do modelo, como na documentação da OpenAI" },
  gemini: { label: "Google Gemini", api: "openai", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", keyHint: "AIza…", modelHint: "nome do modelo Gemini" },
  custom: { label: "Outro compatível com OpenAI", api: "openai", baseUrl: "", keyHint: "chave do serviço", modelHint: "nome do modelo no serviço" },
} as const;

export type AiProviderId = keyof typeof AI_PROVIDERS;

export function isAiProviderId(value: string): value is AiProviderId {
  return Object.hasOwn(AI_PROVIDERS, value);
}

/** Endereço da API: o informado (obrigatório em "custom") ou o padrão do provedor. */
export function aiProviderBaseUrl(provider: AiProviderId, baseUrl?: string | null) {
  return baseUrl?.trim() || AI_PROVIDERS[provider].baseUrl;
}

export function createAiProvider(config: AiProviderConfig): AiProvider {
  const provider = isAiProviderId(config.provider) ? config.provider : "custom";
  const info = AI_PROVIDERS[provider];
  return info.api === "anthropic" ? createAnthropicProvider(config) : createOpenAiCompatibleProvider(config, info.label);
}

/** Modelos que não conversam (imagem, áudio, embeddings, moderação): ficam fora da lista. */
const NOT_CHAT = /(embed|embedding|tts|whisper|transcribe|dall-e|davinci|babbage|moderation|image|imagen|audio|realtime|search|aqa|veo|lyria|computer-use|-sora|codex-mini)/i;
const MAX_MODELS = 600;

/**
 * Modelos disponíveis para a chave, só os de conversa. Quando o provedor informa (OpenRouter), só os que usam
 * ferramentas, que a IA da gestão precisa. Ordem alfabética pelo nome.
 */
export async function listAiModels(config: Omit<AiProviderConfig, "model">): Promise<AiModelInfo[]> {
  const provider = isAiProviderId(config.provider) ? config.provider : "custom";
  const info = AI_PROVIDERS[provider];
  const models = info.api === "anthropic" ? await listAnthropicModels(config) : await listOpenAiCompatibleModels(config, info.label);
  const unique = new Map<string, AiModelInfo>();
  for (const model of models) {
    if (model.tools === false || NOT_CHAT.test(model.id)) continue;
    if (!unique.has(model.id)) unique.set(model.id, model);
  }
  return [...unique.values()].sort((left, right) => left.label.localeCompare(right.label, "pt-BR")).slice(0, MAX_MODELS);
}
