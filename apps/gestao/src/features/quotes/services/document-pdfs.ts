import { generateQuotePdf } from "@/features/quotes/services/quote-pdf";
import { getQuoteForPdf } from "@/features/quotes/queries/quote-queries";
import { getClientDocumentForEditor } from "@/features/documents/queries/document-queries";
import { documentKindFromEnum } from "@/features/documents/types/document-kinds";
import { defaultFreeCover, parseQuoteDocumentContent, quoteDocumentImageIds, withQuoteServiceBlocks } from "@/features/quotes/types/document-content";
import { getDocumentImagesForPdf, getQuoteImagesForPdf } from "@/features/quotes/services/quote-images";
import { getProfessionalProfileForDocuments } from "@/features/professional-profile/queries/professional-profile-queries";

/**
 * PDFs da proposta comercial e dos demais documentos do cliente. Usados pela gestão e pelo portal do cliente; quem
 * chama confere o acesso (o portal compara `clientId` com o cliente da sessão e só entrega documentos concluídos).
 */
export type DocumentPdf = { pdf: Uint8Array; filename: string; clientId: string | null; completedAt: Date | null };

export async function buildQuotePdf(id: string): Promise<DocumentPdf | null> {
  const quote = await getQuoteForPdf(id);
  if (!quote) return null;
  const professional = await getProfessionalProfileForDocuments();
  const items = quote.items.length ? quote.items.map((item) => ({ description: item.name, categoryName: item.categoryName, proposalText: item.proposalText, quantity: item.quantity, unitPriceCents: item.unitAmountCents })) : [{ description: quote.title, quantity: 1, unitPriceCents: quote.amountCents }];
  // Documentos antigos, nunca salvos no editor, mantêm a seção de serviços automática.
  const parsed = parseQuoteDocumentContent(quote.documentContent, { title: quote.title, clientName: quote.client.name });
  const documentContent = quote.documentContent == null ? withQuoteServiceBlocks(parsed, quote.items) : parsed;
  const images = await getQuoteImagesForPdf(quote.id, quoteDocumentImageIds(documentContent));
  const pdf = await generateQuotePdf({ code: quote.code, issuedAt: quote.createdAt, validUntil: quote.validUntil, title: quote.title, scope: quote.scope, documentContent, images, terms: quote.terms, discountCents: quote.discountCents, discountPercentBps: quote.discountPercentBps, client: quote.client, items, payments: quote.payments, paymentNotes: quote.paymentNotes, completedAt: quote.completedAt, professional });
  return { pdf: new Uint8Array(pdf), filename: `${quote.code}.pdf`, clientId: quote.clientId, completedAt: quote.completedAt };
}

/** Contrato, cessão ou memorial técnico (capa do tipo, páginas e assinaturas) ou documento livre (capa opcional e páginas). */
export async function buildClientDocumentPdf(id: string): Promise<DocumentPdf | null> {
  const document = await getClientDocumentForEditor(id);
  if (!document) return null;
  const info = documentKindFromEnum(document.kind);
  const professional = await getProfessionalProfileForDocuments();
  const documentContent = parseQuoteDocumentContent(document.documentContent, { title: document.title, clientName: document.client?.name ?? "" });
  const images = await getDocumentImagesForPdf({ documentId: document.id }, quoteDocumentImageIds(documentContent));
  const cover = info.kind === "free" ? documentContent.cover ?? defaultFreeCover(document.title) : null;
  const pdf = await generateQuotePdf({ kind: info.kind, code: document.code, issuedAt: document.createdAt, title: document.title, scope: "", documentContent, images, client: document.client, cover, items: [], completedAt: document.completedAt, professional });
  return { pdf: new Uint8Array(pdf), filename: `${document.code}.pdf`, clientId: document.client?.id ?? null, completedAt: document.completedAt };
}

export function pdfResponse({ pdf, filename }: DocumentPdf) {
  return new Response(pdf, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "private, no-store" } });
}
