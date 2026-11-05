/**
 * Formato comum para conversar com qualquer provedor de IA. Cada adaptador (OpenAI-compatível, Anthropic) traduz
 * deste formato para a API dele e de volta, então o restante do sistema não depende de qual provedor está em uso.
 */

export type JsonSchema = { type?: string | string[]; description?: string; properties?: Record<string, JsonSchema>; required?: string[]; items?: JsonSchema; enum?: readonly unknown[]; minimum?: number; maximum?: number; minLength?: number; maxLength?: number; pattern?: string; additionalProperties?: boolean };

export type AiToolCall = { id: string; name: string; input: Record<string, unknown> };

export type AiChatMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; toolCalls?: AiToolCall[] }
  | { role: "tool"; toolCallId: string; name: string; content: string };

export type AiToolSpec = { name: string; description: string; parameters: JsonSchema };

export type AiCompletionRequest = {
  /** Instruções fixas (iguais entre mensagens): vão primeiro e entram no cache do prompt quando o modelo suporta. */
  system: string;
  /** Parte que muda a cada mensagem (hora, dados do visitante): vai depois, fora do cache. */
  systemDynamic?: string;
  messages: AiChatMessage[];
  tools?: AiToolSpec[];
  maxTokens?: number;
  temperature?: number;
  /** Tempo máximo da chamada; respostas longas (plano de projeto) precisam de mais que o padrão. */
  timeoutMs?: number;
};

export type AiCompletion = {
  text: string;
  toolCalls: AiToolCall[];
  /**
   * inputTokens inclui os tokens lidos e gravados no cache. costUsd: custo informado pelo provedor (OpenRouter); null
   * quando ele não informa.
   */
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; costUsd: number | null };
  stopReason: "end" | "tool_use" | "length" | "other";
  model: string;
};

export type AiProviderConfig = { provider: string; baseUrl: string; apiKey: string; model: string };

export interface AiProvider {
  readonly id: string;
  complete(request: AiCompletionRequest): Promise<AiCompletion>;
}

/** Erro do provedor. `retryable` indica falha passageira (limite de uso, instabilidade, tempo esgotado). */
export class AiProviderError extends Error {
  constructor(message: string, readonly status: number | null = null, readonly retryable = false) {
    super(message);
    this.name = "AiProviderError";
  }
}

export const AI_REQUEST_TIMEOUT_MS = 90_000;

/** Lê a mensagem de erro do corpo da resposta, sem repassar o corpo inteiro. */
export async function providerError(response: Response, provider: string) {
  let detail = "";
  try {
    const body = await response.json() as { error?: { message?: string } | string; message?: string };
    detail = typeof body.error === "string" ? body.error : body.error?.message ?? body.message ?? "";
  } catch { /* corpo não é JSON */ }
  const retryable = response.status === 429 || response.status === 408 || response.status >= 500;
  const reason = response.status === 401 || response.status === 403 ? "chave recusada" : response.status === 429 ? "limite de uso atingido" : response.status === 404 ? "modelo ou endereço não encontrado" : `HTTP ${response.status}`;
  return new AiProviderError(`${provider}: ${reason}${detail ? ` (${detail.slice(0, 200)})` : ""}`, response.status, retryable);
}

/** Falha de rede ou tempo esgotado vira um erro passageiro. */
export function networkError(error: unknown, provider: string) {
  if (error instanceof AiProviderError) return error;
  const timeout = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
  return new AiProviderError(`${provider}: ${timeout ? "tempo de resposta esgotado" : "falha de conexão"}`, null, true);
}

export function parseToolArguments(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

/** Modelo disponível para a chave. `tools` diz se o modelo usa ferramentas (null quando o provedor não informa). */
export type AiModelInfo = {
  id: string;
  label: string;
  tools: boolean | null;
  contextLength: number | null;
  /** Preço em dólares por milhão de tokens (entrada e saída), quando o provedor informa (OpenRouter). */
  price: { input: number; output: number } | null;
};

export const AI_LIST_TIMEOUT_MS = 15_000;
