import Link from "next/link";
import { notFound } from "next/navigation";
import { FinancialEntryStatus, FinancialEntryType } from "@prisma/client";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { ConfirmSubmitButton } from "@/features/finance/components/confirm-submit-button";
import { allocateInstallments, installmentPaidDates, MAX_INSTALLMENTS } from "@/features/finance/services/installments";
import { FINANCE_CATEGORIES, listPaymentConditions, financeEntryStatusKey, financeEntryStatusLabel, financeTypeLabel, getFinancialEntryDetail } from "@/features/finance/queries/finance-queries";
import { addFinancialPaymentAction, cancelFinancialEntryAction, clearInstallmentsAction, markNextInstallmentPaidAction, planInstallmentsAction, updateInstallmentAction, deleteFinancialPaymentAction, reopenFinancialEntryAction, settleFinancialEntryAction, updateFinancialEntryAction, updateFinancialPaymentAction } from "@/features/finance/services/finance-actions";
import styles from "../../financeiro.module.css";

export const dynamic = "force-dynamic";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "America/Maceio" });
const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Maceio" });
const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "America/Maceio" });
const isoDay = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Maceio" });

const notices: Record<string, string> = {
  updated: "Lançamento atualizado.",
  settled: "Lançamento quitado: o valor que faltava foi registrado.",
  cancelled: "Lançamento cancelado.",
  reopened: "Lançamento reaberto.",
  "payment-added": "Recebimento registrado.",
  "payment-updated": "Recebimento atualizado.",
  "payment-deleted": "Recebimento removido.",
  "installments-planned": "Parcelas criadas.",
  "installment-updated": "Parcela atualizada.",
  "installments-cleared": "Parcelas removidas: a cobrança voltou a ser única.",
  "installment-paid": "Pagamento registrado.",
};

type EntryPageProps = { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; notice?: string }> };

