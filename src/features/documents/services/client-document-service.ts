import { prisma } from "@/lib/prisma";
import { parseQuoteDocumentContent, quoteDocumentImageIds } from "@/features/quotes/types/document-content";
import { deleteUnusedDocumentImages } from "@/features/quotes/services/quote-images";

export type SaveClientDocumentResult =
  | { ok: true; document: { id: string; clientId: string; code: string }; updatedAt: Date }
  | { ok: false; status: number; error: string };

/** Grava o conteúdo de um documento do cliente. Usado pelo SALVAR/CONCLUIR e pelo salvamento automático. */
export async function saveClientDocument(documentId: string, rawDocument: unknown, options: { complete?: boolean; cleanImages?: boolean } = {}): Promise<SaveClientDocumentResult> {
  const document = await prisma.clientDocument.findUnique({ where: { id: documentId }, select: { id: true, clientId: true, code: true, title: true, completedAt: true, client: { select: { name: true } } } });
  if (!document) return { ok: false, status: 404, error: "Documento não encontrado." };
  const documentContent = parseQuoteDocumentContent(rawDocument, { title: document.title, clientName: document.client.name });
  const updated = await prisma.clientDocument.update({ where: { id: document.id }, data: { documentContent, ...(options.complete && !document.completedAt ? { completedAt: new Date() } : {}) }, select: { updatedAt: true } });
  if (options.cleanImages) await deleteUnusedDocumentImages({ documentId: document.id }, quoteDocumentImageIds(documentContent));
  return { ok: true, document: { id: document.id, clientId: document.clientId, code: document.code }, updatedAt: updated.updatedAt };
}

export async function getClientDocumentUpdatedAt(documentId: string) {
  const document = await prisma.clientDocument.findUnique({ where: { id: documentId }, select: { updatedAt: true } });
  return document?.updatedAt ?? null;
}
