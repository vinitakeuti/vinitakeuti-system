import { sendAiMessage } from "@/features/ai/services/ai-runs";
import { isAiChannelOpen } from "@/features/ai/services/ai-settings";
import { runView } from "@/features/ai/services/conversations";
import { aiErrorResponse, clientIp, field, rateLimited, readJson, siteCors } from "@/features/ai/services/http";
import { SITE_SESSION_ID, siteSession } from "@/features/ai/services/site-attendance";

/**
 * Atendimento do site (widget), público. O widget gera um sessionId por visitante.
 *   GET  ?status=1                     → { available } (o botão só aparece com o canal Site liberado)
 *   GET  ?sessionId=…                  → { started, name, messages, pendingRun } (retomar a conversa)
 *   GET  ?sessionId=…&run=…            → { status, reply }
 *   POST { sessionId, message }        → 202 { runId } (só depois de /api/ia/site/inicio com nome, telefone e e-mail)
 */

export function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: siteCors(request) });
}

export async function POST(request: Request) {
  const headers = siteCors(request);
  if (rateLimited(`site-ip:${clientIp(request)}`, 20, 10 * 60_000)) return Response.json({ error: "Muitas mensagens em pouco tempo. Aguarde alguns minutos." }, { status: 429, headers });
  const body = await readJson(request);
  const sessionId = field(body, "sessionId", 64);
  if (!body || !SITE_SESSION_ID.test(sessionId)) return Response.json({ error: "Sessão inválida." }, { status: 400, headers });
  if (!(await isAiChannelOpen("SITE"))) return Response.json({ error: "Atendimento indisponível no momento." }, { status: 503, headers });
  if (rateLimited(`site-session:${sessionId}`, 12, 10 * 60_000)) return Response.json({ error: "Muitas mensagens em pouco tempo. Aguarde alguns minutos." }, { status: 429, headers });
  const session = await siteSession(sessionId);
  if (!session) return Response.json({ error: "Preencha nome, telefone e e-mail para começar.", code: "dados" }, { status: 400, headers });
  try {
    const runId = await sendAiMessage({ conversationId: session.conversationId, channel: "SITE", text: field(body, "message", 1_000) });
    return Response.json({ runId }, { status: 202, headers });
  } catch (error) {
    return aiErrorResponse(error, headers);
  }
}

export async function GET(request: Request) {
  const headers = siteCors(request);
  const params = new URL(request.url).searchParams;
  if (params.get("status")) return Response.json({ available: await isAiChannelOpen("SITE") }, { headers });
  const sessionId = params.get("sessionId") ?? "";
  if (!SITE_SESSION_ID.test(sessionId)) return Response.json({ error: "Sessão inválida." }, { status: 400, headers });
  const session = await siteSession(sessionId);
  const run = params.get("run");
  if (run) {
    const view = session ? await runView(session.conversationId, run) : null;
    return view ? Response.json({ status: view.status, reply: view.reply }, { headers }) : Response.json({ error: "Resposta não encontrada." }, { status: 404, headers });
  }
  return Response.json(session ? { started: true, name: session.name, messages: session.messages, pendingRun: session.pendingRun } : { started: false }, { headers });
}
