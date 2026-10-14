import Link from "next/link";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { getQuoteTextTemplate, getQuoteTextTemplateReturn } from "@/features/quotes/queries/quote-text-template-queries";
import { saveQuoteTextTemplateAction } from "@/features/quotes/services/quote-text-template-actions";

export const dynamic = "force-dynamic";

export default async function QuoteTextTemplatePage({ searchParams }: { searchParams: Promise<{ updated?: string; orcamento?: string }> }) {
  const [{ updated, orcamento }, template] = await Promise.all([searchParams, getQuoteTextTemplate()]);
  const returnQuote = await getQuoteTextTemplateReturn(orcamento);
  const backHref = returnQuote ? `/orcamentos/${returnQuote.id}/editor` : "/orcamentos";
  const backLabel = returnQuote ? "VOLTAR PARA O PDF" : "VOLTAR PARA ORÇAMENTOS";
  return <main className="app-shell"><AppSidebar current="quotes" /><div className="workspace"><section className="directory-page form-page quote-template-page">
    <header className="directory-header"><div><p className="eyebrow">ORÇAMENTOS / DOCUMENTO</p><h1>Texto padrão.</h1><p>Guarde aqui um texto que você usa com frequência. Ele não entra sozinho no PDF: no editor da proposta, use INSERIR TEXTO PADRÃO quando quiser incluí-lo.</p></div><div className="header-actions"><SidebarToggle location="header" /><Link className="text-link" href={backHref}>{backLabel}</Link></div></header>
    <form className="client-form quote-template-form" action={saveQuoteTextTemplateAction}>{returnQuote ? <input type="hidden" name="returnQuoteId" value={returnQuote.id} /> : null}{updated ? <p className="form-success">Texto padrão salvo.{returnQuote ? " Volte ao PDF e use INSERIR TEXTO PADRÃO para incluí-lo." : ""}</p> : null}<section><p className="eyebrow">MODELO DA PROPOSTA</p><label className="quote-template-content">Texto disponível para inserir nas propostas<textarea name="content" defaultValue={template?.content ?? ""} maxLength={120_000} placeholder="Apresente sua forma de trabalho, condições, etapas ou qualquer conteúdo que normalmente acompanha uma proposta." /><small>Use parágrafos para separar blocos de conteúdo. Ao ser inserido, o texto entra na apresentação, antes dos serviços, e pode ser ajustado no editor de cada proposta.</small></label></section><div className="form-actions"><Link className="text-link" href={backHref}>{returnQuote ? `VOLTAR PARA O PDF ${returnQuote.code}` : "CANCELAR"}</Link><button className="primary-action" type="submit">SALVAR TEXTO PADRÃO</button></div></form>
  </section></div></main>;
}
