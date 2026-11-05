import Link from "next/link";
import { FinancialEntryType } from "@prisma/client";
import { financeEntryStatusKey, financeEntryStatusLabel } from "@/features/finance/queries/finance-queries";
import type { getClientFinance } from "@/features/finance/queries/client-finance";

/** Aba Financeiro do perfil do cliente: totais, resultado, os últimos 12 meses, o resumo por ano e os lançamentos. */

type ClientFinance = Awaited<ReturnType<typeof getClientFinance>>;

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brl = (cents: number) => money.format(cents / 100);
const date = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Maceio" });
const monthShort = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" });
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export function ClientFinanceSection({ clientId, clientName, data, cursor }: { clientId: string; clientName: string; data: ClientFinance; cursor?: string }) {
  const { totals } = data;
  const max = Math.max(1, ...data.monthly.flatMap((month) => [month.billed, month.expenses]));
  const base = `/clientes/${clientId}?section=finance`;
  const margin = totals.received > 0 ? Math.round((totals.result / totals.received) * 100) : null;
  return <section className="client-panel client-finance">
    <div className="client-panel-heading">
      <div><h2>Financeiro</h2><p>Entradas e saídas vinculadas a {clientName}, pela data de vencimento. Vendas confirmadas entram sozinhas.</p></div>
      <div className="client-panel-actions"><Link className="text-link" href={`/financeiro?cliente=${clientId}#novo-lancamento`}>+ Nova entrada</Link><Link className="text-link" href={`/financeiro?cliente=${clientId}&tipo=saida#novo-lancamento`}>+ Nova saída</Link></div>
    </div>
    {data.total === 0 ? <div className="client-panel-empty"><p>Nenhum lançamento vinculado a este cliente ainda.</p><span>No Financeiro, escolha o cliente no campo Contraparte de uma entrada ou saída.</span></div> : <>
      <dl className="client-finance-kpis">
        <div><dt>Faturado</dt><dd>{brl(totals.billed)}</dd><small>{plural(totals.incomeCount, "entrada", "entradas")} · recebido + a receber</small></div>
        <div><dt>Recebido</dt><dd className="is-income">{brl(totals.received)}</dd><small>{totals.billed ? `${Math.round((totals.received / totals.billed) * 100)}% do faturado` : "—"}</small></div>
        <div><dt>A receber</dt><dd>{brl(totals.receivable)}</dd><small className={totals.overdue > 0 ? "is-late" : undefined}>{totals.overdue > 0 ? `${brl(totals.overdue)} em atraso (${totals.overdueCount})` : "Nada em atraso"}</small></div>
        <div><dt>Saídas</dt><dd className="is-expense">{brl(totals.spent)}</dd><small>{totals.scheduled > 0 ? `+ ${brl(totals.scheduled)} programadas` : plural(totals.expenseCount, "saída paga", "saídas pagas")}</small></div>
        <div className="is-result"><dt>Resultado</dt><dd className={totals.result < 0 ? "is-expense" : "is-income"}>{brl(totals.result)}</dd><small>Recebido − saídas{margin !== null ? ` · margem de ${margin}%` : ""}</small></div>
      </dl>

      <div className="client-finance-grid">
        <section className="client-finance-chart" aria-label="Últimos 12 meses">
          <header><h3>Últimos 12 meses</h3><span><i className="is-income" /> faturado <i className="is-expense" /> saídas</span></header>
          <div className="client-finance-bars">{data.monthly.map((month) => <div key={month.key} title={`${month.key}: faturado ${brl(month.billed)} · saídas ${brl(month.expenses)}`}>
            <span className="client-finance-track"><i className="is-income" style={{ height: `${month.billed ? Math.max(3, (month.billed / max) * 100) : 0}%` }} /><i className="is-expense" style={{ height: `${month.expenses ? Math.max(3, (month.expenses / max) * 100) : 0}%` }} /></span>
            <small>{monthShort.format(new Date(`${month.key}-15T12:00:00Z`)).replace(".", "")}</small>
          </div>)}</div>
        </section>
        <section className="client-finance-years" aria-label="Por ano">
          <header><h3>Por ano</h3></header>
          <div className="table-scroll"><table><thead><tr><th>ANO</th><th>Faturado</th><th>Recebido</th><th>Saídas</th><th>Resultado</th></tr></thead>
            <tbody>{data.years.map((year) => <tr key={year.year}><td><b>{year.year}</b></td><td>{brl(year.billed)}</td><td>{brl(year.received)}</td><td>{brl(year.expenses)}</td><td className={year.result < 0 ? "is-expense" : undefined}>{brl(year.result)}</td></tr>)}</tbody>
          </table></div>
        </section>
      </div>

      {data.recurring.length ? <section className="client-finance-recurring" aria-label="Recorrências">
        <h3>Recorrências deste cliente</h3>
        <ul>{data.recurring.map((item) => <li key={item.id}><Link href={`/financeiro/custos-fixos/${item.id}`}><span className={item.type === FinancialEntryType.INCOME ? "is-income" : "is-expense"}>{item.type === FinancialEntryType.INCOME ? "Entrada" : "Saída"}</span><b>{item.description}</b><small>todo dia {item.dayOfMonth}</small><em>{brl(item.amountCents)}</em></Link></li>)}</ul>
      </section> : null}

      <section className="client-finance-entries" aria-label="Lançamentos">
        <header><h3>Lançamentos</h3><span>{plural(data.total, "lançamento", "lançamentos")}</span></header>
        <div className="table-scroll"><table><thead><tr><th>Vencimento</th><th>Lançamento</th><th>Valor</th><th>Situação</th></tr></thead>
          <tbody>{data.entries.map((entry) => <tr key={entry.id}>
            <td>{date.format(entry.dueDate)}</td>
            <td><span className={`client-finance-type ${entry.type === FinancialEntryType.INCOME ? "is-income" : "is-expense"}`}>{entry.type === FinancialEntryType.INCOME ? "Entrada" : "Saída"}</span><Link href={`/financeiro/lancamentos/${entry.id}`}>{entry.description}</Link><small>{entry.category}{entry.paymentCondition ? ` · ${entry.paymentCondition}` : ""}</small></td>
            <td><b>{brl(entry.amountCents)}</b>{entry.type === FinancialEntryType.INCOME && entry.paidCents > 0 && entry.paidCents < entry.amountCents ? <small>recebido {brl(entry.paidCents)}</small> : null}</td>
            <td><span className={`client-finance-status is-${financeEntryStatusKey(entry)}`}>{financeEntryStatusLabel(entry)}</span></td>
          </tr>)}</tbody>
        </table></div>
        {cursor || data.next ? <div className="client-finance-pages">{cursor ? <Link className="text-link" href={base}>← Mais recentes</Link> : <span />}{data.next ? <Link className="text-link" href={`${base}&depois=${data.next}`}>Mais antigos →</Link> : null}</div> : null}
      </section>
    </>}
  </section>;
}
