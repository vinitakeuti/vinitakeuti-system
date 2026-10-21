import Link from "next/link";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { getDocumentTextTemplate, getQuoteTextTemplateReturn } from "@/features/quotes/queries/quote-text-template-queries";
import { saveQuoteTextTemplateAction } from "@/features/quotes/services/quote-text-template-actions";
import { getClientDocumentReturn } from "@/features/documents/queries/document-queries";
import { DOCUMENT_KINDS, documentKindFromEnum, documentKindFromSlug } from "@/features/documents/types/document-kinds";

export const dynamic = "force-dynamic";

const placeholders: Record<string, string> = {
  proposal: "Apresente sua forma de trabalho, condições, etapas ou qualquer conteúdo que normalmente acompanha uma proposta.",
  contract: "Cláusulas do contrato: objeto, obrigações das partes, prazos, valores e forma de pagamento, rescisão, foro.",
  assignment: "Termos da cessão: objeto cedido, direitos patrimoniais transferidos, código-fonte, contrapartida e garantias.",
  memorial: "Estrutura da documentação: visão geral, escopo entregue, funcionalidades, arquitetura, tecnologias e critérios de aceite.",
};

/** Texto padrão de cada tipo de documento. Ele só entra no PDF pelo componente Texto padrão do editor. */
export default async function DocumentTextTemplatePage({ searchParams }: { searchParams: Promise<{ tipo?: string; updated?: string; orcamento?: string; documento?: string }> }) {
  const { tipo, updated, orcamento, documento } = await searchParams;
  const [returnQuote, returnDocument] = await Promise.all([getQuoteTextTemplateReturn(orcamento), getClientDocumentReturn(documento)]);
  const info = documentKindFromSlug(tipo) ?? (returnDocument ? documentKindFromEnum(returnDocument.kind) : documentKindFromSlug("proposta")!);
  const template = await getDocumentTextTemplate(info.templateId);
  const returnHref = returnQuote ? `/orcamentos/${returnQuote.id}/editor` : returnDocument ? `/documentos/${returnDocument.id}/editor` : null;
  const returnCode = returnQuote?.code ?? returnDocument?.code;
  const backHref = returnHref ?? "/documentos";
  const keepReturn = (slug: string) => `/documentos/texto-padrao?${new URLSearchParams({ tipo: slug, ...(returnQuote ? { orcamento: returnQuote.id } : {}), ...(returnDocument ? { documento: returnDocument.id } : {}) })}`;
  return <main className="app-shell"><AppSidebar current="quotes" /><div className="workspace"><section className="directory-page form-page quote-template-page">
    <header className="directory-header"><div><p className="eyebrow">DOCUMENTOS / TEXTO PADRÃO</p><h1>Texto padrão.</h1><p>Guarde o texto que você usa em cada tipo de documento. Ele não entra sozinho no PDF: no editor, use COMPONENTES e escolha Texto padrão quando quiser incluí-lo.</p></div><div className="header-actions"><SidebarToggle location="header" /><Link className="text-link" href={backHref}>{returnHref ? "VOLTAR PARA O PDF" : "VOLTAR PARA DOCUMENTOS"}</Link></div></header>
    <nav className="profile-nav quote-tabs" aria-label="Tipo de documento">{DOCUMENT_KINDS.map((item) => <Link key={item.kind} className={item.kind === info.kind ? "active" : undefined} aria-current={item.kind === info.kind ? "page" : undefined} href={keepReturn(item.slug)}><span>{item.shortName}</span></Link>)}</nav>
    <form className="client-form quote-template-form" action={saveQuoteTextTemplateAction} key={info.kind}>
      <input type="hidden" name="tipo" value={info.slug} />
      {returnQuote ? <input type="hidden" name="returnQuoteId" value={returnQuote.id} /> : null}
      {returnDocument ? <input type="hidden" name="returnDocumentId" value={returnDocument.id} /> : null}
      {updated ? <p className="form-success">Texto padrão de {info.shortName.toLowerCase()} salvo.{returnHref ? " Volte ao PDF e use COMPONENTES > Texto padrão para incluí-lo." : ""}</p> : null}
      <section><p className="eyebrow">MODELO · {info.name.toUpperCase()}</p><label className="quote-template-content">Texto disponível para inserir em {info.kind === "proposal" ? "propostas" : info.kind === "memorial" ? "memoriais técnicos" : info.kind === "contract" ? "contratos" : "cessões"}<textarea name="content" defaultValue={template?.content ?? ""} maxLength={120_000} placeholder={placeholders[info.kind]} /><small>Use parágrafos para separar blocos de conteúdo. Ao ser inserido, o texto entra no ponto do cursor e pode ser ajustado no editor de cada documento.</small></label></section>
      <div className="form-actions"><Link className="text-link" href={backHref}>{returnCode ? `VOLTAR PARA O PDF ${returnCode}` : "CANCELAR"}</Link><button className="primary-action" type="submit">SALVAR TEXTO PADRÃO</button></div>
    </form>
  </section></div></main>;
}
