import { verifyExternalToken } from "@/features/ai/services/ai-settings";
import { handleMcp } from "@/features/ai/services/mcp-server";

/**
 * Servidor MCP da gestão (transporte HTTP, respostas JSON). Endereço: https://gestao.viniciusriudi.com/api/ia/mcp,
 * com "Authorization: Bearer <token de Integrações>".
 */

const MAX_BODY_BYTES = 256 * 1024;

export async function POST(request: Request) {
  if (!(await verifyExternalToken(request.headers.get("authorization")))) return Response.json({ error: "Não autorizado." }, { status: 401, headers: { "www-authenticate": "Bearer" } });
  const text = await request.text().catch(() => "");
  if (text.length > MAX_BODY_BYTES) return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Mensagem grande demais." } }, { status: 413 });
  let body: unknown;
  try { body = JSON.parse(text); } catch { return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "JSON inválido." } }, { status: 400 }); }
  const response = await handleMcp(body);
  return response ? Response.json(response, { headers: { "cache-control": "no-store" } }) : new Response(null, { status: 202 });
}

/** Sem fluxo de eventos (SSE): o servidor só responde às chamadas. */
export function GET() {
  return new Response(null, { status: 405, headers: { allow: "POST" } });
}
