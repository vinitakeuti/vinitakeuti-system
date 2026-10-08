import Link from "next/link";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { getQuoteTextTemplate } from "@/features/quotes/queries/quote-text-template-queries";
import { saveQuoteTextTemplateAction } from "@/features/quotes/services/quote-text-template-actions";

export const dynamic = "force-dynamic";

export default async function QuoteTextTemplatePage({ searchParams }: { searchParams: Promise<{ updated?: string }> }) {
  const [{ updated }, template] = await Promise.all([searchParams, getQuoteTextTemplate()]);
  return <main className="app-shell"><AppSidebar current="quotes" /><div className="workspace"><section className="directory-page form-page quote-template-page">
    <header className="directory-header"><div><p className="eyebrow">ORÇAMENTOS / DOCUMENTO</p><h1>Texto padrão.</h1><p>Escreva o conteúdo que deverá iniciar cada nova proposta. Depois, cada orçamento continua editável de forma independente.</p></div><div className="header-actions"><SidebarToggle location="header" /><Link className="text-link" href="/orcamentos">VOLTAR PARA ORÇAMENTOS</Link></div></header>
    <form className="client-form quote-template-form" action={saveQuoteTextTemplateAction}>{updated ? <p className="form-success">Texto padrão salvo.</p> : null}<section><p className="eyebrow">MODELO DA PROPOSTA</p><label className="quote-template-content">Texto que será inserido nas novas propostas<textarea name="content" defaultValue={template?.content ?? ""} maxLength={120_000} placeholder="Apresente sua forma de trabalho, condições, etapas ou qualquer conteúdo que normalmente acompanha uma proposta." /><small>Use parágrafos para separar blocos de conteúdo. O texto entra antes dos serviços orçados e pode ser ajustado depois no editor de cada proposta.</small></label></section><div className="form-actions"><Link className="text-link" href="/orcamentos">CANCELAR</Link><button className="primary-action" type="submit">SALVAR TEXTO PADRÃO</button></div></form>
  </section></div></main>;
}
