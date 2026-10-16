import Link from "next/link";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { DeleteQuoteButton } from "@/features/quotes/components/delete-quote-button";
import { QuoteTabs } from "@/features/quotes/components/quote-tabs";
import { listPendingQuotes } from "@/features/quotes/queries/quote-queries";
import { deleteQuoteAction } from "@/features/quotes/services/quote-actions";

export const dynamic = "force-dynamic";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Maceio" });

export default async function PendingQuotesPage({ searchParams }: { searchParams: Promise<{ cursor?: string; excluido?: string }> }) {
  const { cursor, excluido } = await searchParams;
  const { data: quotes, nextCursor } = await listPendingQuotes({ cursor });

  return <main className="app-shell"><AppSidebar current="quotes" /><div className="workspace"><section className="directory-page quote-pending-page">
    <header className="directory-header"><div><p className="eyebrow">DOCUMENTOS / PROPOSTAS PENDENTES</p><h1>Documentos.</h1><p>Propostas que você começou e ainda não concluiu no editor. Retome de onde parou ou descarte o que não for seguir.</p></div><div className="header-actions"><SidebarToggle location="header" /><Link className="primary-action" href="/orcamentos/novo">NOVA PROPOSTA</Link></div></header>
    <QuoteTabs current="pending" />
    {excluido ? <p className="form-success" role="status">Orçamento excluído.</p> : null}
    <section className="directory-surface quote-pending-surface" aria-labelledby="quote-pending-title">
      <div className="quote-pending-heading"><div><p className="eyebrow">PENDENTES DE CONCLUSÃO</p><h2 id="quote-pending-title">Continue a edição.</h2></div><span>Um orçamento sai desta lista quando você usa CONCLUIR no editor.</span></div>
      {quotes.length ? <div className="quote-pending-list"><div className="table-scroll"><table className="quote-pending-table"><thead><tr><th>ORÇAMENTO</th><th>CLIENTE</th><th>VALOR</th><th>ÚLTIMA ALTERAÇÃO</th><th aria-label="Ações" /></tr></thead><tbody>
        {quotes.map((quote) => <tr key={quote.id}>
          <td className="quote-pending-title"><Link className="client-name" href={`/orcamentos/${quote.id}/editor`}>{quote.title}</Link><small>{quote.code}</small></td>
          <td className="quote-pending-client"><span>{quote.client.name}</span><small>{quote.client.company ?? "Pessoa física"}</small></td>
          <td className="quote-pending-amount"><span>{money.format(quote.amountCents / 100)}</span><small>{quote._count.items} {quote._count.items === 1 ? "serviço" : "serviços"}</small></td>
          <td className="quote-pending-date"><span>{dateTime.format(quote.updatedAt)}</span><small>Criado em {dateTime.format(quote.createdAt)}</small></td>
          <td className="quote-pending-actions"><div><Link className="primary-action" href={`/orcamentos/${quote.id}/editor`}>CONTINUAR</Link><Link className="table-link" href={`/orcamentos/${quote.id}/editar`}>VALORES</Link><DeleteQuoteButton quoteId={quote.id} action={deleteQuoteAction} returnTo="pending" compact /></div></td>
        </tr>)}
      </tbody></table></div></div> : <div className="directory-empty"><p>Nenhum orçamento pendente.</p><span>Todas as propostas iniciadas foram concluídas. As que você começar e não concluir aparecerão aqui.</span><Link className="text-link" href="/orcamentos/novo">CRIAR ORÇAMENTO</Link></div>}
      {nextCursor ? <div className="table-footer"><Link className="text-link" href={`/orcamentos/pendentes?${new URLSearchParams({ cursor: nextCursor })}`}>CARREGAR PRÓXIMOS 50</Link></div> : null}
    </section>
  </section></div></main>;
}
