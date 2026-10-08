import Link from "next/link";
import { notFound } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { QuoteDocumentEditor } from "@/features/quotes/components/quote-document-editor";
import { getQuoteForDocumentEditor } from "@/features/quotes/queries/quote-queries";
import { parseQuoteDocumentContent, withQuoteServiceBlocks } from "@/features/quotes/types/document-content";
import { getProfessionalProfile } from "@/features/professional-profile/queries/professional-profile-queries";

export const dynamic = "force-dynamic";

export default async function QuoteDocumentEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [quote, savedProfile] = await Promise.all([getQuoteForDocumentEditor(id), getProfessionalProfile()]);
  if (!quote) notFound();
  const content = withQuoteServiceBlocks(parseQuoteDocumentContent(quote.documentContent, { title: quote.title, clientName: quote.client.name }), quote.items);
  const professional = savedProfile ?? { name: "Vinicius Riudi", professionalTitle: null, email: null, phone: null, document: null, address: null, city: null, state: null, website: null };
  return <main className="app-shell"><AppSidebar current="quotes" /><div className="workspace"><section className="directory-page quote-editor-page"><nav className="quote-editor-navigation" aria-label="Navegação do editor"><SidebarToggle location="header" /><Link className="text-link" href={`/orcamentos/${quote.id}`}>VOLTAR PARA ORÇAMENTO</Link></nav><QuoteDocumentEditor quoteId={quote.id} quoteCode={quote.code} quoteTitle={quote.title} backHref={`/orcamentos/${quote.id}`} initialContent={content} professional={professional} /></section></div></main>;
}
