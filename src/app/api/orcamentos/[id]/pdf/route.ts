import { generateQuotePdf } from "@/features/quotes/services/quote-pdf";
import { getQuoteForPdf } from "@/features/quotes/queries/quote-queries";
import { parseQuoteDocumentContent, quoteDocumentImageIds, withQuoteServiceBlocks } from "@/features/quotes/types/document-content";
import { getQuoteImagesForPdf } from "@/features/quotes/services/quote-images";
import { getProfessionalProfileForDocuments } from "@/features/professional-profile/queries/professional-profile-queries";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const quote = await getQuoteForPdf(id);
  if (!quote) return new Response("Orçamento não encontrado.", { status: 404 });
  const professional = await getProfessionalProfileForDocuments();
  const items = quote.items.length ? quote.items.map((item) => ({ description: item.name, categoryName: item.categoryName, proposalText: item.proposalText, quantity: item.quantity, unitPriceCents: item.unitAmountCents })) : [{ description: quote.title, quantity: 1, unitPriceCents: quote.amountCents }];
  const documentContent = withQuoteServiceBlocks(parseQuoteDocumentContent(quote.documentContent, { title: quote.title, clientName: quote.client.name }), quote.items);
  const images = await getQuoteImagesForPdf(quote.id, quoteDocumentImageIds(documentContent));
  const pdf = await generateQuotePdf({ code: quote.code, issuedAt: quote.createdAt, validUntil: quote.validUntil, title: quote.title, scope: quote.scope, documentContent, images, terms: quote.terms, discountCents: quote.discountCents, discountPercentBps: quote.discountPercentBps, client: quote.client, items, payments: quote.payments, paymentNotes: quote.paymentNotes, completedAt: quote.completedAt, professional });
  return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${quote.code}.pdf"` } });
}
