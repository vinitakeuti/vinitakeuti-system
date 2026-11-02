import { sendAiMessage } from "@/features/ai/services/ai-runs";
import { loadAiRuntime, normalizePhone, verifyExternalToken } from "@/features/ai/services/ai-settings";
import { findConversation, openConversation, runView } from "@/features/ai/services/conversations";
import { aiErrorResponse, field, readJson } from "@/features/ai/services/http";

/**
 * Entrada de mensagens de canais externos (a ponte do WhatsApp). Autenticada pelo token de Integrações
 * ("Authorization: Bearer …"). Só os números de WhatsApp do dono conversam, com acesso de gestão.
 *   POST { "de": "5582999990000", "texto": "quanto entrou este mês?" }  → 202 { runId }
 *   GET  ?de=5582999990000&run=<runId>                                   → { status, reply }
 */

async function ownerConversation(request: Request, from: string, create = true) {
  if (!(await verifyExternalToken(request.headers.get("authorization")))) return { error: Response.json({ error: "Não autorizado." }, { status: 401 }) };
  const phone = normalizePhone(from);
  const loaded = await loadAiRuntime();
  if (!loaded.ok) return { error: Response.json({ error: loaded.error }, { status: 503 }) };
  if (!phone || !loaded.runtime.ownerPhones.includes(phone)) return { error: Response.json({ error: "Número não autorizado." }, { status: 403 }) };
  const conversation = create ? await openConversation({ channel: "WHATSAPP", externalKey: phone }) : await findConversation({ channel: "WHATSAPP", externalKey: phone });
  return conversation ? { conversation } : { error: Response.json({ error: "Conversa não encontrada." }, { status: 404 }) };
}

export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body) return Response.json({ error: "Corpo inválido." }, { status: 400 });
  const found = await ownerConversation(request, field(body, "de", 30));
  if ("error" in found) return found.error;
  try {
    const runId = await sendAiMessage({ conversationId: found.conversation.id, channel: "WHATSAPP", text: field(body, "texto", 4_000) });
    return Response.json({ runId }, { status: 202 });
  } catch (error) {
    return aiErrorResponse(error);
  }
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const found = await ownerConversation(request, params.get("de") ?? "", false);
  if ("error" in found) return found.error;
  const view = await runView(found.conversation.id, params.get("run") ?? "");
  return view ? Response.json({ status: view.status, reply: view.reply }) : Response.json({ error: "Resposta não encontrada." }, { status: 404 });
}
