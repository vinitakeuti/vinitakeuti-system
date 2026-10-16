import { prisma } from "@/lib/prisma";
import { parseQuoteDocumentContent, quoteDocumentImageIds } from "@/features/quotes/types/document-content";
import { deleteUnusedQuoteImages } from "@/features/quotes/services/quote-images";

export type SaveQuoteDocumentResult =
  | { ok: true; quote: { id: string; clientId: string }; updatedAt: Date }
  | { ok: false; status: number; error: string };

/**
 * Grava o documento do orçamento. Usado pelo botão SALVAR/CONCLUIR e pelo salvamento automático do editor.
 * Concluir só marca a data na primeira vez.
 */
export async function saveQuoteDocument(quoteId: string, rawDocument: unknown, options: { complete?: boolean; cleanImages?: boolean } = {}): Promise<SaveQuoteDocumentResult> {
  const quote = await prisma.quote.findUnique({ where: { id: quoteId }, select: { id: true, clientId: true, completedAt: true, title: true, client: { select: { name: true } } } });
  if (!quote) return { ok: false, status: 404, error: "Orçamento não encontrado." };
  const documentContent = parseQuoteDocumentContent(rawDocument, { title: quote.title, clientName: quote.client.name });
  const updated = await prisma.quote.update({ where: { id: quote.id }, data: { documentContent, ...(options.complete && !quote.completedAt ? { completedAt: new Date() } : {}) }, select: { updatedAt: true } });
  if (options.cleanImages) await deleteUnusedQuoteImages(quote.id, quoteDocumentImageIds(documentContent));
  return { ok: true, quote: { id: quote.id, clientId: quote.clientId }, updatedAt: updated.updatedAt };
}

export async function getQuoteDocumentUpdatedAt(quoteId: string) {
  const quote = await prisma.quote.findUnique({ where: { id: quoteId }, select: { updatedAt: true } });
  return quote?.updatedAt ?? null;
}
