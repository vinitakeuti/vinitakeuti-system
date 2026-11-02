import { prisma } from "@/lib/prisma";
import { ToolInputError } from "@/features/ai/tools/schema";
import { toolsForScope } from "@/features/ai/tools/registry";
import type { AiTool, ToolContext } from "@/features/ai/tools/tool";
import { runToolNow } from "@/features/ai/services/tool-executor";
import { openConversation } from "@/features/ai/services/conversations";

/**
 * Servidor MCP (Model Context Protocol) das ferramentas da gestão, por HTTP (JSON-RPC, sem sessão). Um agente externo
 * (o do WhatsApp, Claude Desktop, outro assistente) conectado com o token de Integrações usa as mesmas ferramentas
 * do escopo "owner". A confirmação fica com o agente externo; toda chamada entra na auditoria da IA.
 */

type JsonRpcRequest = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };
type JsonRpcResponse = { jsonrpc: "2.0"; id: string | number | null; result?: unknown; error?: { code: number; message: string } };

const SUPPORTED_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const SERVER_INFO = { name: "vr-gestao", title: "VR Gestão", version: "1.0.0" };
/** Confirmar e cancelar só fazem sentido nas conversas da própria IA. */
const HIDDEN = new Set(["confirmar_acao", "cancelar_acao"]);

function mcpTools() {
  return (toolsForScope("owner") as AiTool<never>[]).filter((tool) => !HIDDEN.has(tool.name));
}

async function callTool(name: string, args: unknown) {
  const tool = mcpTools().find((item) => item.name === name);
  if (!tool) return { content: [{ type: "text", text: `Ferramenta desconhecida: ${name}` }], isError: true };
  let input: never;
  try { input = tool.input.parse(args) as never; }
  catch (error) {
    if (error instanceof ToolInputError) return { content: [{ type: "text", text: `Entrada inválida. ${error.message}` }], isError: true };
    throw error;
  }
  // Uma conversa do sistema por dia agrupa as chamadas do MCP na auditoria.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Maceio" }).format(new Date());
  const conversation = await openConversation({ channel: "SISTEMA", externalKey: `mcp:${today}` });
  if (!conversation) throw new Error("Conversa de auditoria indisponível.");
  await prisma.aiConversation.update({ where: { id: conversation.id }, data: { lastMessageAt: new Date(), title: `MCP · ${today}` } });
  const context: ToolContext = { scope: "owner", channel: "SISTEMA", conversationId: conversation.id, clientId: null, actor: "mcp", runId: null };
  const result = await runToolNow(tool, input, context, args);
  const failed = Boolean(result) && typeof result === "object" && "erro" in (result as object);
  return { content: [{ type: "text", text: JSON.stringify(result) }], isError: failed };
}

async function handle(message: JsonRpcRequest): Promise<JsonRpcResponse | null> {
  const id = message.id ?? null;
  // Notificações (sem id) não têm resposta.
  if (message.id === undefined) return null;
  const reply = (result: unknown): JsonRpcResponse => ({ jsonrpc: "2.0", id, result });
  const fail = (code: number, text: string): JsonRpcResponse => ({ jsonrpc: "2.0", id, error: { code, message: text } });
  switch (message.method) {
    case "initialize": {
      const requested = typeof message.params?.protocolVersion === "string" ? message.params.protocolVersion : "";
      return reply({ protocolVersion: SUPPORTED_VERSIONS.includes(requested) ? requested : SUPPORTED_VERSIONS[0], capabilities: { tools: { listChanged: false } }, serverInfo: SERVER_INFO, instructions: "Ferramentas da VR Gestão (Financeiro, vendas, documentos, clientes e sistemas monitorados de Vinicius Riudi). Valores em reais, datas AAAA-MM-DD. Ferramentas que alteram dados executam na hora: confirme com a pessoa antes de chamá-las." });
    }
    case "ping":
      return reply({});
    case "tools/list":
      return reply({ tools: mcpTools().map((tool) => ({ name: tool.name, description: tool.description, inputSchema: tool.input.json, annotations: { readOnlyHint: !tool.mutates, destructiveHint: false } })) });
    case "tools/call": {
      const name = typeof message.params?.name === "string" ? message.params.name : "";
      return reply(await callTool(name, message.params?.arguments ?? {}));
    }
    default:
      return fail(-32601, `Método não suportado: ${message.method ?? "(vazio)"}`);
  }
}

/** Atende uma mensagem ou um lote JSON-RPC. Devolve null quando só havia notificações. */
export async function handleMcp(body: unknown) {
  if (Array.isArray(body)) {
    const responses = (await Promise.all(body.slice(0, 20).map((item) => handle(item as JsonRpcRequest)))).filter(Boolean);
    return responses.length ? responses : null;
  }
  if (!body || typeof body !== "object") return { jsonrpc: "2.0", id: null, error: { code: -32700, message: "JSON inválido." } };
  return handle(body as JsonRpcRequest);
}
