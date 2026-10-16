import Link from "next/link";
import { notFound } from "next/navigation";
import { FinancialEntryStatus, FinancialEntryType } from "@prisma/client";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { ConfirmSubmitButton } from "@/features/finance/components/confirm-submit-button";
import { FINANCE_CATEGORIES, financeEntryStatusLabel, financeTypeLabel, getFinancialEntryDetail } from "@/features/finance/queries/finance-queries";
import { addFinancialPaymentAction, cancelFinancialEntryAction, deleteFinancialPaymentAction, reopenFinancialEntryAction, settleFinancialEntryAction, updateFinancialEntryAction, updateFinancialPaymentAction } from "@/features/finance/services/finance-actions";
import styles from "../../financeiro.module.css";

export const dynamic = "force-dynamic";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "America/Maceio" });
const isoDay = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Maceio" });

const notices: Record<string, string> = {
  updated: "Lançamento atualizado.",
  settled: "Lançamento quitado: o valor que faltava foi registrado.",
  cancelled: "Lançamento cancelado.",
  reopened: "Lançamento reaberto.",
  "payment-added": "Recebimento registrado.",
  "payment-updated": "Recebimento atualizado.",
  "payment-deleted": "Recebimento removido.",
};

type EntryPageProps = { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; notice?: string }> };

