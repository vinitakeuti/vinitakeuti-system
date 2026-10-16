import Link from "next/link";
import { notFound } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { QuoteDocumentEditor } from "@/features/quotes/components/quote-document-editor";
import { getQuoteForPdf } from "@/features/quotes/queries/quote-queries";
import type { QuotePreviewData } from "@/features/quotes/components/quote-document-previews";
import { parseQuoteDocumentContent, QUOTE_TEXT_MAX_CHARACTERS, withQuoteIntroBlock, withQuoteServiceBlocks } from "@/features/quotes/types/document-content";
import { getProfessionalProfileForDocuments } from "@/features/professional-profile/queries/professional-profile-queries";
import { getQuoteTextTemplate } from "@/features/quotes/queries/quote-text-template-queries";
import { richTextForStorage } from "@/lib/rich-text";
import { updateQuoteDocumentAction } from "@/features/quotes/services/quote-actions";

export const dynamic = "force-dynamic";

export default async function QuoteDocumentEditorPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ salvo?: string }> }) {
  const [{ id }, { salvo }] = await Promise.all([params, searchParams]);
  const [quote, professional, template] = await Promise.all([getQuoteForPdf(id), getProfessionalProfileForDocuments(), getQuoteTextTemplate()]);
  if (!quote) notFound();
  // Serviços incluídos é um componente inserido pelo editor. Só documentos antigos, nunca salvos, recebem a seção automaticamente.
  const parsed = parseQuoteDocumentContent(quote.documentContent, { title: quote.title, clientName: quote.client.name });
  const content = withQuoteIntroBlock(quote.documentContent == null ? withQuoteServiceBlocks(parsed, quote.items) : parsed);
  const preview: QuotePreviewData = {
    id: quote.id,
    code: quote.code,
    title: quote.title,
    issuedAt: quote.createdAt.toISOString(),
    validUntil: quote.validUntil?.toISOString() ?? null,
    client: { name: quote.client.name, company: quote.client.company, document: quote.client.document },
    items: quote.items.length ? quote.items.map((item) => ({ id: item.id, name: item.name, categoryName: item.categoryName, quantity: item.quantity, totalAmountCents: item.totalAmountCents })) : [{ id: "single", name: quote.title, categoryName: null, quantity: 1, totalAmountCents: quote.amountCents }],
    discountCents: quote.discountCents,
    discountPercentBps: quote.discountPercentBps,
    payments: quote.payments.map((payment) => ({ id: payment.id, amountCents: payment.amountCents, paidAt: payment.paidAt.toISOString() })),
    paymentNotes: quote.paymentNotes,
    terms: quote.terms,
    // Data do aceite: a da conclusão do orçamento; enquanto pendente, a data de hoje.
    signatureDate: (quote.completedAt ?? new Date()).toISOString(),
  };
  return <main className="app-shell"><AppSidebar current="quotes" /><div className="workspace"><section className="directory-page quote-editor-page"><nav className="quote-editor-navigation" aria-label="Navegação do editor"><SidebarToggle location="header" /><Link className="text-link" href={`/orcamentos/${quote.id}`}>VOLTAR PARA ORÇAMENTO</Link></nav><QuoteDocumentEditor key={quote.updatedAt.toISOString()} savedAt={quote.updatedAt.toISOString()} kind="proposal" documentId={quote.id} documentCode={quote.code} documentTitle={quote.title} apiBase={`/api/orcamentos/${quote.id}`} saveAction={updateQuoteDocumentAction} idFieldName="quoteId" backHref={`/orcamentos/${quote.id}`} initialContent={content} professional={professional} isCompleted={Boolean(quote.completedAt)} justSaved={salvo === "1"} cover={preview} closing={{ type: "investment", quote: preview }} templateText={richTextForStorage(template?.content ?? null, QUOTE_TEXT_MAX_CHARACTERS)} services={quote.items.map((item) => ({ id: item.id, name: item.name, categoryName: item.categoryName, proposalText: item.proposalText }))} /></section></div></main>;
}
