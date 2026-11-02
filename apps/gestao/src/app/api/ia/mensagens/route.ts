import { sendAiMessage } from "@/features/ai/services/ai-runs";
import { loadAiRuntime, normalizePhone, verifyExternalToken } from "@/features/ai/services/ai-settings";
import { findConversation, openConversation, runView } from "@/features/ai/services/conversations";
import { aiErrorResponse, field, rateLimited, readJson } from "@/features/ai/services/http";

/**
 * Entrada de mensagens do WhatsApp (a ponte), autenticada pelo token de Integrações ("Authorization: Bearer …").
 * Seus números conversam com acesso de gestão. Os demais só são atendidos com o atendimento pelo WhatsApp ligado,
 * no modo atendimento (serviços e contato, com as instruções de atendimento) e com limite de mensagens por número.
 *   POST { "de": "5582999990000", "texto": "…" }  → 202 { runId, perfil: "dono" | "atendimento" }
 *   GET  ?de=5582999990000&run=<runId>              → { status, reply }
 */

async function resolve(request: Request, from: string, create: boolean) {
  if (!(await verifyExternalToken(request.headers.get("authorization")))) return { error: Response.json({ error: "Não autorizado." }, { status: 401 }) };
  const phone = normalizePhone(from);
  if (!phone) return { error: Response.json({ error: "Número inválido. Use DDI + DDD + número, só dígitos." }, { status: 400 }) };
  const loaded = await loadAiRuntime();
  if (!loaded.ok) return { error: Response.json({ error: loaded.error }, { status: 503 }) };
  const owner = loaded.runtime.ownerPhones.includes(phone);
  if (!owner && !loaded.runtime.whatsappAttendance) return { error: Response.json({ error: "Número não autorizado." }, { status: 403 }) };
  const conversation = create ? await openConversation({ channel: "WHATSAPP", externalKey: phone }) : await findConversation({ channel: "WHATSAPP", externalKey: phone });
  return conversation ? { conversation, phone, owner } : { error: Response.json({ error: "Conversa não encontrada." }, { status: 404 }) };
}

export async function POST(request: Request) {
  const body = await readJson(request);
  if (!body) return Response.json({ error: "Corpo inválido." }, { status: 400 });
  const found = await resolve(request, field(body, "de", 30), true);
  if ("error" in found) return found.error;
  if (!found.owner && rateLimited(`whatsapp:${found.phone}`, 15, 10 * 60_000)) return Response.json({ error: "Muitas mensagens em pouco tempo." }, { status: 429 });
  try {
    const runId = await sendAiMessage({ conversationId: found.conversation.id, channel: "WHATSAPP", text: field(body, "texto", found.owner ? 4_000 : 1_000) });
    return Response.json({ runId, perfil: found.owner ? "dono" : "atendimento" }, { status: 202 });
  } catch (error) {
    return aiErrorResponse(error);
  }
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const found = await resolve(request, params.get("de") ?? "", false);
  if ("error" in found) return found.error;
  const view = await runView(found.conversation.id, params.get("run") ?? "");
  return view ? Response.json({ status: view.status, reply: view.reply }) : Response.json({ error: "Resposta não encontrada." }, { status: 404 });
}
