import { AI_LIST_TIMEOUT_MS, AI_REQUEST_TIMEOUT_MS, networkError, parseToolArguments, providerError, type AiChatMessage, type AiCompletion, type AiCompletionRequest, type AiModelInfo, type AiProvider, type AiProviderConfig } from "@/lib/integrations/ai/types";

/**
 * API de chat no formato da OpenAI (/chat/completions com tools). Atende OpenAI, OpenRouter, Gemini (endpoint
 * compatível), Groq, DeepSeek, Ollama e qualquer outro serviço que siga o mesmo formato.
 */

type ContentPart = { type: "text"; text: string; cache_control?: { type: "ephemeral" } };
type OpenAiMessage =
  | { role: "system"; content: string | ContentPart[] }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }> }
  | { role: "tool"; tool_call_id: string; content: string };

type OpenAiResponse = {
  model?: string;
  choices?: Array<{ finish_reason?: string; message?: { content?: string | null; tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: unknown } }> } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number; prompt_tokens_details?: { cached_tokens?: number; cache_write_tokens?: number } };
};

function toOpenAi(message: AiChatMessage): OpenAiMessage {
  if (message.role === "user") return { role: "user", content: message.content };
  if (message.role === "tool") return { role: "tool", tool_call_id: message.toolCallId, content: message.content };
  return {
    role: "assistant",
    content: message.content || null,
    ...(message.toolCalls?.length ? { tool_calls: message.toolCalls.map((call) => ({ id: call.id, type: "function" as const, function: { name: call.name, arguments: JSON.stringify(call.input) } })) } : {}),
  };
}

/**
 * Instrução de sistema. Pelo OpenRouter, nos modelos Claude, a parte fixa leva cache_control (cache do prompt da
 * Anthropic). Nos demais (OpenAI, Gemini…), o cache é automático quando o começo do prompt se repete, por isso a
 * parte fixa vai sempre primeiro e a que muda vai no fim.
 */
function systemMessage(config: AiProviderConfig, request: AiCompletionRequest): OpenAiMessage {
  const dynamic = request.systemDynamic?.trim();
  if (config.provider === "openrouter" && config.model.startsWith("anthropic/")) {
    return { role: "system", content: [{ type: "text", text: request.system, cache_control: { type: "ephemeral" } }, ...(dynamic ? [{ type: "text" as const, text: dynamic }] : [])] };
  }
  return { role: "system", content: dynamic ? `${request.system}\n\n${dynamic}` : request.system };
}

export function createOpenAiCompatibleProvider(config: AiProviderConfig, label: string): AiProvider {
  const endpoint = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  return {
    id: config.provider,
    async complete(request: AiCompletionRequest): Promise<AiCompletion> {
      let response: Response;
      try {
        response = await fetch(endpoint, {
          method: "POST",
          signal: AbortSignal.timeout(request.timeoutMs ?? AI_REQUEST_TIMEOUT_MS),
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${config.apiKey}`,
            // Identificação do app no OpenRouter (ignorada pelos demais).
            "http-referer": "https://gestao.viniciusriudi.com",
            "x-title": "VR Gestão",
          },
          body: JSON.stringify({
            model: config.model,
            messages: [systemMessage(config, request), ...request.messages.map(toOpenAi)],
            ...(request.tools?.length ? { tools: request.tools.map((tool) => ({ type: "function", function: { name: tool.name, description: tool.description, parameters: tool.parameters } })) } : {}),
            max_tokens: request.maxTokens ?? 1_500,
            ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
            // O OpenRouter devolve o custo da resposta (em dólar) quando pedido; os demais recusariam o parâmetro.
            ...(config.provider === "openrouter" ? { usage: { include: true } } : {}),
          }),
        });
      } catch (error) {
        throw networkError(error, label);
      }
      if (!response.ok) throw await providerError(response, label);
      const body = await response.json() as OpenAiResponse;
      const choice = body.choices?.[0];
      const toolCalls = (choice?.message?.tool_calls ?? []).filter((call) => call.function?.name).map((call, index) => ({ id: call.id || `call_${index}`, name: call.function!.name!, input: parseToolArguments(call.function!.arguments) }));
      const finish = choice?.finish_reason;
      return {
        text: choice?.message?.content?.trim() ?? "",
        toolCalls,
        usage: { inputTokens: body.usage?.prompt_tokens ?? 0, outputTokens: body.usage?.completion_tokens ?? 0, cacheReadTokens: body.usage?.prompt_tokens_details?.cached_tokens ?? 0, cacheWriteTokens: body.usage?.prompt_tokens_details?.cache_write_tokens ?? 0, costUsd: typeof body.usage?.cost === "number" && Number.isFinite(body.usage.cost) ? body.usage.cost : null },
        stopReason: toolCalls.length || finish === "tool_calls" ? "tool_use" : finish === "length" ? "length" : finish === "stop" ? "end" : "other",
        model: body.model ?? config.model,
      };
    },
  };
}

type OpenAiModel = { id?: string; name?: string; context_length?: number; supported_parameters?: string[]; pricing?: { prompt?: string; completion?: string } };

/**
 * Modelos de GET /models. O OpenRouter informa nome, contexto, preço e se o modelo aceita ferramentas; os demais
 * só o id. O prefixo "models/" do Gemini é removido (o chat aceita o nome sem ele).
 */
export async function listOpenAiCompatibleModels(config: Omit<AiProviderConfig, "model">, label: string): Promise<AiModelInfo[]> {
  let response: Response;
  try {
    response = await fetch(`${config.baseUrl.replace(/\/+$/, "")}/models`, { signal: AbortSignal.timeout(AI_LIST_TIMEOUT_MS), headers: { authorization: `Bearer ${config.apiKey}`, accept: "application/json" }, cache: "no-store" });
  } catch (error) {
    throw networkError(error, label);
  }
  if (!response.ok) throw await providerError(response, label);
  const body = await response.json() as { data?: OpenAiModel[] };
  return (body.data ?? []).filter((model) => typeof model.id === "string" && model.id).map((model) => {
    const id = model.id!.replace(/^models\//, "");
    const input = Number(model.pricing?.prompt);
    const output = Number(model.pricing?.completion);
    return {
      id,
      label: model.name?.trim() || id,
      tools: Array.isArray(model.supported_parameters) ? model.supported_parameters.includes("tools") : null,
      contextLength: typeof model.context_length === "number" ? model.context_length : null,
      price: Number.isFinite(input) && Number.isFinite(output) && model.pricing ? { input: input * 1_000_000, output: output * 1_000_000 } : null,
    };
  });
}