/** Valor no formato do campo (1500,00). */
function amountField(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function statusClass(entry: Parameters<typeof financeEntryStatusKey>[0]) {
  return styles[financeEntryStatusKey(entry)];
}

export default async function FinancialEntryPage({ params, searchParams }: EntryPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [entry, conditionsInUse] = await Promise.all([getFinancialEntryDetail(id), listPaymentConditions()]);
  if (!entry) notFound();
  const income = entry.type === FinancialEntryType.INCOME;
  const paidWord = income ? "Recebido" : "Pago";
  const remaining = Math.max(0, entry.amountCents - entry.paidCents);
  const open = entry.status === FinancialEntryStatus.PENDING;
  // Saídas contam como pagas na data do vencimento: não têm recebimentos para registrar, mas podem ser canceladas.
  const cancellable = open || (!income && entry.status === FinancialEntryStatus.SETTLED);
  const cancelled = entry.status === FinancialEntryStatus.CANCELLED;
  const feedback = query.error ?? (query.notice ? notices[query.notice] : null);
  const categories = FINANCE_CATEGORIES.includes(entry.category) ? FINANCE_CATEGORIES : [entry.category, ...FINANCE_CATEGORIES];
  // Parcelas com o que já foi pago em cada uma (os recebimentos quitam as parcelas em ordem).
  const installments = allocateInstallments(entry.installments, entry.paidCents);
  const planned = installments.length > 0;
  const paidDates = installmentPaidDates(entry.installments, entry.payments);
  const nextInstallment = installments.find((installment) => installment.remaining > 0) ?? null;
  const conditionOptions = [...new Set([...conditionsInUse.map((condition) => condition.name), "Mensal no Pix", "Boleto parcelado", "Cartão parcelado", "Entrada + parcelas"])];
  const todayStart = new Date(`${isoDay.format(new Date())}T00:00:00.000-03:00`);
  const progress = entry.amountCents > 0 ? Math.min(100, Math.round((entry.paidCents / entry.amountCents) * 100)) : 0;

  return <main className="app-shell"><AppSidebar current="finance" /><div className="workspace"><section className={"directory-page " + styles.page}>
    <header className="directory-header"><div><p className="eyebrow">GESTÃO / FINANCEIRO / LANÇAMENTO</p><h1>{entry.description}</h1><p>{financeTypeLabel[entry.type]} · {entry.counterparty ?? "Sem contraparte"} · {entry.category}{entry.origin === "QUOTE" ? " · criado pela venda confirmada" : ""}{entry.paymentCondition ? ` · ${entry.paymentCondition}` : ""}</p></div><div className={"header-actions " + styles.financeHeaderActions}><div className={styles.financeHeaderNavigation}><SidebarToggle location="header" /><Link className="text-link" href="/financeiro">VOLTAR AO FINANCEIRO</Link></div></div></header>
    {feedback ? <p className={query.error ? "form-error" : "form-success"} role={query.error ? "alert" : "status"}>{feedback}</p> : null}

    <section className={styles.entrySummary} aria-label="Situação do lançamento">
      <div><span>{income ? "VALOR ESPERADO" : "VALOR"}</span><strong>{money.format(entry.amountCents / 100)}</strong><small>Vence {date.format(entry.dueDate)}</small></div>
      {income ? <><div><span>{paidWord.toUpperCase()}</span><strong className={income ? styles.income : styles.expense}>{money.format(entry.paidCents / 100)}</strong><small>{entry.payments.length} {entry.payments.length === 1 ? "registro" : "registros"}</small></div>
      <div><span>FALTA</span><strong>{money.format((cancelled ? 0 : remaining) / 100)}</strong><small>{cancelled ? "Lançamento cancelado" : remaining ? `${100 - progress}% do valor esperado` : "Nada a receber"}</small></div></> : <div className={styles.entrySummaryWide}><span>COMO CONTA NO CAIXA</span><strong>{cancelled ? "Fora do caixa" : entry.dueDate.getTime() > Date.now() ? "Programado" : "Pago"}</strong><small>{cancelled ? "Saída cancelada: não entra nos custos." : `Saídas não precisam de confirmação: contam como pagas em ${date.format(entry.dueDate)}.`}</small></div>}
      <div><span>STATUS</span><b className={styles.status + " " + statusClass(entry)}>{financeEntryStatusLabel(entry)}</b>{income ? <i className={styles.entryProgress} aria-hidden="true"><i style={{ width: `${progress}%` }} /></i> : null}</div>
    </section>

    {entry.recurringEntry ? <p className={styles.recurringNote}>Este lançamento é o mês de {monthLabel.format(entry.dueDate)} da recorrência <Link href={`/financeiro/custos-fixos/${entry.recurringEntry.id}`}>{entry.recurringEntry.description}</Link>. Para mudar todos os meses, edite a recorrência; aqui a alteração vale só para este mês.</p> : null}

    {income && !cancelled ? <section className={styles.ledger + " " + styles.installmentsSection}>
      <div className={styles.ledgerHeading}><div><p className="eyebrow">PARCELAS</p><h2>{planned ? `${installments.length} ${installments.length === 1 ? "parcela" : "parcelas"}.` : "Cobrança única."}</h2><small>{planned ? "Datas e valores combinados com o cliente. Os recebimentos quitam as parcelas em ordem; ajuste a data ou o valor de cada uma." : `Vence de uma vez em ${date.format(entry.dueDate)}. Para cobrar em parcelas, informe a primeira data e quantas são.`}</small></div></div>
      {planned ? <div className={styles.paymentList}>
        <div className={styles.paymentHead + " " + styles.installmentHead} aria-hidden="true"><span>PARCELA</span><span>VENCIMENTO</span><span>VALOR</span><span>SITUAÇÃO</span><span /></div>
        {installments.map((installment) => <form key={installment.id} action={updateInstallmentAction} className={styles.paymentRow + " " + styles.installmentRow}>
          <input type="hidden" name="installmentId" value={installment.id} />
          <b className={styles.installmentNumber}>{installment.number}/{installments.length}</b>
          <label><span>Vencimento</span><input name="dueDate" type="date" required defaultValue={isoDay.format(installment.dueDate)} /></label>
          <label><span>Valor</span><input name="amount" inputMode="decimal" required defaultValue={amountField(installment.amountCents)} /></label>
          <i className={styles.status + " " + (installment.state === "paid" ? styles.settled : installment.dueDate < todayStart ? styles.cancelledLate : installment.state === "partial" ? styles.partial : styles.pending)}>{installment.state === "paid" ? (paidDates.get(installment.number) ? `Paga em ${shortDate.format(paidDates.get(installment.number)!)}` : "Paga") : installment.state === "partial" ? `Parcial · falta ${money.format(installment.remaining / 100)}` : installment.dueDate < todayStart ? "Atrasada" : "Em aberto"}</i>
          <div className={styles.paymentActions}><button type="submit">SALVAR</button></div>
        </form>)}
      </div> : null}
      {open && remaining ? <form action={markNextInstallmentPaidAction} className={styles.nextInstallment}>
        <input type="hidden" name="entryId" value={entry.id} />
        <div><span>{nextInstallment ? `PRÓXIMA PARCELA · ${nextInstallment.number}/${installments.length}` : "COBRANÇA"}</span><b>{money.format((nextInstallment?.remaining ?? remaining) / 100)}</b><small>{nextInstallment && nextInstallment.state === "partial" ? "Restante da parcela · " : ""}vence {date.format(nextInstallment?.dueDate ?? entry.dueDate)}</small></div>
        <label><span>Pago em</span><input name="paidAt" type="date" required defaultValue={isoDay.format(new Date())} /></label>
        <button className="primary-action" type="submit">{nextInstallment ? "MARCAR PARCELA PAGA" : "MARCAR PAGA"}</button>
      </form> : null}
      {open && remaining ? <details className={styles.installmentPlan} open={!planned}>
        <summary>{planned ? "REFAZER PARCELAS" : "DIVIDIR EM PARCELAS"}</summary>
        <form action={planInstallmentsAction} className={styles.paymentRow + " " + styles.paymentNew}>
          <input type="hidden" name="entryId" value={entry.id} />
          <label><span>Primeira parcela</span><input name="firstDue" type="date" required defaultValue={isoDay.format(entry.dueDate)} /></label>
          <label><span>Quantas parcelas</span><input name="count" type="number" min={1} max={MAX_INSTALLMENTS} required defaultValue={planned ? Math.max(1, installments.filter((installment) => installment.remaining > 0).length) : 2} inputMode="numeric" /></label>
          <p className={styles.fieldHint}>Divide o que falta ({money.format(remaining / 100)}) em parcelas mensais iguais.{entry.paidCents ? ` O que já entrou (${money.format(entry.paidCents / 100)}) vira a parcela de entrada.` : ""}</p>
          <div className={styles.paymentActions}><button className="primary-action" type="submit">{planned ? "REFAZER" : "CRIAR PARCELAS"}</button></div>
        </form>
      </details> : null}
      {planned ? <form action={clearInstallmentsAction} className={styles.installmentClear}><input type="hidden" name="entryId" value={entry.id} /><ConfirmSubmitButton formAction={clearInstallmentsAction} className={styles.textAction + " " + styles.cancelAction} message="Voltar a cobrança única? As parcelas serão removidas e o lançamento vence de uma vez na data da próxima parcela.">VOLTAR A COBRANÇA ÚNICA</ConfirmSubmitButton></form> : null}
    </section> : null}

    {income ? <section className={styles.ledger}>
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
    </section> : null}

    <section className={styles.entryPanel + " " + styles.entryEdit}>
      <div className={styles.ledgerHeading}><div><p className="eyebrow">DADOS DO LANÇAMENTO</p><h2>{income ? "Valor esperado e detalhes." : "Valor e detalhes."}</h2><small>{income ? "O valor esperado é o total combinado. Ele não pode ficar abaixo do que já foi recebido." : "O valor e a data definem quanto e quando esta saída conta nos custos."}</small></div></div>
      <form action={updateFinancialEntryAction} className={styles.entryForm}>
        <input type="hidden" name="id" value={entry.id} />
        <label>Descrição<input name="description" maxLength={180} required defaultValue={entry.description} /></label>
        {planned ? <>
          <label>Valor esperado<span className={styles.readonlyField}>{money.format(entry.amountCents / 100)} · soma das parcelas</span></label>
          <label>Vencimento<span className={styles.readonlyField}>{date.format(entry.dueDate)} · próxima parcela</span></label>
        </> : <>
          <label>{income ? "Valor esperado" : "Valor"}<input name="amount" inputMode="decimal" required defaultValue={amountField(entry.amountCents)} /></label>
          <label>Vencimento<input name="dueDate" type="date" required defaultValue={isoDay.format(entry.dueDate)} /></label>
        </>}
        <label>Categoria<select name="category" defaultValue={entry.category}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
        <label>Contraparte<input name="counterparty" maxLength={160} defaultValue={entry.counterparty ?? ""} placeholder="Cliente, fornecedor ou pessoa" /></label>
        {income ? <label>Condição de pagamento<input name="paymentCondition" maxLength={80} list="condicoes-pagamento" defaultValue={entry.paymentCondition ?? ""} placeholder="Ex.: Mensal no Pix" /><datalist id="condicoes-pagamento">{conditionOptions.map((name) => <option key={name} value={name} />)}</datalist></label> : null}
        <label className={styles.notes}>Observação<textarea name="notes" maxLength={500} rows={2} defaultValue={entry.notes ?? ""} placeholder="Opcional" /></label>
        <div className={styles.formActions}>
          {cancellable ? <ConfirmSubmitButton formAction={cancelFinancialEntryAction} className={styles.textAction + " " + styles.cancelAction} message="Cancelar este lançamento? Ele deixa de contar no caixa e no resultado.">CANCELAR LANÇAMENTO</ConfirmSubmitButton> : null}
          {cancelled ? <button className={styles.textAction} type="submit" formAction={reopenFinancialEntryAction} formNoValidate>REABRIR LANÇAMENTO</button> : null}
          <input type="hidden" name="returnTo" value="entry" />
          <button className="primary-action" type="submit">SALVAR ALTERAÇÕES</button>
        </div>
      </form>
    </section>
  </section></div></main>;
}
