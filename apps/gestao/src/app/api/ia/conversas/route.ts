import { getManagementUser } from "@/features/auth/services/auth-session";
import { sendAiMessage } from "@/features/ai/services/ai-runs";
import { conversationView, findConversation, openConversation, runView } from "@/features/ai/services/conversations";
import { aiErrorResponse, field, readJson } from "@/features/ai/services/http";

/**
 * Conversa com a IA na gestão. POST envia uma mensagem (202 com o id da resposta na fila); GET devolve a conversa
 * ou, com ?run=, a situação da resposta (PENDING, RUNNING, DONE com o texto, FAILED com o erro).
 */

export async function POST(request: Request) {
  const user = await getManagementUser();
  if (!user) return Response.json({ error: "Não autorizado." }, { status: 403 });
  const body = await readJson(request);
  if (!body) return Response.json({ error: "Corpo inválido." }, { status: 400 });
  const conversation = await openConversation({ channel: "GESTAO", userId: user.id }, field(body, "conversationId", 50) || null);
  if (!conversation) return Response.json({ error: "Conversa não encontrada." }, { status: 404 });
  try {
    const runId = await sendAiMessage({ conversationId: conversation.id, channel: "GESTAO", text: field(body, "message", 4_000) });
    return Response.json({ conversationId: conversation.id, runId }, { status: 202 });
  } catch (error) {
    return aiErrorResponse(error);
  }
}

export async function GET(request: Request) {
  const user = await getManagementUser();
  if (!user) return Response.json({ error: "Não autorizado." }, { status: 403 });
  const params = new URL(request.url).searchParams;
  const conversation = await findConversation({ channel: "GESTAO", userId: user.id }, params.get("conversationId"));
  if (!conversation) return Response.json({ error: "Conversa não encontrada." }, { status: 404 });
  const run = params.get("run");
  if (run) {
    const view = await runView(conversation.id, run);
    return view ? Response.json(view) : Response.json({ error: "Resposta não encontrada." }, { status: 404 });
  }
  return Response.json(await conversationView(conversation.id));
}
