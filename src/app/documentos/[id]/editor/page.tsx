import Link from "next/link";
import { notFound } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { QuoteDocumentEditor } from "@/features/quotes/components/quote-document-editor";
import { getClientDocumentForEditor } from "@/features/documents/queries/document-queries";
import { updateClientDocumentAction } from "@/features/documents/services/document-actions";
import { documentKindFromEnum } from "@/features/documents/types/document-kinds";
import { parseQuoteDocumentContent, QUOTE_TEXT_MAX_CHARACTERS, withQuoteIntroBlock } from "@/features/quotes/types/document-content";
import { getProfessionalProfileForDocuments } from "@/features/professional-profile/queries/professional-profile-queries";
import { getDocumentTextTemplate } from "@/features/quotes/queries/quote-text-template-queries";
import { richTextForStorage } from "@/lib/rich-text";

export const dynamic = "force-dynamic";

/** Editor do contrato, da cessão ou do memorial técnico: o mesmo editor de PDF da proposta, com capa e folha final do tipo. */
export default async function ClientDocumentEditorPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ salvo?: string }> }) {
  const [{ id }, { salvo }] = await Promise.all([params, searchParams]);
  const document = await getClientDocumentForEditor(id);
  if (!document) notFound();
  const info = documentKindFromEnum(document.kind);
  const [professional, template] = await Promise.all([getProfessionalProfileForDocuments(), getDocumentTextTemplate(info.templateId)]);
  const content = withQuoteIntroBlock(parseQuoteDocumentContent(document.documentContent, { title: document.title, clientName: document.client.name }));
  const client = { name: document.client.name, company: document.client.company, document: document.client.document };
  const cover = { code: document.code, title: document.title, issuedAt: document.createdAt.toISOString(), validUntil: null, client };
  const signatureData = { id: document.id, code: document.code, title: document.title, client, signatureDate: (document.completedAt ?? new Date()).toISOString() };
  return <main className="app-shell"><AppSidebar current="quotes" /><div className="workspace"><section className="directory-page quote-editor-page"><nav className="quote-editor-navigation" aria-label="Navegação do editor"><SidebarToggle location="header" /><Link className="text-link" href={`/clientes/${document.client.id}?section=documents`}>VOLTAR PARA O CLIENTE</Link></nav>
    <QuoteDocumentEditor key={document.updatedAt.toISOString()} savedAt={document.updatedAt.toISOString()} kind={info.kind} documentId={document.id} documentCode={document.code} documentTitle={document.title} apiBase={`/api/documentos/${document.id}`} saveAction={updateClientDocumentAction} idFieldName="documentId" backHref="/documentos" initialContent={content} professional={professional} isCompleted={Boolean(document.completedAt)} justSaved={salvo === "1"} cover={cover} closing={{ type: "signatures", document: signatureData }} templateText={richTextForStorage(template?.content ?? null, QUOTE_TEXT_MAX_CHARACTERS)} services={document.quote?.items ?? []} />
  </section></div></main>;
}
