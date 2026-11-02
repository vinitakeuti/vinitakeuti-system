import { createAnthropicProvider } from "@/lib/integrations/ai/anthropic";
import { createOpenAiCompatibleProvider } from "@/lib/integrations/ai/openai-compatible";
import type { AiProvider, AiProviderConfig } from "@/lib/integrations/ai/types";

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
