import Link from "next/link";
import { FinancialEntryStatus } from "@prisma/client";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { getConditionSummary, listConditionEntries, listPaymentConditions } from "@/features/finance/queries/finance-queries";
import { markNextInstallmentPaidAction } from "@/features/finance/services/finance-actions";
import { allocateInstallments } from "@/features/finance/services/installments";
import styles from "../financeiro.module.css";

export const dynamic = "force-dynamic";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "America/Maceio" });
const isoDay = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Maceio" });

type ConditionsPageProps = { searchParams: Promise<{ condicao?: string; status?: string; query?: string; cursor?: string; error?: string; notice?: string }> };

function href(params: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => { if (value) query.set(key, value); });
  const serialized = query.toString();
  return serialized ? `/financeiro/condicoes?${serialized}` : "/financeiro/condicoes";
}

/** Situação da cobrança: parcelas pagas, próxima parcela (ou o que falta, sem parcelas) e se está atrasada. */
function chargeState(entry: { status: string; amountCents: number; paidCents: number; dueDate: Date; installments: Array<{ number: number; dueDate: Date; amountCents: number }> }, todayStart: Date) {
  const installments = allocateInstallments(entry.installments, entry.paidCents);
  const next = installments.find((installment) => installment.remaining > 0);
  const open = entry.status === FinancialEntryStatus.PENDING;
  const dueDate = installments.length ? next?.dueDate ?? null : open ? entry.dueDate : null;
  const amount = installments.length ? next?.remaining ?? 0 : entry.amountCents - entry.paidCents;
  return {
    total: installments.length,
    paid: installments.filter((installment) => installment.state === "paid").length,
    nextNumber: next?.number ?? null,
    dueDate: open ? dueDate : null,
    amount: open ? amount : 0,
    late: Boolean(open && dueDate && dueDate < todayStart),
  };
}

