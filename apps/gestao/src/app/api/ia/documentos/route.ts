import { getManagementUser } from "@/features/auth/services/auth-session";
import { field, rateLimited, readJson } from "@/features/ai/services/http";
import { DocumentAiError, documentAiModel, enqueueDocumentAiJob, type DocumentAiSourceInput } from "@/features/documents/services/document-ai";

/**
 * A Eliza no editor de PDF. POST { alvo: "proposta" | "documento", id, modo: "escrever" | "aperfeicoar", pedido,
 * trechos?: [{ id, tipo, texto }] } põe o pedido na fila (202 com o id); a situação sai em GET /api/ia/documentos/<id>.
 * Os trechos são os blocos do documento na ordem: "texto" (editável) e os componentes que a Eliza só lê
 * ("linha", "destaque", "quebra", "imagem", "fixo"). GET informa o modelo que trabalha nos documentos.
 */

const MAX_BODY_BYTES = 600 * 1024;
const ID = /^[A-Za-z0-9_-]{1,80}$/;
const KINDS: Record<string, DocumentAiSourceInput["kind"]> = { texto: "text", linha: "line", destaque: "accent", quebra: "page-break", imagem: "image", fixo: "fixed" };

export async function GET() {
  const user = await getManagementUser();
  if (!user) return Response.json({ error: "Não autorizado." }, { status: 403 });
  return Response.json(await documentAiModel(), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const user = await getManagementUser();
  if (!user) return Response.json({ error: "Não autorizado." }, { status: 403 });
  const body = await readJson(request, MAX_BODY_BYTES);
  if (!body) return Response.json({ error: "Pedido inválido ou grande demais." }, { status: 400 });
  if (rateLimited(`document-ai:${user.id}`, 20, 10 * 60_000)) return Response.json({ error: "Muitos pedidos em pouco tempo. Aguarde alguns minutos." }, { status: 429 });
  const target = field(body, "alvo", 20);
  const id = field(body, "id", 50);
  const mode = field(body, "modo", 20);
  if (!ID.test(id) || (target !== "proposta" && target !== "documento") || (mode !== "escrever" && mode !== "aperfeicoar")) return Response.json({ error: "Pedido inválido." }, { status: 400 });
  const blocks = (Array.isArray(body.trechos) ? body.trechos.slice(0, 400) : []).flatMap((item): DocumentAiSourceInput[] => {
    const entry = (item ?? {}) as Record<string, unknown>;
    const kind = typeof entry.tipo === "string" ? KINDS[entry.tipo] : undefined;
    if (typeof entry.id !== "string" || !ID.test(entry.id) || !kind) return [];
    return [{ id: entry.id, kind, text: typeof entry.texto === "string" ? entry.texto.slice(0, 120_000) : "" }];
  });
  try {
    const jobId = await enqueueDocumentAiJob({ target: target === "proposta" ? { quoteId: id } : { documentId: id }, mode: mode === "escrever" ? "WRITE" : "IMPROVE", prompt: typeof body.pedido === "string" ? body.pedido : "", blocks });
    return Response.json({ jobId }, { status: 202 });
  } catch (error) {
    if (error instanceof DocumentAiError) return Response.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