/** Valor no formato do campo (1500,00). */
function amountField(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function statusClass(entry: { status: string; paidCents: number }) {
  return entry.status === FinancialEntryStatus.SETTLED ? styles.settled : entry.status === FinancialEntryStatus.CANCELLED ? styles.cancelled : entry.paidCents > 0 ? styles.partial : styles.pending;
}

export default async function FinancialEntryPage({ params, searchParams }: EntryPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const entry = await getFinancialEntryDetail(id);
  if (!entry) notFound();
  const income = entry.type === FinancialEntryType.INCOME;
  const paidWord = income ? "Recebido" : "Pago";
  const remaining = Math.max(0, entry.amountCents - entry.paidCents);
  const open = entry.status === FinancialEntryStatus.PENDING;
  const cancelled = entry.status === FinancialEntryStatus.CANCELLED;
  const feedback = query.error ?? (query.notice ? notices[query.notice] : null);
  const categories = FINANCE_CATEGORIES.includes(entry.category) ? FINANCE_CATEGORIES : [entry.category, ...FINANCE_CATEGORIES];
  const progress = entry.amountCents > 0 ? Math.min(100, Math.round((entry.paidCents / entry.amountCents) * 100)) : 0;

  return <main className="app-shell"><AppSidebar current="finance" /><div className="workspace"><section className={"directory-page " + styles.page}>
    <header className="directory-header"><div><p className="eyebrow">GESTÃO / FINANCEIRO / LANÇAMENTO</p><h1>{entry.description}</h1><p>{financeTypeLabel[entry.type]} · {entry.counterparty ?? "Sem contraparte"} · {entry.category}{entry.origin === "QUOTE" ? " · criado pela venda confirmada" : ""}</p></div><div className={"header-actions " + styles.financeHeaderActions}><div className={styles.financeHeaderNavigation}><SidebarToggle location="header" /><Link className="text-link" href="/financeiro">VOLTAR AO FINANCEIRO</Link></div></div></header>
    {feedback ? <p className={query.error ? "form-error" : "form-success"} role={query.error ? "alert" : "status"}>{feedback}</p> : null}

    <section className={styles.entrySummary} aria-label="Situação do lançamento">
      <div><span>VALOR ESPERADO</span><strong>{money.format(entry.amountCents / 100)}</strong><small>Vence {date.format(entry.dueDate)}</small></div>
      <div><span>{paidWord.toUpperCase()}</span><strong className={income ? styles.income : styles.expense}>{money.format(entry.paidCents / 100)}</strong><small>{entry.payments.length} {entry.payments.length === 1 ? "registro" : "registros"}</small></div>
      <div><span>FALTA</span><strong>{money.format((cancelled ? 0 : remaining) / 100)}</strong><small>{cancelled ? "Lançamento cancelado" : remaining ? `${100 - progress}% do valor esperado` : "Nada a receber"}</small></div>
      <div><span>STATUS</span><b className={styles.status + " " + statusClass(entry)}>{financeEntryStatusLabel(entry)}</b><i className={styles.entryProgress} aria-hidden="true"><i style={{ width: `${progress}%` }} /></i></div>
    </section>

    <section className={styles.ledger}>
      <div className={styles.ledgerHeading}><div><p className="eyebrow">{income ? "RECEBIMENTOS" : "PAGAMENTOS"}</p><h2>{income ? "O que o cliente já pagou." : "O que já foi pago."}</h2><small>Cada valor que entrou de fato, com a data. O lançamento fica realizado quando a soma alcança o valor esperado.</small></div>{open && remaining ? <form action={settleFinancialEntryAction}><input type="hidden" name="id" value={entry.id} /><input type="hidden" name="returnTo" value="entry" /><button className={styles.textAction} type="submit">QUITAR O QUE FALTA</button></form> : null}</div>
      <div className={styles.paymentList}>
        {entry.payments.length ? <div className={styles.paymentHead} aria-hidden="true"><span>DATA</span><span>VALOR</span><span>OBSERVAÇÃO</span><span /></div> : null}
        {entry.payments.map((payment) => <form key={payment.id} action={updateFinancialPaymentAction} className={styles.paymentRow}>
          <input type="hidden" name="paymentId" value={payment.id} />
          <label><span>Data</span><input name="paidAt" type="date" required defaultValue={isoDay.format(payment.paidAt)} /></label>
          <label><span>Valor</span><input name="amount" inputMode="decimal" required defaultValue={amountField(payment.amountCents)} /></label>
          <label><span>Observação</span><input name="notes" maxLength={300} defaultValue={payment.notes ?? ""} placeholder="Opcional" /></label>
          <div className={styles.paymentActions}><button type="submit">SALVAR</button><ConfirmSubmitButton formAction={deleteFinancialPaymentAction} className={styles.cancelAction} message={`Remover este ${income ? "recebimento" : "pagamento"} de ${money.format(payment.amountCents / 100)}? O valor volta a ficar em aberto.`}>REMOVER</ConfirmSubmitButton></div>
        </form>)}
        {!entry.payments.length ? <p className={styles.paymentEmpty}>Nenhum valor {income ? "recebido" : "pago"} ainda.</p> : null}
        {!cancelled && remaining ? <form action={addFinancialPaymentAction} className={styles.paymentRow + " " + styles.paymentNew}>
          <input type="hidden" name="entryId" value={entry.id} />
          <label><span>Data</span><input name="paidAt" type="date" required defaultValue={isoDay.format(new Date())} /></label>
          <label><span>Valor</span><input name="amount" inputMode="decimal" required placeholder={amountField(remaining)} /></label>
          <label><span>Observação</span><input name="notes" maxLength={300} placeholder="Ex.: parcela de outubro" /></label>
          <div className={styles.paymentActions}><button className="primary-action" type="submit">{income ? "REGISTRAR RECEBIMENTO" : "REGISTRAR PAGAMENTO"}</button></div>
        </form> : null}
      </div>
    </section>

    <section className={styles.entryPanel + " " + styles.entryEdit}>
      <div className={styles.ledgerHeading}><div><p className="eyebrow">DADOS DO LANÇAMENTO</p><h2>Valor esperado e detalhes.</h2><small>O valor esperado é o total combinado. Ele não pode ficar abaixo do que já foi {income ? "recebido" : "pago"}.</small></div></div>
      <form action={updateFinancialEntryAction} className={styles.entryForm}>
        <input type="hidden" name="id" value={entry.id} />
        <label>Descrição<input name="description" maxLength={180} required defaultValue={entry.description} /></label>
        <label>Valor esperado<input name="amount" inputMode="decimal" required defaultValue={amountField(entry.amountCents)} /></label>
        <label>Vencimento<input name="dueDate" type="date" required defaultValue={isoDay.format(entry.dueDate)} /></label>
        <label>Categoria<select name="category" defaultValue={entry.category}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
        <label>Contraparte<input name="counterparty" maxLength={160} defaultValue={entry.counterparty ?? ""} placeholder="Cliente, fornecedor ou pessoa" /></label>
        <label className={styles.fixedCheck}><input name="isFixed" type="checkbox" defaultChecked={entry.isFixed} />Lançamento recorrente / custo fixo</label>
        <label className={styles.notes}>Observação<textarea name="notes" maxLength={500} rows={2} defaultValue={entry.notes ?? ""} placeholder="Opcional" /></label>
        <div className={styles.formActions}>
          {open ? <ConfirmSubmitButton formAction={cancelFinancialEntryAction} className={styles.textAction + " " + styles.cancelAction} message="Cancelar este lançamento? Ele deixa de contar no caixa e na projeção.">CANCELAR LANÇAMENTO</ConfirmSubmitButton> : null}
          {cancelled ? <button className={styles.textAction} type="submit" formAction={reopenFinancialEntryAction} formNoValidate>REABRIR LANÇAMENTO</button> : null}
          <input type="hidden" name="returnTo" value="entry" />
          <button className="primary-action" type="submit">SALVAR ALTERAÇÕES</button>
        </div>
      </form>
    </section>
  </section></div></main>;
}
