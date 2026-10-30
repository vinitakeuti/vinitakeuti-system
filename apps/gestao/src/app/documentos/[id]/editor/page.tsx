import Link from "next/link";
import { notFound } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { QuoteDocumentEditor } from "@/features/quotes/components/quote-document-editor";
import { getClientDocumentForEditor } from "@/features/documents/queries/document-queries";
import { updateClientDocumentAction } from "@/features/documents/services/document-actions";
import { documentKindFromEnum } from "@/features/documents/types/document-kinds";
import { defaultFreeCover, parseQuoteDocumentContent, QUOTE_TEXT_MAX_CHARACTERS, withQuoteIntroBlock } from "@/features/quotes/types/document-content";
import { getProfessionalProfileForDocuments } from "@/features/professional-profile/queries/professional-profile-queries";
import { getDocumentTextTemplate } from "@/features/quotes/queries/quote-text-template-queries";
import { richTextForStorage } from "@/lib/rich-text";

export const dynamic = "force-dynamic";

/**
 * Editor do contrato, da cessão, do memorial técnico ou do documento livre: o mesmo editor de PDF da proposta, com a
 * capa e a folha final do tipo. O documento livre tem capa opcional, nenhuma folha final e cliente opcional.
 */
export default async function ClientDocumentEditorPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ salvo?: string }> }) {
  const [{ id }, { salvo }] = await Promise.all([params, searchParams]);
  const document = await getClientDocumentForEditor(id);
  if (!document) notFound();
  const info = documentKindFromEnum(document.kind);
  const [professional, template] = await Promise.all([getProfessionalProfileForDocuments(), getDocumentTextTemplate(info.templateId)]);
  const isFree = info.kind === "free";
  const parsed = withQuoteIntroBlock(parseQuoteDocumentContent(document.documentContent, { title: document.title, clientName: document.client?.name ?? "" }));
  const content = isFree ? { ...parsed, cover: parsed.cover ?? defaultFreeCover(document.title) } : parsed;
  const client = { name: document.client?.name ?? "", company: document.client?.company ?? null, document: document.client?.document ?? null };
  const cover = { code: document.code, title: document.title, issuedAt: document.createdAt.toISOString(), validUntil: null, client };
  const closing = isFree ? { type: "none" as const } : { type: "signatures" as const, document: { id: document.id, code: document.code, title: document.title, client, signatureDate: (document.completedAt ?? new Date()).toISOString() } };
  const backHref = document.client ? `/clientes/${document.client.id}?section=documents` : `/documentos?tipo=${info.slug}`;
  return <main className="app-shell"><AppSidebar current="quotes" /><div className="workspace"><section className="directory-page quote-editor-page"><nav className="quote-editor-navigation" aria-label="Navegação do editor"><SidebarToggle location="header" /><Link className="text-link" href={backHref}>{document.client ? "VOLTAR PARA O CLIENTE" : "VOLTAR PARA DOCUMENTOS"}</Link></nav>
    <QuoteDocumentEditor key={document.updatedAt.toISOString()} savedAt={document.updatedAt.toISOString()} kind={info.kind} documentId={document.id} documentCode={document.code} documentTitle={document.title} apiBase={`/api/documentos/${document.id}`} saveAction={updateClientDocumentAction} idFieldName="documentId" backHref="/documentos" initialContent={content} professional={professional} isCompleted={Boolean(document.completedAt)} justSaved={salvo === "1"} cover={cover} hasClient={Boolean(document.client)} closing={closing} templateText={richTextForStorage(template?.content ?? null, QUOTE_TEXT_MAX_CHARACTERS)} services={document.quote?.items ?? []} />
  </section></div></main>;
}
