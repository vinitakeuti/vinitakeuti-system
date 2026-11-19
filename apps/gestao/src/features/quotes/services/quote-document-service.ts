import { prisma } from "@/lib/prisma";
import { parseQuoteDocumentContent, quoteDocumentImageIds } from "@/features/quotes/types/document-content";
import { deleteUnusedQuoteImages } from "@/features/quotes/services/quote-images";
import { notifyDocumentAvailable, notifySafely } from "@/features/notifications/services/client-emails";

export type SaveQuoteDocumentResult =
  | { ok: true; quote: { id: string; clientId: string }; updatedAt: Date }
  | { ok: false; status: number; error: string };

/**
 * Grava o documento do orçamento e a página final (forma de mostrar o valor e condições de pagamento). Usado pelo
 * botão SALVAR/CONCLUIR e pelo salvamento automático do editor. Concluir só marca a data na primeira vez.
 */
export async function saveQuoteDocument(quoteId: string, rawDocument: unknown, options: { complete?: boolean; cleanImages?: boolean } = {}): Promise<SaveQuoteDocumentResult> {
  const quote = await prisma.quote.findUnique({ where: { id: quoteId }, select: { id: true, clientId: true, completedAt: true, title: true, client: { select: { name: true } } } });
  if (!quote) return { ok: false, status: 404, error: "Orçamento não encontrado." };
  const parsed = parseQuoteDocumentContent(rawDocument, { title: quote.title, clientName: quote.client.name });
  // As condições de pagamento, escritas na página final do editor, ficam na coluna do orçamento. Um editor aberto
  // antes desta mudança não manda a página final e não apaga as condições.
  const { closing, ...withoutClosing } = parsed;
  const documentContent = closing ? { ...withoutClosing, closing: { value: closing.value, installments: closing.installments, downPaymentPercent: closing.downPaymentPercent } } : withoutClosing;
  const terms = closing?.terms === undefined ? {} : { terms: closing.terms || null };
  const completing = Boolean(options.complete && !quote.completedAt);
  const updated = await prisma.quote.update({ where: { id: quote.id }, data: { documentContent, ...terms, ...(completing ? { completedAt: new Date() } : {}) }, select: { updatedAt: true } });
  if (options.cleanImages) await deleteUnusedQuoteImages(quote.id, quoteDocumentImageIds(documentContent));
  if (completing) await notifySafely(() => notifyDocumentAvailable({ quoteId: quote.id }));
  return { ok: true, quote: { id: quote.id, clientId: quote.clientId }, updatedAt: updated.updatedAt };
}

export async function getQuoteDocumentUpdatedAt(quoteId: string) {
  const quote = await prisma.quote.findUnique({ where: { id: quoteId }, select: { updatedAt: true } });
  return quote?.updatedAt ?? null;
}
