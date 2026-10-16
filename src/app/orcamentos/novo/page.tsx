import Link from "next/link";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { ClientQuotePicker } from "@/features/quotes/components/client-quote-picker";
import { QuotePaymentsFields } from "@/features/quotes/components/quote-payments-fields";
import { QuoteServicePicker } from "@/features/quotes/components/quote-service-picker";
import { findClientsForQuote, getClientForQuote } from "@/features/quotes/queries/quote-queries";
import { createQuoteAction } from "@/features/quotes/services/quote-actions";

export const dynamic = "force-dynamic";

function QuoteCreationSteps({ clientSelected }: { clientSelected: boolean }) {
  return <ol className="quote-creation-steps" aria-label="Etapas do orçamento">
    <li className={clientSelected ? "is-complete" : "is-current"}><span>01</span><div><b>Cliente</b><small>{clientSelected ? "Selecionado" : "Selecionar"}</small></div></li>
    <li className={clientSelected ? "is-current" : ""}><span>02</span><div><b>Proposta</b><small>Título</small></div></li>
    <li><span>03</span><div><b>Serviços</b><small>Valores e desconto</small></div></li>
    <li><span>04</span><div><b>Pagamentos</b><small>Opcional</small></div></li>
    <li><span>05</span><div><b>Condições</b><small>Validade e termos</small></div></li>
  </ol>;
}

function StepHeading({ step, eyebrow, title, description }: { step: string; eyebrow: string; title: string; description: string }) {
  return <div className="quote-form-step-heading"><span>{step}</span><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2><p>{description}</p></div></div>;
}

export default async function NewQuotePage({ searchParams }: { searchParams: Promise<{ clientId?: string; clientQuery?: string; error?: string }> }) {
  const { clientId, clientQuery, error } = await searchParams;
  const [clients, selected] = await Promise.all([findClientsForQuote(clientQuery), clientId ? getClientForQuote(clientId) : null]);

  return <main className="app-shell"><AppSidebar current="quotes" /><div className="workspace"><section className="directory-page form-page quote-creation-page">
    <header className="directory-header"><div><p className="eyebrow">DOCUMENTOS / PROPOSTA COMERCIAL</p><h1>Nova proposta.</h1><p>Defina cliente, título, serviços e valores. A apresentação da proposta será personalizada no editor de PDF.</p></div><div className="header-actions"><SidebarToggle location="header" /><Link className="text-link" href="/documentos">VOLTAR PARA DOCUMENTOS</Link></div></header>
    <QuoteCreationSteps clientSelected={Boolean(selected)} />
    {!selected ? <section className="client-form quote-client-picker"><StepHeading step="01" eyebrow="PRIMEIRO PASSO" title="Escolha o cliente." description="Todo orçamento precisa ficar vinculado a um perfil cadastrado." /><ClientQuotePicker clients={clients} query={clientQuery} /></section> : <form className="client-form quote-form" action={createQuoteAction}>
      <input type="hidden" name="clientId" value={selected.id} />
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <section className="quote-client-selected quote-form-stage-client"><span>CLIENTE SELECIONADO</span><b>{selected.name}</b><small>{selected.company ?? selected.email ?? "Perfil de cliente"}</small><Link className="text-link" href={`/orcamentos/novo?clientQuery=${encodeURIComponent(clientQuery ?? "")}`}>ALTERAR CLIENTE</Link></section>
      <section className="quote-form-section quote-form-stage-proposal"><StepHeading step="02" eyebrow="PROPOSTA" title="Dê um título à proposta." description="É o primeiro elemento do documento e o nome que o cliente vai reconhecer no PDF." /><div className="form-grid"><label className="form-wide">Título da proposta <em>OBRIGATÓRIO</em><input name="title" required maxLength={180} autoFocus placeholder="Ex.: Plataforma de gestão comercial" /><small>Use um nome direto, que descreva a entrega.</small></label></div></section>
      <section className="quote-form-section quote-form-stage-services"><StepHeading step="03" eyebrow="SERVIÇOS E VALORES" title="Adicione os serviços." description="Busque no catálogo ou filtre por categoria. Os serviços ficam agrupados por categoria e cada linha usa sua própria regra: valor fechado, por hora, por dia ou definido nesta proposta." /><QuoteServicePicker /></section>
      <section className="quote-form-section quote-form-stage-payments"><StepHeading step="04" eyebrow="PAGAMENTOS" title="Pagamentos já recebidos." description="Opcional. Registre sinais ou parcelas que o cliente já pagou. O saldo a receber aparece na folha final do PDF." /><QuotePaymentsFields /></section>
      <section className="quote-form-section quote-form-stage-conditions"><StepHeading step="05" eyebrow="VALIDADE E CONDIÇÕES" title="Defina as condições." description="Validade da proposta e condições comerciais que acompanham o PDF." /><div className="form-grid"><label>Válido até<input name="validUntil" type="date" /><small>Opcional. Define até quando a proposta pode ser aceita.</small></label><label className="form-wide">Condições comerciais<textarea name="terms" maxLength={4000} placeholder="Ex.: Pagamento em duas etapas, prazo de suporte e itens não inclusos." /><small>Opcional. Registre forma de pagamento, inclusões ou limites da proposta.</small></label></div></section>
      <div className="form-actions quote-form-actions"><Link className="text-link" href="/documentos">CANCELAR</Link><button className="primary-action" type="submit">SALVAR E EDITAR PDF</button></div>
    </form>}
  </section></div></main>;
}
