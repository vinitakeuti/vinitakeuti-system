import Link from "next/link";
import { FinancialEntryType } from "@prisma/client";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { FINANCE_CATEGORIES, financeTypeLabel, getRecurringSummary, listRecurringEntries } from "@/features/finance/queries/finance-queries";
import { createRecurringEntryAction } from "@/features/finance/services/recurring-actions";
import { currentMonthKey, ensureRecurringEntries, monthKeyOf, recurringDayLabel } from "@/features/finance/services/recurring-entries";
import styles from "../financeiro.module.css";

export const dynamic = "force-dynamic";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const month = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric", timeZone: "UTC" });
const DAYS = Array.from({ length: 31 }, (_, index) => index + 1);
type FixedCostsPageProps = { searchParams: Promise<{ error?: string; notice?: string }> };

function monthLabel(date: Date) {
  return month.format(date).replace(".", "").replace(" de ", "/");
}

export default async function FixedCostsPage({ searchParams }: FixedCostsPageProps) {
  const params = await searchParams;
  await ensureRecurringEntries();
  const [entries, summary] = await Promise.all([listRecurringEntries(), getRecurringSummary()]);
  const current = currentMonthKey();
  const active = (entry: { endsOn: Date | null }) => !entry.endsOn || monthKeyOf(entry.endsOn) >= current;
  const feedback = params.error ?? (params.notice === "created" ? "Recorrência criada. Os meses aparecem sozinhos no Financeiro." : null);
  return <main className="app-shell"><AppSidebar current="finance" /><div className="workspace"><section className={"directory-page " + styles.page + " " + styles.fixedPage}>
    <header className="directory-header"><div><p className="eyebrow">GESTÃO / FINANCEIRO / RECORRÊNCIA</p><h1>Custos fixos.</h1><p>Custos e entradas que se repetem todo mês. Cada mês é lançado sozinho no Financeiro; saídas contam como pagas na data do vencimento.</p></div><div className={"header-actions " + styles.fixedHeaderActions}><div className={styles.fixedHeaderNavigation}><SidebarToggle location="header" /><Link className="text-link" href="/financeiro">VOLTAR AO FINANCEIRO</Link></div><a className="primary-action" href="#nova-recorrencia">NOVO CUSTO FIXO</a></div></header>
    {feedback ? <p className={params.error ? "form-error" : "form-success"} role={params.error ? "alert" : "status"}>{feedback}</p> : null}

    <section className={styles.fixedSummary} aria-label="Resumo mensal das recorrências">
      <div><span>CUSTOS FIXOS POR MÊS</span><strong className={styles.expense}>{money.format(summary.expense / 100)}</strong><small>{summary.expenseCount} {summary.expenseCount === 1 ? "custo ativo" : "custos ativos"}</small></div>
      <div><span>ENTRADAS FIXAS POR MÊS</span><strong className={styles.income}>{money.format(summary.income / 100)}</strong><small>{summary.incomeCount} {summary.incomeCount === 1 ? "entrada ativa" : "entradas ativas"}</small></div>
      <div><span>SALDO FIXO MENSAL</span><strong>{money.format((summary.income - summary.expense) / 100)}</strong><small>Entradas fixas menos custos fixos</small></div>
      <div><span>CUSTO FIXO ANUAL</span><strong>{money.format((summary.expense * 12) / 100)}</strong><small>Custos ativos multiplicados por 12</small></div>
    </section>

    <details className={styles.entryPanel} id="nova-recorrencia" open={Boolean(params.error) || !entries.length}><summary><span><b>NOVO CUSTO FIXO OU ENTRADA MENSAL</b><small>Cadastre uma vez; todo mês ele entra no Financeiro.</small></span><strong>ABRIR</strong></summary>
      <form action={createRecurringEntryAction} className={styles.entryForm}>
        <label>Tipo<select name="type" defaultValue={FinancialEntryType.EXPENSE}><option value="EXPENSE">Saída (custo)</option><option value="INCOME">Entrada</option></select></label>
        <label>Descrição<input name="description" maxLength={180} required placeholder="Ex.: Assinatura do servidor" /></label>
        <label>Categoria<select name="category" defaultValue="Ferramentas">{FINANCE_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label>
        <label>Contraparte<input name="counterparty" maxLength={160} placeholder="Fornecedor, cliente ou pessoa" /></label>
        <label>Valor mensal<input name="amount" inputMode="decimal" required placeholder="0,00" /></label>
        <label>Dia do vencimento<select name="dayOfMonth" defaultValue="5">{DAYS.map((day) => <option key={day} value={day}>{day}</option>)}</select><small className={styles.fieldHint}>Dia 29, 30 ou 31 cai no último dia nos meses mais curtos.</small></label>
        <label>Primeiro mês<input name="startsOn" type="month" required defaultValue={current} /></label>
        <label>Observação<input name="notes" maxLength={500} placeholder="Opcional" /></label>
        <div className={styles.formActions}><button className="primary-action" type="submit">SALVAR RECORRÊNCIA</button></div>
      </form>
    </details>

    <section className={styles.ledger}>
      <div className={styles.ledgerHeading}><div><p className="eyebrow">CADASTRADOS</p><h2>Recorrências.</h2><small>Ativas primeiro. Abra uma para mudar valor ou dia, ou para encerrar.</small></div><span>{entries.length} {entries.length === 1 ? "cadastrada" : "cadastradas"}</span></div>
      {entries.length ? <>
        <div className={styles.tableScroll}><table><thead><tr><th>RECORRÊNCIA</th><th>CATEGORIA</th><th>VENCIMENTO</th><th>VALOR MENSAL</th><th>SITUAÇÃO</th><th /></tr></thead><tbody>{entries.map((entry) => <tr key={entry.id}>
          <td><b className={entry.type === FinancialEntryType.INCOME ? styles.incomeText : styles.expenseText}>{financeTypeLabel[entry.type]}</b><Link className={styles.entryLink} href={`/financeiro/custos-fixos/${entry.id}`}>{entry.description}</Link><small>{entry.counterparty ?? "Sem contraparte"}</small></td>
          <td>{entry.category}</td>
          <td>{recurringDayLabel(entry.dayOfMonth)}</td>
          <td><strong>{money.format(entry.amountCents / 100)}</strong></td>
          <td><span className={styles.status + " " + (active(entry) ? styles.settled : styles.cancelled)}>{active(entry) ? `Ativa desde ${monthLabel(entry.startsOn)}` : `Encerrada em ${monthLabel(entry.endsOn!)}`}</span></td>
          <td><div className={styles.actions}><Link className={styles.editAction} href={`/financeiro/custos-fixos/${entry.id}`}>EDITAR</Link></div></td>
        </tr>)}</tbody></table></div>
        <div className={styles.mobileList}>{entries.map((entry) => <article key={entry.id}>
          <div className={styles.mobileTop}><b className={entry.type === FinancialEntryType.INCOME ? styles.incomeText : styles.expenseText}>{financeTypeLabel[entry.type]}</b><span className={styles.status + " " + (active(entry) ? styles.settled : styles.cancelled)}>{active(entry) ? "Ativa" : "Encerrada"}</span></div>
          <Link className={styles.entryLink} href={`/financeiro/custos-fixos/${entry.id}`}>{entry.description}</Link>
          <small>{entry.category} · {recurringDayLabel(entry.dayOfMonth)}</small>
          <div className={styles.mobileBottom}><b>{money.format(entry.amountCents / 100)}</b><span>{active(entry) ? `desde ${monthLabel(entry.startsOn)}` : `até ${monthLabel(entry.endsOn!)}`}</span></div>
          <div className={styles.mobileActions}><Link className={styles.editAction} href={`/financeiro/custos-fixos/${entry.id}`}>EDITAR</Link></div>
        </article>)}</div>
      </> : <div className="directory-empty"><p>Nenhum custo fixo cadastrado.</p><span>Use o formulário acima: depois de salvo, ele entra no Financeiro todo mês.</span></div>}
    </section>
  </section></div></main>;
}
