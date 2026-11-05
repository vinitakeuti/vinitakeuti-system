import Link from "next/link";
import { notFound } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { DeleteQuoteButton } from "@/features/quotes/components/delete-quote-button";
import { QuotePaymentsFields } from "@/features/quotes/components/quote-payments-fields";
import { QuoteServicePicker } from "@/features/quotes/components/quote-service-picker";
import { getQuoteForEdit } from "@/features/quotes/queries/quote-queries";
import { deleteQuoteAction, updateQuoteAction } from "@/features/quotes/services/quote-actions";

export const dynamic = "force-dynamic";

export default async function EditQuotePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  const [{ error }, quote] = await Promise.all([searchParams, getQuoteForEdit(id)]);
  if (!quote) notFound();
  const returnHref = `/orcamentos/${quote.id}`;
  const initialServices = quote.items.filter((item): item is typeof item & { serviceCatalogItemId: string } => Boolean(item.serviceCatalogItemId)).map((item) => ({ id: item.serviceCatalogItemId, name: item.name, category: { name: item.categoryName }, billingType: item.billingType, pricingMethod: item.pricingMethod, quantity: item.quantity, pricingRateCents: item.pricingRateCents ?? item.unitAmountCents, billingCycle: item.billingCycle }));
  const initialPayments = quote.payments.map((payment) => ({ amountCents: payment.amountCents, paidAt: payment.paidAt.toISOString().slice(0, 10) }));

  return <main className="app-shell"><AppSidebar current="quotes" /><div className="workspace"><section className="directory-page form-page">
    <header className="directory-header"><div><p className="eyebrow">Orçamento / Edição</p><h1>Editar orçamento.</h1><p>{quote.code} · {quote.client.name}</p></div><div className="header-actions"><SidebarToggle location="header" /><Link className="text-link" href={returnHref}>Voltar para orçamento</Link></div></header>
    <form className="client-form quote-form" action={updateQuoteAction}>
      <input type="hidden" name="quoteId" value={quote.id} /><input type="hidden" name="clientId" value={quote.clientId} />
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <section className="quote-client-selected quote-form-stage-client"><span>Cliente vinculado</span><b>{quote.client.name}</b><small>{quote.client.company ?? quote.client.email ?? "Perfil de cliente"}</small></section>
      <section className="quote-form-section quote-form-stage-proposal"><p className="eyebrow">Proposta</p><div className="form-grid"><label className="form-wide">Título da proposta<input name="title" required maxLength={180} defaultValue={quote.title} /><small>É o primeiro elemento do PDF. O conteúdo detalhado é personalizado no editor.</small></label></div></section>
      <section className="quote-form-section quote-form-stage-services"><p className="eyebrow">Serviços e valores</p><QuoteServicePicker initialServices={initialServices} initialDiscountCents={quote.discountCents} initialDiscountPercentBps={quote.discountPercentBps} /></section>
      <section className="quote-form-section quote-form-stage-payments"><p className="eyebrow">Pagamentos já recebidos</p><p className="quote-form-stage-note">Opcional. Sinais ou parcelas que o cliente já pagou; o saldo aparece na folha final do PDF.</p><QuotePaymentsFields initialPayments={initialPayments} initialNotes={quote.paymentNotes} initialTotalCents={quote.amountCents} /></section>
      <section className="quote-form-section quote-form-stage-conditions"><p className="eyebrow">Validade e condições</p><div className="form-grid"><label>Válido até<input name="validUntil" type="date" defaultValue={quote.validUntil?.toISOString().slice(0, 10) ?? ""} /></label><label className="form-wide">Condições comerciais<textarea name="terms" maxLength={4000} defaultValue={quote.terms ?? ""} /></label></div></section>
      <div className="form-actions"><Link className="text-link" href={returnHref}>Cancelar</Link><button className="primary-action" type="submit">Salvar orçamento</button></div>
    </form>
    <section className="quote-record-actions"><div><p className="eyebrow">Gestão do orçamento</p><p>Ao excluir, os serviços, valores e pagamentos desta proposta também serão removidos. O cliente e o catálogo de serviços não serão alterados.</p></div><DeleteQuoteButton quoteId={quote.id} action={deleteQuoteAction} /></section>
  </section></div></main>;
}
