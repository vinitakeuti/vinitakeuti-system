import Link from "next/link";
import { notFound } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { getQuoteForPdf } from "@/features/quotes/queries/quote-queries";
import { completeQuoteAction } from "@/features/quotes/services/quote-actions";

export const dynamic = "force-dynamic";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "America/Maceio" });
const pricingLabel = { FIXED: "valor fechado", HOURLY: "por hora", DAILY: "por dia", CUSTOM: "valor definido na proposta" } as const;
const cycleLabel: Record<string, string> = { MONTHLY: "mensal", QUARTERLY: "trimestral", SEMIANNUAL: "semestral", YEARLY: "anual" };

function quantityLabel(item: { pricingMethod: keyof typeof pricingLabel; quantity: number }) {
  if (item.pricingMethod === "HOURLY") return `${item.quantity} h`;
  if (item.pricingMethod === "DAILY") return `${item.quantity} ${item.quantity === 1 ? "dia" : "dias"}`;
  return `${item.quantity} ${item.quantity === 1 ? "unidade" : "unidades"}`;
}

export default async function QuoteDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ concluido?: string }> }) {
  const [{ id }, { concluido }] = await Promise.all([params, searchParams]);
  const quote = await getQuoteForPdf(id);
  if (!quote) notFound();
  const isCompleted = Boolean(quote.completedAt);
  const paidCents = quote.payments.reduce((total, payment) => total + payment.amountCents, 0);
  const balanceCents = Math.max(0, quote.amountCents - paidCents);

  return <main className="app-shell"><AppSidebar current="quotes" /><div className="workspace"><section className="directory-page quote-detail-page">
    <header className="directory-header"><div><p className="eyebrow">ORÇAMENTO / {isCompleted ? "CONCLUÍDO" : "PENDENTE DE CONCLUSÃO"}</p><h1>{quote.title}</h1><p>{quote.code} · {quote.client.name}</p></div><div className="header-actions quote-header-actions"><SidebarToggle location="header" /><div className="quote-detail-actions"><Link className="text-link" href={`/orcamentos/${quote.id}/editor`}>ABRIR EDITOR PDF</Link><a className="primary-action" href={`/api/orcamentos/${quote.id}/pdf`}>GERAR PDF</a><Link className="text-link" href={isCompleted ? "/vendas" : "/orcamentos/pendentes"}>VOLTAR</Link></div></div></header>
    {concluido && isCompleted ? <p className="form-success" role="status">Orçamento concluído. Ele agora segue para acompanhamento em Vendas.</p> : null}
    {!isCompleted ? <section className="quote-record-actions quote-pending-notice"><div><p className="eyebrow">PENDENTE DE CONCLUSÃO</p><p>Este orçamento continua na aba Pendentes de conclusão até você concluí-lo. Revise o documento no editor ou conclua agora se ele já estiver pronto.</p></div><div className="quote-pending-notice-actions"><Link className="secondary-action" href={`/orcamentos/${quote.id}/editor`}>CONTINUAR NO EDITOR</Link><form action={completeQuoteAction}><input type="hidden" name="quoteId" value={quote.id} /><button className="primary-action" type="submit">CONCLUIR ORÇAMENTO</button></form></div></section> : null}
    <section className="profile-surface quote-detail quote-detail-surface">
      <div className="profile-overview"><div className="profile-identity"><p className="eyebrow">CLIENTE</p><strong>{quote.client.name}</strong><span>{quote.client.company ?? quote.client.email ?? "Perfil de cliente"}</span><small>EMITIDO EM {date.format(quote.createdAt).toUpperCase()}</small></div><div className="profile-stat"><span>VALIDADE</span><b>{quote.validUntil ? date.format(quote.validUntil) : "A definir"}</b></div><div className="profile-stat"><span>INVESTIMENTO</span><b>{money.format(quote.amountCents / 100)}</b></div><div className="profile-stat"><span>SALDO A RECEBER</span><b>{money.format(balanceCents / 100)}</b></div></div>
      <div className="profile-section">
        <div className="quote-detail-toolbar"><Link className="text-link" href={`/orcamentos/${quote.id}/editar`}>AJUSTAR SERVIÇOS, VALORES E PAGAMENTOS</Link><Link className="text-link" href="/documentos/texto-padrao?tipo=proposta">TEXTO PADRÃO</Link></div>
        {quote.items.length ? <div className="quote-detail-services"><p className="eyebrow">SERVIÇOS ORÇADOS</p>{quote.items.map((item) => <div key={item.id}><span><b>{item.name}</b><small>{item.categoryName} · {pricingLabel[item.pricingMethod]} · {quantityLabel(item)}{item.billingType === "RECURRING" ? ` · ${cycleLabel[item.billingCycle ?? "MONTHLY"] ?? "mensal"}` : ""}</small></span><strong>{money.format(item.totalAmountCents / 100)}</strong></div>)}</div> : null}
        <div className="quote-detail-payments"><p className="eyebrow">PAGAMENTOS JÁ RECEBIDOS</p>{quote.payments.length ? <>{quote.payments.map((payment) => <div key={payment.id}><span><b>{date.format(payment.paidAt)}</b><small>Pagamento recebido</small></span><strong>{money.format(payment.amountCents / 100)}</strong></div>)}<div className="quote-detail-payments-total"><span><b>Total já pago</b><small>Saldo a receber: {money.format(balanceCents / 100)}</small></span><strong>{money.format(paidCents / 100)}</strong></div></> : <p className="quote-detail-payments-empty">Nenhum pagamento registrado. Use AJUSTAR SERVIÇOS, VALORES E PAGAMENTOS para incluir sinais ou parcelas.</p>}{quote.paymentNotes ? <p className="quote-detail-payments-notes">{quote.paymentNotes}</p> : null}</div>
        {quote.terms ? <dl className="address-line"><div><dt>Condições comerciais</dt><dd>{quote.terms}</dd></div></dl> : null}
      </div>
    </section>
  </section></div></main>;
}
