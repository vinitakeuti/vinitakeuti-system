import { AI_LIST_TIMEOUT_MS, AI_REQUEST_TIMEOUT_MS, networkError, parseToolArguments, providerError, type AiChatMessage, type AiCompletion, type AiCompletionRequest, type AiModelInfo, type AiProvider, type AiProviderConfig } from "@/lib/integrations/ai/types";

/** API Messages da Anthropic (Claude), com ferramentas. */

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string };

type AnthropicMessage = { role: "user" | "assistant"; content: string | ContentBlock[] };

type AnthropicResponse = {
  model?: string;
  stop_reason?: string;
  content?: Array<{ type?: string; text?: string; id?: string; name?: string; input?: unknown }>;
  usage?: { input_tokens?: number; output_tokens?: number };
};

/** Resultados de ferramentas vão numa mensagem do usuário; os consecutivos são agrupados numa só. */
function toAnthropic(messages: AiChatMessage[]): AnthropicMessage[] {
  const output: AnthropicMessage[] = [];
  for (const message of messages) {
    if (message.role === "tool") {
      const block: ContentBlock = { type: "tool_result", tool_use_id: message.toolCallId, content: message.content };
      const last = output.at(-1);
      if (last?.role === "user" && Array.isArray(last.content) && last.content.every((item) => item.type === "tool_result")) last.content.push(block);
      else output.push({ role: "user", content: [block] });
      continue;
    }
    if (message.role === "user") {
      output.push({ role: "user", content: message.content });
      continue;
    }
    const blocks: ContentBlock[] = [...(message.content ? [{ type: "text" as const, text: message.content }] : []), ...(message.toolCalls ?? []).map((call) => ({ type: "tool_use" as const, id: call.id, name: call.name, input: call.input }))];
    output.push({ role: "assistant", content: blocks.length ? blocks : "" });
  }
  return output;
}

export function createAnthropicProvider(config: AiProviderConfig): AiProvider {
  const endpoint = `${config.baseUrl.replace(/\/+$/, "")}/messages`;
  return {
    id: config.provider,
    async complete(request: AiCompletionRequest): Promise<AiCompletion> {
      let response: Response;
      try {
        response = await fetch(endpoint, {
          method: "POST",
          signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
          headers: { "content-type": "application/json", "x-api-key": config.apiKey, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({
            model: config.model,
            system: request.system,
            max_tokens: request.maxTokens ?? 1_500,
            messages: toAnthropic(request.messages),
            ...(request.tools?.length ? { tools: request.tools.map((tool) => ({ name: tool.name, description: tool.description, input_schema: tool.parameters })) } : {}),
            ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
          }),
        });
      } catch (error) {
        throw networkError(error, "Anthropic");
      }
      if (!response.ok) throw await providerError(response, "Anthropic");
      const body = await response.json() as AnthropicResponse;
      const blocks = body.content ?? [];
      const toolCalls = blocks.filter((block) => block.type === "tool_use" && block.name).map((block, index) => ({ id: block.id || `toolu_${index}`, name: block.name!, input: parseToolArguments(block.input) }));
      return {
        text: blocks.filter((block) => block.type === "text").map((block) => block.text ?? "").join("\n").trim(),
        toolCalls,
        usage: { inputTokens: body.usage?.input_tokens ?? 0, outputTokens: body.usage?.output_tokens ?? 0, costUsd: null },
        stopReason: body.stop_reason === "tool_use" ? "tool_use" : body.stop_reason === "max_tokens" ? "length" : body.stop_reason === "end_turn" ? "end" : "other",
        model: body.model ?? config.model,
      };
    },
  };
}

/** Modelos da conta na Anthropic (GET /v1/models, paginado). Todos os modelos Claude aceitam ferramentas. */
export async function listAnthropicModels(config: Omit<AiProviderConfig, "model">): Promise<AiModelInfo[]> {
  const models: AiModelInfo[] = [];
  let after: string | null = null;
  for (let page = 0; page < 5; page++) {
    let response: Response;
    try {
      response = await fetch(`${config.baseUrl.replace(/\/+$/, "")}/models?limit=100${after ? `&after_id=${encodeURIComponent(after)}` : ""}`, { signal: AbortSignal.timeout(AI_LIST_TIMEOUT_MS), headers: { "x-api-key": config.apiKey, "anthropic-version": "2023-06-01", accept: "application/json" }, cache: "no-store" });
    } catch (error) {
      throw networkError(error, "Anthropic");
    }
    if (!response.ok) throw await providerError(response, "Anthropic");
    const body = await response.json() as { data?: Array<{ id?: string; display_name?: string }>; has_more?: boolean; last_id?: string };
    for (const model of body.data ?? []) if (model.id) models.push({ id: model.id, label: model.display_name?.trim() || model.id, tools: true, contextLength: null, price: null });
    if (!body.has_more || !body.last_id) break;
    after = body.last_id;
  }
  return models;
}
