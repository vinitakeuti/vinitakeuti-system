import { generateQuotePdf } from "@/features/quotes/services/quote-pdf";
import { getQuoteForPdf } from "@/features/quotes/queries/quote-queries";
import { parseQuoteDocumentContent, withQuoteServiceBlocks } from "@/features/quotes/types/document-content";
import { getProfessionalProfile } from "@/features/professional-profile/queries/professional-profile-queries";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const quote = await getQuoteForPdf(id);
  if (!quote) return new Response("Orçamento não encontrado.", { status: 404 });
  const savedProfile = await getProfessionalProfile();
  const professional = savedProfile ?? { name: "Vinicius Riudi", professionalTitle: null, email: null, phone: null, document: null, address: null, city: null, state: null, website: null };
  const items = quote.items.length ? quote.items.map((item) => ({ description: item.name, categoryName: item.categoryName, proposalText: item.proposalText, quantity: item.quantity, unitPriceCents: item.unitAmountCents })) : [{ description: quote.title, quantity: 1, unitPriceCents: quote.amountCents }];
  const documentContent = withQuoteServiceBlocks(parseQuoteDocumentContent(quote.documentContent, { title: quote.title, clientName: quote.client.name }), quote.items);
  const pdf = await generateQuotePdf({ code: quote.code, issuedAt: quote.createdAt, validUntil: quote.validUntil, title: quote.title, scope: quote.scope, documentContent, terms: quote.terms, discountCents: quote.discountCents, client: quote.client, items, professional });
  return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${quote.code}.pdf"` } });
}