export default async function PaymentConditionsPage({ searchParams }: ConditionsPageProps) {
  const params = await searchParams;
  const filters = { condition: params.condicao, status: params.status, query: params.query, cursor: params.cursor };
  const [{ data: entries, nextCursor }, summary, conditions] = await Promise.all([listConditionEntries(filters), getConditionSummary(filters), listPaymentConditions()]);
  const today = isoDay.format(new Date());
  const todayStart = new Date(`${today}T00:00:00.000-03:00`);
  const feedback = params.error ?? (params.notice === "paid" ? "Pagamento registrado." : null);
  const keep = { condicao: params.condicao, status: params.status, query: params.query };
  const statusLabel = params.status === "quitadas" ? "quitadas" : params.status === "todas" ? "todas" : "em aberto";

  return <main className="app-shell"><AppSidebar current="finance" /><div className="workspace"><section className={"directory-page " + styles.page}>
    <header className="directory-header"><div><p className="eyebrow">GESTÃO / FINANCEIRO / CONDIÇÕES ESPECIAIS</p><h1>Condições especiais.</h1><p>Vendas com pagamento combinado à parte, como Pix mensal ou boleto parcelado. Aqui ficam todas, de qualquer data, pela próxima cobrança.</p></div><div className={"header-actions " + styles.financeHeaderActions}><div className={styles.financeHeaderNavigation}><SidebarToggle location="header" /><Link className="text-link" href="/financeiro">VOLTAR AO FINANCEIRO</Link></div></div></header>
    {feedback ? <p className={params.error ? "form-error" : "form-success"} role={params.error ? "alert" : "status"}>{feedback}</p> : null}

    <section className={styles.fixedSummary} aria-label="Resumo das condições especiais">
      <div><span>A RECEBER</span><strong className={styles.income}>{money.format(summary.remaining / 100)}</strong><small>Vendas {statusLabel}{params.condicao ? ` · ${params.condicao}` : ""}</small></div>
      <div><span>RECEBIDO</span><strong>{money.format(summary.received / 100)}</strong><small>de {money.format(summary.expected / 100)} combinados</small></div>
      <div><span>ATRASADAS</span><strong className={summary.lateCount ? styles.expense : undefined}>{summary.lateCount}</strong><small>{summary.lateCount ? `${money.format(summary.lateAmount / 100)} vencidos e não recebidos` : "Nenhuma cobrança atrasada"}</small></div>
      <div><span>VENDAS</span><strong>{summary.count}</strong><small>Com condição especial</small></div>
    </section>

    {conditions.length ? <nav className={styles.conditionChips} aria-label="Filtrar por condição"><Link href={href({ ...keep, condicao: undefined })} aria-current={!params.condicao ? "true" : undefined}>TODAS</Link>{conditions.map((condition) => <Link key={condition.name} href={href({ ...keep, condicao: condition.name })} aria-current={params.condicao === condition.name ? "true" : undefined}>{condition.name}<i>{condition.count}</i></Link>)}</nav> : null}

    <section className={styles.ledger}>
      <div className={styles.ledgerHeading}><div><p className="eyebrow">COBRANÇAS</p><h2>{params.condicao ?? "Todas as condições"}.</h2><small>Marque a próxima parcela como paga na data em que o pagamento entrou. Para mudar datas e valores das parcelas, abra a venda.</small></div><span>{entries.length} exibidas</span></div>
      <form className={styles.filters} action="/financeiro/condicoes">
        {params.condicao ? <input type="hidden" name="condicao" value={params.condicao} /> : null}
        <label className={styles.search}>BUSCAR<input name="query" defaultValue={params.query ?? ""} placeholder="Cliente, venda ou condição" /></label>
        <label>SITUAÇÃO<select name="status" defaultValue={params.status ?? ""}><option value="">Em aberto</option><option value="quitadas">Quitadas</option><option value="todas">Todas</option></select></label>
        <button type="submit">FILTRAR</button>
      </form>
      {entries.length ? <>
        <div className={styles.tableScroll}><table><thead><tr><th>VENDA</th><th>CONDIÇÃO</th><th>PARCELAS</th><th>PRÓXIMA COBRANÇA</th><th>RECEBIDO</th><th /></tr></thead><tbody>{entries.map((entry) => { const state = chargeState(entry, todayStart); return <tr key={entry.id}>
          <td><Link className={styles.entryLink} href={`/financeiro/lancamentos/${entry.id}`}>{entry.counterparty ?? entry.description}</Link><small>{entry.counterparty ? entry.description : "Sem contraparte"}</small></td>
          <td><span className={styles.conditionTag}>{entry.paymentCondition}</span></td>
          <td>{state.total ? `${state.paid} de ${state.total} pagas` : "Cobrança única"}</td>
          <td>{state.dueDate ? <><strong>{money.format(state.amount / 100)}</strong><small className={state.late ? styles.lateText : styles.progress}>{state.late ? "Atrasada · " : ""}{state.nextNumber && state.total ? `Parcela ${state.nextNumber} · ` : ""}{date.format(state.dueDate)}</small></> : <small>Quitada</small>}</td>
          <td><strong>{money.format(entry.paidCents / 100)}</strong><small className={styles.progress}>de {money.format(entry.amountCents / 100)}</small></td>
          <td>{state.dueDate ? <form action={markNextInstallmentPaidAction} className={styles.markPaid}><input type="hidden" name="entryId" value={entry.id} /><input type="hidden" name="returnTo" value="conditions" /><input name="paidAt" type="date" required defaultValue={today} aria-label="Data do pagamento" /><button type="submit">MARCAR PAGA</button></form> : <Link className={styles.editAction} href={`/financeiro/lancamentos/${entry.id}`}>ABRIR</Link>}</td>
        </tr>; })}</tbody></table></div>
        <div className={styles.mobileList}>{entries.map((entry) => { const state = chargeState(entry, todayStart); return <article key={entry.id}>
          <div className={styles.mobileTop}><span className={styles.conditionTag}>{entry.paymentCondition}</span>{state.late ? <span className={styles.status + " " + styles.cancelledLate}>Atrasada</span> : null}</div>
          <Link className={styles.entryLink} href={`/financeiro/lancamentos/${entry.id}`}>{entry.counterparty ?? entry.description}</Link>
          <small>{state.total ? `${state.paid} de ${state.total} parcelas pagas` : "Cobrança única"} · recebido {money.format(entry.paidCents / 100)} de {money.format(entry.amountCents / 100)}</small>
          {state.dueDate ? <div className={styles.mobileBottom}><b>{money.format(state.amount / 100)}</b><span>{state.nextNumber && state.total ? `Parcela ${state.nextNumber} · ` : ""}{date.format(state.dueDate)}</span></div> : null}
          {state.dueDate ? <form action={markNextInstallmentPaidAction} className={styles.markPaid}><input type="hidden" name="entryId" value={entry.id} /><input type="hidden" name="returnTo" value="conditions" /><input name="paidAt" type="date" required defaultValue={today} aria-label="Data do pagamento" /><button type="submit">MARCAR PAGA</button></form> : null}
        </article>; })}</div>
      </> : <div className="directory-empty"><p>Nenhuma venda com condição especial{params.condicao ? ` "${params.condicao}"` : ""} {statusLabel === "em aberto" ? "em aberto" : ""}.</p><span>Abra uma entrada no Financeiro e preencha Condição de pagamento (por exemplo, Mensal no Pix). Ela passa a aparecer aqui.</span></div>}
      {nextCursor ? <div className="table-footer"><Link className="text-link" href={href({ ...keep, cursor: nextCursor })}>CARREGAR PRÓXIMAS 50</Link></div> : null}
    </section>
  </section></div></main>;
}
