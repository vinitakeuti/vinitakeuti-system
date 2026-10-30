import type { ClientDocumentKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { defaultFreeCover, parseQuoteDocumentContent, quoteDocumentImageIds } from "@/features/quotes/types/document-content";
import { deleteUnusedDocumentImages } from "@/features/quotes/services/quote-images";

export type SaveClientDocumentResult =
  | { ok: true; document: { id: string; clientId: string | null; code: string; kind: ClientDocumentKind }; updatedAt: Date }
  | { ok: false; status: number; error: string };

/** Grava o conteúdo de um documento do cliente. Usado pelo SALVAR/CONCLUIR e pelo salvamento automático. */
export async function saveClientDocument(documentId: string, rawDocument: unknown, options: { complete?: boolean; cleanImages?: boolean } = {}): Promise<SaveClientDocumentResult> {
  const document = await prisma.clientDocument.findUnique({ where: { id: documentId }, select: { id: true, clientId: true, code: true, title: true, kind: true, completedAt: true, client: { select: { name: true } } } });
  if (!document) return { ok: false, status: 404, error: "Documento não encontrado." };
  const parsed = parseQuoteDocumentContent(rawDocument, { title: document.title, clientName: document.client?.name ?? "" });
  // Só o documento livre tem capa configurável; o título da capa passa a ser o título do documento.
  const { cover, ...withoutCover } = parsed;
  const documentContent = document.kind === "FREE" ? { ...withoutCover, cover: cover ?? defaultFreeCover(document.title) } : withoutCover;
  const title = document.kind === "FREE" && cover?.title ? cover.title : document.title;
  const updated = await prisma.clientDocument.update({ where: { id: document.id }, data: { documentContent, title, ...(options.complete && !document.completedAt ? { completedAt: new Date() } : {}) }, select: { updatedAt: true } });
  if (options.cleanImages) await deleteUnusedDocumentImages({ documentId: document.id }, quoteDocumentImageIds(documentContent));
  return { ok: true, document: { id: document.id, clientId: document.clientId, code: document.code, kind: document.kind }, updatedAt: updated.updatedAt };
}

export async function getClientDocumentUpdatedAt(documentId: string) {
  const document = await prisma.clientDocument.findUnique({ where: { id: documentId }, select: { updatedAt: true } });
  return document?.updatedAt ?? null;
}
