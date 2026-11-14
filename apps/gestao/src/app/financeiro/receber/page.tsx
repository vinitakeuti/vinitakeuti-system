import Link from "next/link";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { OpenInstallmentsList } from "@/features/finance/components/open-installments";
import { listOpenInstallments } from "@/features/finance/queries/finance-queries";
import { prisma } from "@/lib/prisma";
import styles from "../financeiro.module.css";

export const dynamic = "force-dynamic";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

type ReceivablesPageProps = { searchParams: Promise<{ query?: string; cliente?: string; cursor?: string; error?: string; notice?: string }> };

function href(filters: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => { if (value) query.set(key, value); });
  const serialized = query.toString();
  return serialized ? `/financeiro/receber?${serialized}` : "/financeiro/receber";
}

/**
 * Parcelas a receber de todas as vendas, uma por linha, das atrasadas para as próximas. É aqui que se confirma à mão
 * um pagamento recebido fora do Asaas (Pix direto, dinheiro, transferência).
 */
export default async function ReceivablesPage({ searchParams }: ReceivablesPageProps) {
  const params = await searchParams;
  const query = params.query?.trim().slice(0, 120) || undefined;
  const clientId = params.cliente && /^[\w-]{1,50}$/.test(params.cliente) ? params.cliente : undefined;
  const [list, client] = await Promise.all([
    listOpenInstallments({ query, clientId, cursor: params.cursor }),
    clientId ? prisma.client.findUnique({ where: { id: clientId }, select: { id: true, name: true } }) : null,
  ]);
  const feedback = params.error ? params.error.slice(0, 300) : params.notice === "confirmado" ? "Pagamento confirmado. A parcela foi baixada e a cobrança do Asaas, se havia uma, foi cancelada." : null;
  const filters = { query, cliente: clientId };
  const { totals } = list;
  return <main className="app-shell"><AppSidebar current="finance" /><div className="workspace"><section className={"directory-page " + styles.page}>
    <header className="directory-header"><div><p className="eyebrow page-crumb"><Link href="/financeiro">Financeiro</Link> / Parcelas a receber</p><h1>Parcelas a receber</h1><p>Todas as parcelas em aberto das vendas, das atrasadas para as próximas. Recebeu fora do Asaas (Pix direto, dinheiro)? Use “Confirmar pagamento” na parcela.</p></div><div className={"header-actions " + styles.financeHeaderActions}><div className={styles.financeHeaderNavigation}><SidebarToggle location="header" /><Link className="text-link" href="/financeiro">Voltar ao financeiro</Link></div></div></header>
    {feedback ? <p className={params.error ? "form-error" : "form-success"} role={params.error ? "alert" : "status"}>{feedback}</p> : null}
    <section className={styles.ledger}>
      <div className={styles.ledgerHeading}><div><p className="eyebrow">{client ? `Cliente · ${client.name}` : "Todas as vendas"}</p><h2>{totals.openCount ? `${totals.openCount} ${totals.openCount === 1 ? "parcela em aberto" : "parcelas em aberto"}` : "Nenhuma parcela em aberto"}</h2><small>A próxima parcela de cada venda pode ser confirmada; as seguintes, depois dela, porque os pagamentos quitam as parcelas em ordem.</small></div></div>
      <div className={styles.receivableSummary}>
        <div><span>Em atraso</span><strong className={totals.overdue ? styles.expense : undefined}>{money.format(totals.overdue / 100)}</strong><small>{totals.overdueCount} {totals.overdueCount === 1 ? "parcela" : "parcelas"}</small></div>
        <div><span>Total a receber</span><strong>{money.format(totals.open / 100)}</strong><small>{totals.openCount} {totals.openCount === 1 ? "parcela" : "parcelas"}</small></div>
      </div>
      <form className={styles.filters} action="/financeiro/receber">
        {clientId ? <input type="hidden" name="cliente" value={clientId} /> : null}
        <label className={styles.search}>Buscar<input name="query" defaultValue={query ?? ""} placeholder="Cliente ou venda" /></label>
        <button type="submit">Buscar</button>
        {query || clientId ? <Link className="text-link" href="/financeiro/receber">Limpar</Link> : null}
      </form>
      {list.data.length ? <OpenInstallmentsList items={list.data} returnTo={clientId ? `receivables:${clientId}` : "receivables"} /> : <div className="directory-empty"><p>{query || clientId ? "Nenhuma parcela em aberto com esse filtro." : "Nenhuma parcela em aberto."}</p><span>As parcelas aparecem aqui quando uma venda tem condição de pagamento com valores a receber.</span></div>}
      {list.nextCursor ? <div className="table-footer"><Link className="text-link" href={href({ ...filters, cursor: list.nextCursor })}>Carregar próximas 50</Link></div> : null}
    </section>
  </section></div></main>;
}
