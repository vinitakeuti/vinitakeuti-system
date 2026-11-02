import { getClientUser } from "@/features/auth/services/auth-session";
import { sendAiMessage } from "@/features/ai/services/ai-runs";
import { conversationView, findConversation, openConversation, runView } from "@/features/ai/services/conversations";
import { aiErrorResponse, field, rateLimited, readJson } from "@/features/ai/services/http";

/** Conversa com a IA na área do cliente: só os dados do próprio cliente, sem alterar nada. Mesmo contrato da gestão. */

export async function POST(request: Request) {
  const user = await getClientUser();
  if (!user?.clientId) return Response.json({ error: "Não autorizado." }, { status: 403 });
  if (rateLimited(`portal:${user.id}`, 30, 10 * 60_000)) return Response.json({ error: "Muitas mensagens em pouco tempo. Aguarde alguns minutos." }, { status: 429 });
  const body = await readJson(request);
  if (!body) return Response.json({ error: "Corpo inválido." }, { status: 400 });
  const conversation = await openConversation({ channel: "PORTAL", clientId: user.clientId, userId: user.id }, field(body, "conversationId", 50) || null);
  if (!conversation) return Response.json({ error: "Conversa não encontrada." }, { status: 404 });
  try {
    const runId = await sendAiMessage({ conversationId: conversation.id, channel: "PORTAL", text: field(body, "message", 2_000) });
    return Response.json({ conversationId: conversation.id, runId }, { status: 202 });
  } catch (error) {
    return aiErrorResponse(error);
  }
}

export async function GET(request: Request) {
  const user = await getClientUser();
  if (!user?.clientId) return Response.json({ error: "Não autorizado." }, { status: 403 });
  const params = new URL(request.url).searchParams;
  const conversation = await findConversation({ channel: "PORTAL", clientId: user.clientId, userId: user.id }, params.get("conversationId"));
  if (!conversation) return Response.json({ error: "Conversa não encontrada." }, { status: 404 });
  const run = params.get("run");
  if (run) {
    const view = await runView(conversation.id, run);
    return view ? Response.json(view) : Response.json({ error: "Resposta não encontrada." }, { status: 404 });
  }
  return Response.json(await conversationView(conversation.id));
}
