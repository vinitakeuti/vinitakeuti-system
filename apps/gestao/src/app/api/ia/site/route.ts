import { sendAiMessage } from "@/features/ai/services/ai-runs";
import { findConversation, openConversation, runView } from "@/features/ai/services/conversations";
import { aiErrorResponse, clientIp, field, rateLimited, readJson } from "@/features/ai/services/http";
import { isAiChannelOpen } from "@/features/ai/services/ai-settings";

/**
 * Atendimento do site (viniciusriudi.com), público. O site gera um sessionId aleatório por visitante e o envia em
 * cada mensagem; a resposta é acompanhada com GET ?sessionId=…&run=…. Só serviços e contato; limites por IP e sessão.
 */

const SITE_ORIGINS = new Set(["https://viniciusriudi.com", "https://www.viniciusriudi.com"]);
const SESSION_ID = /^[A-Za-z0-9_-]{16,64}$/;

function cors(request: Request) {
  const origin = request.headers.get("origin") ?? "";
  const allowed = SITE_ORIGINS.has(origin) || (process.env.NODE_ENV !== "production" && /^http:\/\/localhost(:\d+)?$/.test(origin));
  return { ...(allowed ? { "access-control-allow-origin": origin, vary: "Origin" } : {}), "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type", "access-control-max-age": "600", "cache-control": "no-store" };
}

export function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: cors(request) });
}

export async function POST(request: Request) {
  const headers = cors(request);
  if (rateLimited(`site-ip:${clientIp(request)}`, 20, 10 * 60_000)) return Response.json({ error: "Muitas mensagens em pouco tempo. Aguarde alguns minutos." }, { status: 429, headers });
  const body = await readJson(request);
  const sessionId = field(body, "sessionId", 64);
  if (!body || !SESSION_ID.test(sessionId)) return Response.json({ error: "Sessão inválida." }, { status: 400, headers });
  if (!(await isAiChannelOpen("SITE"))) return Response.json({ error: "Atendimento indisponível no momento." }, { status: 503, headers });
  if (rateLimited(`site-session:${sessionId}`, 12, 10 * 60_000)) return Response.json({ error: "Muitas mensagens em pouco tempo. Aguarde alguns minutos." }, { status: 429, headers });
  const conversation = await openConversation({ channel: "SITE", externalKey: sessionId });
  if (!conversation) return Response.json({ error: "Sessão inválida." }, { status: 400, headers });
  try {
    const runId = await sendAiMessage({ conversationId: conversation.id, channel: "SITE", text: field(body, "message", 1_000) });
    return Response.json({ runId }, { status: 202, headers });
  } catch (error) {
    return aiErrorResponse(error, headers);
  }
}

export async function GET(request: Request) {
  const headers = cors(request);
  const params = new URL(request.url).searchParams;
  const sessionId = params.get("sessionId") ?? "";
  const run = params.get("run") ?? "";
  if (!SESSION_ID.test(sessionId) || !run) return Response.json({ error: "Parâmetros inválidos." }, { status: 400, headers });
  const conversation = await findConversation({ channel: "SITE", externalKey: sessionId });
  const view = conversation ? await runView(conversation.id, run) : null;
  return view ? Response.json({ status: view.status, reply: view.reply }, { headers }) : Response.json({ error: "Resposta não encontrada." }, { status: 404, headers });
}
