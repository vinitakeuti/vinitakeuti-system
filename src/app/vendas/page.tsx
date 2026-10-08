import Link from "next/link";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { DeletePendingRecordButton } from "@/features/sales/components/delete-pending-record-button";
import { QuoteOpportunityActions } from "@/features/sales/components/quote-opportunity-actions";
import { deleteQuoteAction } from "@/features/quotes/services/quote-actions";
import { confirmQuoteSaleAction, deletePendingSaleAction } from "@/features/sales/services/sale-actions";
import { getSalesSummary, listOpenQuoteOpportunities, listSales, quoteStatusLabel, saleStatusLabel } from "@/features/sales/queries/sale-queries";

export const dynamic = "force-dynamic";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "America/Maceio" });

function nextHref(params: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => { if (value) query.set(key, value); });
  const serialized = query.toString();
  return serialized ? `/vendas?${serialized}` : "/vendas";
}

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ quoteCursor?: string; saleCursor?: string; from?: string; to?: string; created?: string; confirmed?: string; quoteDeleted?: string; saleDeleted?: string }> }) {
  const { quoteCursor, saleCursor, from, to, created, confirmed, quoteDeleted, saleDeleted } = await searchParams;
  const [{ data: opportunities, nextCursor: nextQuoteCursor }, { data: sales, nextCursor: nextSaleCursor }, summary] = await Promise.all([listOpenQuoteOpportunities({ cursor: quoteCursor, from, to }), listSales({ cursor: saleCursor, from, to }), getSalesSummary({ from, to })]);
  const quoteNextHref = nextQuoteCursor ? nextHref({ quoteCursor: nextQuoteCursor, saleCursor, from, to }) : null;
  const saleNextHref = nextSaleCursor ? nextHref({ quoteCursor, saleCursor: nextSaleCursor, from, to }) : null;
  const feedback = confirmed ? "Venda confirmada a partir do orçamento." : created ? "Venda direta registrada." : quoteDeleted ? "Orçamento excluído." : saleDeleted ? "Venda pendente excluída." : null;

  return <main className="app-shell"><AppSidebar current="sales" /><div className="workspace"><section className="directory-page sales-page">
    <header className="directory-header"><div><p className="eyebrow">COMERCIAL / VENDAS</p><h1>Vendas.</h1><p>Acompanhe propostas abertas, confirme vendas originadas em orçamento e registre negociações diretas.</p></div><div className="header-actions"><SidebarToggle location="header" /><Link className="primary-action" href="/vendas/nova">NOVA VENDA DIRETA</Link></div></header>
    {feedback ? <p className="form-success sales-feedback">{feedback}</p> : null}
    <section className="sales-summary" aria-label="Resumo comercial"><div><span>TOTAL PENDENTE</span><strong>{money.format(summary.pendingAmountCents / 100)}</strong><small>{summary.pendingCount} {summary.pendingCount === 1 ? "registro em negociação" : "registros em negociação"}</small></div><div><span>TOTAL CONFIRMADO</span><strong>{money.format(summary.confirmedAmountCents / 100)}</strong><small>{summary.confirmedCount} {summary.confirmedCount === 1 ? "venda confirmada" : "vendas confirmadas"}</small></div></section>
    <form className="sales-date-filter" action="/vendas"><div><label htmlFor="sales-from">PERÍODO DE REGISTRO</label><input id="sales-from" name="from" type="date" defaultValue={from} /></div><div><label htmlFor="sales-to">ATÉ</label><input id="sales-to" name="to" type="date" defaultValue={to} /></div><button type="submit">APLICAR</button>{from || to ? <Link className="text-link" href="/vendas">LIMPAR</Link> : null}</form>
    <section className="directory-surface sales-opportunities"><div className="sales-section-heading"><div><p className="eyebrow">PROPOSTAS EM ABERTO</p><h2>Aguardando decisão.</h2></div><span>{opportunities.length} EXIBIDAS</span></div>{opportunities.length ? <div className="table-scroll sales-table sales-opportunities-table"><table><thead><tr><th>ORÇAMENTO</th><th>CLIENTE</th><th>VALIDADE</th><th>VALOR</th><th>SITUAÇÃO</th><th aria-label="Ações" /></tr></thead><tbody>{opportunities.map((quote) => <tr key={quote.id}><td><Link className="table-link" href={`/orcamentos/${quote.id}`}>{quote.code}</Link><small>{quote.title}</small></td><td><span>{quote.client.name}</span><small>{quote.client.company ?? "Pessoa física"}</small></td><td>{quote.validUntil ? date.format(quote.validUntil) : "Sem data"}</td><td>{money.format(quote.amountCents / 100)}</td><td><span className={`sale-status sale-status-${quote.status.toLowerCase()}`}>{quoteStatusLabel[quote.status]}</span></td><td><QuoteOpportunityActions quoteId={quote.id} confirmAction={confirmQuoteSaleAction} deleteAction={deleteQuoteAction} /></td></tr>)}</tbody></table></div> : <div className="directory-empty sales-empty"><p>Nenhum orçamento aguardando confirmação.</p><span>Propostas criadas em Orçamentos aparecem aqui até a decisão comercial.</span><Link className="text-link" href="/orcamentos/novo">CRIAR ORÇAMENTO</Link></div>}{quoteNextHref ? <div className="table-footer"><Link className="text-link" href={quoteNextHref}>CARREGAR PRÓXIMOS 50</Link></div> : null}</section>
    <section className="directory-surface sales-records"><div className="sales-section-heading"><div><p className="eyebrow">REGISTRO COMERCIAL</p><h2>Vendas registradas.</h2></div><Link className="text-link" href="/vendas/nova">REGISTRAR VENDA DIRETA</Link></div>{sales.length ? <div className="table-scroll sales-table sales-records-table"><table><thead><tr><th>VENDA</th><th>CLIENTE</th><th>ORIGEM</th><th>DATA</th><th>VALOR</th><th>STATUS</th><th aria-label="Ações" /></tr></thead><tbody>{sales.map((sale) => <tr key={sale.id}><td><b>{sale.title}</b><small>{sale.code}</small></td><td><span>{sale.client.name}</span><small>{sale.client.company ?? "Pessoa física"}</small></td><td>{sale.quote ? <Link className="table-link" href={`/orcamentos/${sale.quote.id}`}>{sale.quote.code}</Link> : "DIRETA"}</td><td>{date.format(sale.confirmedAt ?? sale.createdAt)}</td><td>{money.format(sale.amountCents / 100)}</td><td><span className={`sale-status sale-status-${sale.status.toLowerCase()}`}>{saleStatusLabel[sale.status]}</span></td><td>{sale.status === "PENDING" ? <DeletePendingRecordButton id={sale.id} field="saleId" label="venda" action={deletePendingSaleAction} /> : null}</td></tr>)}</tbody></table></div> : <div className="directory-empty sales-empty"><p>Nenhuma venda registrada.</p><span>Confirme uma proposta acima ou registre uma venda que não passou por orçamento.</span></div>}{saleNextHref ? <div className="table-footer"><Link className="text-link" href={saleNextHref}>CARREGAR PRÓXIMAS 50</Link></div> : null}</section>
  </section></div></main>;
}
