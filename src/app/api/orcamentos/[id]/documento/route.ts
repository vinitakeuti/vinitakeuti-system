import { getQuoteDocumentUpdatedAt, saveQuoteDocument } from "@/features/quotes/services/quote-document-service";
import { QUOTE_DOCUMENT_MAX_JSON_LENGTH } from "@/features/quotes/types/document-content";

/** Data da última gravação do documento: o editor confere se a versão na tela é a mais recente. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const updatedAt = await getQuoteDocumentUpdatedAt(id.slice(0, 50));
  if (!updatedAt) return Response.json({ error: "Orçamento não encontrado." }, { status: 404 });
  return Response.json({ updatedAt: updatedAt.toISOString() }, { headers: { "Cache-Control": "no-store" } });
}

/** Salvamento automático do editor do PDF. */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.text();
  if (!body || body.length > QUOTE_DOCUMENT_MAX_JSON_LENGTH) return Response.json({ error: "Documento grande demais para salvar." }, { status: 413 });
  let document: unknown;
  try {
    document = JSON.parse(body);
  } catch {
    return Response.json({ error: "Documento inválido." }, { status: 400 });
  }
  const result = await saveQuoteDocument(id.slice(0, 50), document);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ updatedAt: result.updatedAt.toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
