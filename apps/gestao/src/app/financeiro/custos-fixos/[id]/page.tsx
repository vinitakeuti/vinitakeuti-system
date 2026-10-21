import Link from "next/link";
import { notFound } from "next/navigation";
import { FinancialEntryType } from "@prisma/client";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { FINANCE_CATEGORIES, financeEntryStatusKey, financeEntryStatusLabel, financeTypeLabel, getRecurringEntryDetail } from "@/features/finance/queries/finance-queries";
import { endRecurringEntryAction, reactivateRecurringEntryAction, updateRecurringEntryAction } from "@/features/finance/services/recurring-actions";
import { currentMonthKey, ensureRecurringEntries, monthKeyOf, recurringDayLabel } from "@/features/finance/services/recurring-entries";
import styles from "../../financeiro.module.css";

export const dynamic = "force-dynamic";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "America/Maceio" });
const monthName = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
const DAYS = Array.from({ length: 31 }, (_, index) => index + 1);

const notices: Record<string, string> = {
  updated: "Recorrência atualizada.",
  ended: "Recorrência encerrada. Os meses seguintes saíram do Financeiro.",
  reactivated: "Recorrência reativada.",
};

type RecurringPageProps = { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; notice?: string }> };

function amountField(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export default async function RecurringEntryPage({ params, searchParams }: RecurringPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  await ensureRecurringEntries();
  const entry = await getRecurringEntryDetail(id);
  if (!entry) notFound();
  const current = currentMonthKey();
  const ended = Boolean(entry.endsOn && monthKeyOf(entry.endsOn) < current);
  const income = entry.type === FinancialEntryType.INCOME;
  const feedback = query.error ?? (query.notice ? notices[query.notice] : null);
  const categories = FINANCE_CATEGORIES.includes(entry.category) ? FINANCE_CATEGORIES : [entry.category, ...FINANCE_CATEGORIES];
  const startKey = monthKeyOf(entry.startsOn);

  return <main className="app-shell"><AppSidebar current="finance" /><div className="workspace"><section className={"directory-page " + styles.page}>
    <header className="directory-header"><div><p className="eyebrow">GESTÃO / FINANCEIRO / CUSTOS FIXOS</p><h1>{entry.description}</h1><p>{financeTypeLabel[entry.type]} mensal · {recurringDayLabel(entry.dayOfMonth)} · {entry.category}</p></div><div className={"header-actions " + styles.financeHeaderActions}><div className={styles.financeHeaderNavigation}><SidebarToggle location="header" /><Link className="text-link" href="/financeiro/custos-fixos">VOLTAR AOS CUSTOS FIXOS</Link></div></div></header>
    {feedback ? <p className={query.error ? "form-error" : "form-success"} role={query.error ? "alert" : "status"}>{feedback}</p> : null}

    <section className={styles.entrySummary} aria-label="Situação da recorrência">
      <div><span>VALOR MENSAL</span><strong className={income ? styles.income : styles.expense}>{money.format(entry.amountCents / 100)}</strong><small>{money.format((entry.amountCents * 12) / 100)} por ano</small></div>
      <div><span>VENCIMENTO</span><strong>Dia {entry.dayOfMonth}</strong><small>{entry.dayOfMonth > 28 ? "Último dia nos meses mais curtos" : "Todo mês"}</small></div>
      <div><span>INÍCIO</span><strong>{monthName.format(entry.startsOn)}</strong><small>Primeiro mês lançado</small></div>
      <div><span>SITUAÇÃO</span><b className={styles.status + " " + (ended ? styles.cancelled : styles.settled)}>{ended ? "Encerrada" : entry.endsOn ? "Encerra no fim do mês" : "Ativa"}</b><small>{entry.endsOn ? `Último mês: ${monthName.format(entry.endsOn)}` : "Sem data para terminar"}</small></div>
    </section>

    <section className={styles.entryPanel + " " + styles.entryEdit}>
      <div className={styles.ledgerHeading}><div><p className="eyebrow">DADOS DA RECORRÊNCIA</p><h2>Valor, dia e detalhes.</h2><small>As mudanças valem a partir do mês escolhido; os meses anteriores ficam como foram lançados.</small></div></div>
      <form action={updateRecurringEntryAction} className={styles.entryForm}>
        <input type="hidden" name="id" value={entry.id} />
        <input type="hidden" name="type" value={entry.type} />
        <label>Descrição<input name="description" maxLength={180} required defaultValue={entry.description} /></label>
        <label>Valor mensal<input name="amount" inputMode="decimal" required defaultValue={amountField(entry.amountCents)} /></label>
        <label>Dia do vencimento<select name="dayOfMonth" defaultValue={String(entry.dayOfMonth)}>{DAYS.map((day) => <option key={day} value={day}>{day}</option>)}</select><small className={styles.fieldHint}>Dia 29, 30 ou 31 cai no último dia nos meses mais curtos.</small></label>
        <label>Aplicar a partir de<input name="applyFrom" type="month" required min={startKey} defaultValue={current < startKey ? startKey : current} /></label>
        <label>Categoria<select name="category" defaultValue={entry.category}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
        <label>Contraparte<input name="counterparty" maxLength={160} defaultValue={entry.counterparty ?? ""} placeholder="Fornecedor, cliente ou pessoa" /></label>
        <label className={styles.notes}>Observação<textarea name="notes" maxLength={500} rows={2} defaultValue={entry.notes ?? ""} placeholder="Opcional" /></label>
        <div className={styles.formActions}><button className="primary-action" type="submit">SALVAR RECORRÊNCIA</button></div>
      </form>
    </section>

    <section className={styles.entryPanel + " " + styles.entryEdit}>
      <div className={styles.ledgerHeading}><div><p className="eyebrow">{entry.endsOn ? "ENCERRAMENTO" : "ENCERRAR"}</p><h2>{entry.endsOn ? `Último mês: ${monthName.format(entry.endsOn)}.` : "Parar de lançar este custo."}</h2><small>{entry.endsOn ? "Reativando, os meses seguintes voltam a ser lançados." : "Os meses depois do último escolhido saem do Financeiro. Os anteriores ficam no histórico."}</small></div></div>
      {entry.endsOn
        ? <form action={reactivateRecurringEntryAction} className={styles.entryForm}><input type="hidden" name="id" value={entry.id} /><div className={styles.formActions}><button className="primary-action" type="submit">REATIVAR RECORRÊNCIA</button></div></form>
        : <form action={endRecurringEntryAction} className={styles.entryForm}><input type="hidden" name="id" value={entry.id} /><label>Último mês<input name="endsOn" type="month" required min={startKey} defaultValue={current < startKey ? startKey : current} /></label><div className={styles.formActions}><button className={styles.textAction + " " + styles.cancelAction} type="submit">ENCERRAR RECORRÊNCIA</button></div></form>}
    </section>

    <section className={styles.ledger + " " + styles.entryEdit}>
      <div className={styles.ledgerHeading}><div><p className="eyebrow">MESES LANÇADOS</p><h2>Histórico no Financeiro.</h2><small>Os meses futuros aparecem conforme você consulta períodos à frente. Clique em um mês para ajustar só ele.</small></div></div>
      {entry.entries.length ? <ul className={styles.occurrenceList}>{entry.entries.map((occurrence) => <li key={occurrence.id}><Link href={`/financeiro/lancamentos/${occurrence.id}`}><span>{date.format(occurrence.dueDate)}</span><b>{money.format(occurrence.amountCents / 100)}</b><i className={styles.status + " " + styles[financeEntryStatusKey(occurrence)]}>{financeEntryStatusLabel(occurrence)}</i></Link></li>)}</ul> : <p className={styles.paymentEmpty}>Nenhum mês lançado ainda.</p>}
    </section>
  </section></div></main>;
}
