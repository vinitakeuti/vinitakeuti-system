import Link from "next/link";
import { notFound } from "next/navigation";
import { FinancialEntryStatus, FinancialEntryType } from "@prisma/client";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { ConfirmSubmitButton } from "@/features/finance/components/confirm-submit-button";
import { PaymentPlanCalculator } from "@/features/finance/components/payment-plan-calculator";
import { allocateInstallments, installmentPaidDates } from "@/features/finance/services/installments";
import { currentPlanParams } from "@/features/finance/services/payment-plan";
import { FINANCE_CATEGORIES, financeEntryStatusKey, financeEntryStatusLabel, financeTypeLabel, getFinancialEntryDetail, getQuotePaymentsForEntry, listPaymentConditions } from "@/features/finance/queries/finance-queries";
import { addFinancialPaymentAction, cancelFinancialEntryAction, deleteFinancialPaymentAction, importQuotePaymentsAction, markNextInstallmentPaidAction, reopenFinancialEntryAction, savePaymentPlanAction, settleFinancialEntryAction, updateFinancialEntryAction, updateFinancialPaymentAction, updateInstallmentAction } from "@/features/finance/services/finance-actions";
import styles from "../../financeiro.module.css";

export const dynamic = "force-dynamic";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "America/Maceio" });
const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Maceio" });
const monthLabel = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "America/Maceio" });
const isoDay = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Maceio" });
const DAYS = Array.from({ length: 31 }, (_, index) => index + 1);
const SUGGESTED_CONDITIONS = ["Mensal no Pix", "Boleto parcelado", "Cartão parcelado", "Entrada + parcelas"];

const notices: Record<string, string> = {
  updated: "Lançamento atualizado.",
  settled: "Lançamento quitado: o valor que faltava foi registrado.",
  cancelled: "Lançamento cancelado.",
  reopened: "Lançamento reaberto.",
  "payment-added": "Pagamento registrado.",
  "payment-updated": "Pagamento atualizado.",
  "payment-deleted": "Pagamento removido.",
  "installment-updated": "Parcela ajustada.",
  "installment-paid": "Parcela marcada como paga.",
  "plan-saved": "Condição de pagamento salva. As parcelas foram refeitas.",
  "quote-payments": "Pagamentos da proposta trazidos para cá.",
};

type EntryPageProps = { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; notice?: string }> };

/** Valor no formato do campo (1500,00). */
function amountField(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export default async function FinancialEntryPage({ params, searchParams }: EntryPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const [entry, conditionsInUse] = await Promise.all([getFinancialEntryDetail(id), listPaymentConditions()]);
  if (!entry) notFound();
  const income = entry.type === FinancialEntryType.INCOME;
  const open = entry.status === FinancialEntryStatus.PENDING;
  const cancelled = entry.status === FinancialEntryStatus.CANCELLED;
  // Saídas contam como pagas na data do vencimento: não têm recebimentos para registrar, mas podem ser canceladas.
  const cancellable = open || (!income && entry.status === FinancialEntryStatus.SETTLED);
  const remaining = Math.max(0, entry.amountCents - entry.paidCents);
  const feedback = query.error ?? (query.notice ? notices[query.notice] : null);
  const categories = FINANCE_CATEGORIES.includes(entry.category) ? FINANCE_CATEGORIES : [entry.category, ...FINANCE_CATEGORIES];
  const today = isoDay.format(new Date());
  const todayStart = new Date(`${today}T00:00:00.000-03:00`);

  // Parcelas com o que já foi pago em cada uma (os pagamentos quitam as parcelas em ordem) e a data em que foram quitadas.
  const installments = allocateInstallments(entry.installments, entry.paidCents);
  const paidDates = installmentPaidDates(entry.installments, entry.payments);
  const next = installments.find((installment) => installment.remaining > 0) ?? null;
  const nextDue = next?.dueDate ?? (open ? entry.dueDate : null);
  const nextAmount = next?.remaining ?? remaining;
  const late = Boolean(open && nextDue && nextDue < todayStart);
  const plan = currentPlanParams(entry);
  const conditionOptions = [...new Set([...conditionsInUse.map((condition) => condition.name), ...SUGGESTED_CONDITIONS])];
  const progress = entry.amountCents > 0 ? Math.min(100, Math.round((entry.paidCents / entry.amountCents) * 100)) : 0;

  // Pagamentos da proposta que ainda não vieram para cá (vendas confirmadas antes da sincronização).
  const quotePayments = income && !cancelled ? await getQuotePaymentsForEntry(entry.sourceKey) : [];
  const missingQuotePayments = quotePayments.length > 0 && !entry.payments.some((payment) => payment.fromQuote);
  const quotePaid = quotePayments.reduce((sum, payment) => sum + payment.amountCents, 0);

  const header = <header className="directory-header"><div><p className="eyebrow">GESTÃO / FINANCEIRO / {income ? "ENTRADA" : "SAÍDA"}</p><h1>{entry.description}</h1><p>{financeTypeLabel[entry.type]} · {entry.counterparty ?? "Sem contraparte"} · {entry.category}{entry.origin === "QUOTE" ? " · venda confirmada" : ""}</p>{entry.paymentCondition ? <span className={styles.conditionTag + " " + styles.headerTag}>{entry.paymentCondition}</span> : null}</div><div className={"header-actions " + styles.financeHeaderActions}><div className={styles.financeHeaderNavigation}><SidebarToggle location="header" /><Link className="text-link" href="/financeiro">VOLTAR AO FINANCEIRO</Link></div></div></header>;

  const detailsForm = <section className={styles.entryPanel + " " + styles.entryEdit}>
    <div className={styles.ledgerHeading}><div><p className="eyebrow">DADOS DO LANÇAMENTO</p><h2>Descrição e detalhes.</h2><small>{income ? "Valor, condição e datas ficam na condição de pagamento, acima." : "O valor e a data definem quanto e quando esta saída conta nos custos."}</small></div></div>
    <form action={updateFinancialEntryAction} className={styles.entryForm}>
      <input type="hidden" name="id" value={entry.id} />
      <label>Descrição<input name="description" maxLength={180} required defaultValue={entry.description} /></label>
      {income ? null : <>
        <label>Valor<input name="amount" inputMode="decimal" required defaultValue={amountField(entry.amountCents)} /></label>
        <label>Vencimento<input name="dueDate" type="date" required defaultValue={isoDay.format(entry.dueDate)} /></label>
      </>}
      <label>Categoria<select name="category" defaultValue={entry.category}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
      <label>Contraparte<input name="counterparty" maxLength={160} defaultValue={entry.counterparty ?? ""} placeholder="Cliente, fornecedor ou pessoa" /></label>
      <label className={styles.notes}>Observação<textarea name="notes" maxLength={500} rows={2} defaultValue={entry.notes ?? ""} placeholder="Opcional" /></label>
      <div className={styles.formActions}>
        {cancellable ? <ConfirmSubmitButton formAction={cancelFinancialEntryAction} className={styles.textAction + " " + styles.cancelAction} message="Cancelar este lançamento? Ele deixa de contar no caixa e no resultado.">CANCELAR LANÇAMENTO</ConfirmSubmitButton> : null}
        {cancelled ? <button className={styles.textAction} type="submit" formAction={reopenFinancialEntryAction} formNoValidate>REABRIR LANÇAMENTO</button> : null}
        <input type="hidden" name="returnTo" value="entry" />
        <button className="primary-action" type="submit">SALVAR DADOS</button>
      </div>
    </form>
  </section>;

  if (!income) {
    return <main className="app-shell"><AppSidebar current="finance" /><div className="workspace"><section className={"directory-page " + styles.page}>
      {header}
      {feedback ? <p className={query.error ? "form-error" : "form-success"} role={query.error ? "alert" : "status"}>{feedback}</p> : null}
      <section className={styles.entrySummary} aria-label="Situação do lançamento">
        <div><span>VALOR</span><strong className={styles.expense}>{money.format(entry.amountCents / 100)}</strong><small>Vence {date.format(entry.dueDate)}</small></div>
        <div className={styles.entrySummaryWide}><span>COMO CONTA NO CAIXA</span><strong>{cancelled ? "Fora do caixa" : entry.dueDate.getTime() > Date.now() ? "Programado" : "Pago"}</strong><small>{cancelled ? "Saída cancelada: não entra nos custos." : `Saídas não precisam de confirmação: contam como pagas em ${date.format(entry.dueDate)}.`}</small></div>
        <div><span>STATUS</span><b className={styles.status + " " + styles[financeEntryStatusKey(entry)]}>{financeEntryStatusLabel(entry)}</b></div>
      </section>
      {entry.recurringEntry ? <p className={styles.recurringNote}>Este lançamento é o mês de {monthLabel.format(entry.dueDate)} do custo fixo <Link href={`/financeiro/custos-fixos/${entry.recurringEntry.id}`}>{entry.recurringEntry.description}</Link>. Para mudar todos os meses, edite o custo fixo; aqui a alteração vale só para este mês.</p> : null}
      {detailsForm}
    </section></div></main>;
  }

  return <main className="app-shell"><AppSidebar current="finance" /><div className="workspace"><section className={"directory-page " + styles.page}>
    {header}
    {feedback ? <p className={query.error ? "form-error" : "form-success"} role={query.error ? "alert" : "status"}>{feedback}</p> : null}

    {/* 1. Situação: quanto vale, quanto entrou, quanto falta e a próxima parcela. */}
    <section className={styles.entrySummary} aria-label="Situação da venda">
      <div><span>VALOR TOTAL</span><strong>{money.format(entry.amountCents / 100)}</strong><small>{installments.length ? `${installments.length} ${installments.length === 1 ? "parcela" : "parcelas"}` : "Cobrança única"}</small></div>
      <div><span>RECEBIDO</span><strong className={styles.income}>{money.format(entry.paidCents / 100)}</strong><i className={styles.entryProgress} aria-hidden="true"><i style={{ width: `${progress}%` }} /></i><small>{progress}% do total</small></div>
      <div><span>FALTA</span><strong>{money.format((cancelled ? 0 : remaining) / 100)}</strong><small>{cancelled ? "Lançamento cancelado" : remaining ? `${installments.filter((installment) => installment.state !== "paid").length || 1} em aberto` : "Tudo recebido"}</small></div>
      <div><span>PRÓXIMA PARCELA</span>{open && nextDue ? <><strong className={late ? styles.expense : undefined}>{money.format(nextAmount / 100)}</strong><small className={late ? styles.lateText : undefined}>{late ? "Atrasada · venceu em " : "Vence em "}{shortDate.format(nextDue)}</small></> : <><b className={styles.status + " " + styles[financeEntryStatusKey(entry)]}>{financeEntryStatusLabel(entry)}</b><small>{cancelled ? "Sem cobranças" : "Nenhuma parcela em aberto"}</small></>}</div>
    </section>

    {missingQuotePayments ? <form action={importQuotePaymentsAction} className={styles.quoteImport}><input type="hidden" name="entryId" value={entry.id} /><p>A proposta desta venda tem <b>{quotePayments.length} {quotePayments.length === 1 ? "pagamento registrado" : "pagamentos registrados"} ({money.format(quotePaid / 100)})</b> que ainda não estão aqui. Pagamentos iguais já lançados à mão não são duplicados.</p><button className="primary-action" type="submit">TRAZER DA PROPOSTA</button></form> : null}

    {/* 2. Condição de pagamento: como o cliente vai pagar. Salvar refaz as parcelas em aberto. */}
    {!cancelled ? <section className={styles.entryPanel + " " + styles.planPanel}>
      <div className={styles.ledgerHeading}><div><p className="eyebrow">CONDIÇÃO DE PAGAMENTO</p><h2>Como o cliente vai pagar.</h2><small>Defina o dia do mês e o valor de cada parcela (ou quantas são). O que já foi pago é descontado do total.</small></div></div>
      <form action={savePaymentPlanAction} className={styles.planForm}>
        <input type="hidden" name="entryId" value={entry.id} />
        <div className={styles.planGrid}>
          <label>Condição<input name="paymentCondition" maxLength={80} list="condicoes-pagamento" defaultValue={entry.paymentCondition ?? ""} placeholder="Ex.: Mensal no Pix" /><datalist id="condicoes-pagamento">{conditionOptions.map((name) => <option key={name} value={name} />)}</datalist></label>
          <label>Dia do vencimento<select name="dayOfMonth" defaultValue={String(plan.dayOfMonth)}>{DAYS.map((day) => <option key={day} value={day}>Todo dia {day}</option>)}</select></label>
          <label>Próxima parcela em<input name="firstMonth" type="month" required defaultValue={plan.firstMonth} /></label>
        </div>
        <PaymentPlanCalculator paidCents={entry.paidCents} paidCount={entry.payments.length} defaultTotalCents={entry.amountCents} defaultCount={plan.count} defaultMonthlyCents={installments.length ? plan.monthlyCents : null} classNames={{ grid: styles.planGrid, preview: styles.planPreview, hint: styles.fieldHint }} />
        <div className={styles.planActions}><small className={styles.fieldHint}>Dia 29, 30 ou 31 cai no último dia nos meses mais curtos.</small><button className="primary-action" type="submit">SALVAR CONDIÇÃO</button></div>
      </form>
    </section> : null}

    {/* 3. Parcelas: a próxima é marcada como paga na data em que o pagamento entrou. */}
    <section className={styles.ledger + " " + styles.entryEdit}>
      <div className={styles.ledgerHeading}><div><p className="eyebrow">PARCELAS</p><h2>{installments.length ? "Cronograma de pagamento." : "Cobrança única."}</h2><small>{installments.length ? "Marque a próxima parcela como paga quando o pagamento entrar. Use AJUSTAR para mudar a data ou o valor de uma parcela." : "Para dividir em parcelas, preencha a condição de pagamento acima."}</small></div>{open && remaining ? <form action={settleFinancialEntryAction}><input type="hidden" name="id" value={entry.id} /><input type="hidden" name="returnTo" value="entry" /><button className={styles.textAction} type="submit">QUITAR TUDO</button></form> : null}</div>
      <ol className={styles.scheduleList}>
        {installments.length ? installments.map((installment) => {
          const isNext = open && installment.number === next?.number;
          const overdue = installment.state !== "paid" && installment.dueDate < todayStart;
          const paidOn = paidDates.get(installment.number);
          return <li key={installment.id} className={isNext ? styles.scheduleNext : installment.state === "paid" ? styles.schedulePaid : undefined}>
            <b>{installment.number}/{installments.length}</b>
            <span>{shortDate.format(installment.dueDate)}</span>
            <strong>{money.format(installment.amountCents / 100)}</strong>
            <i className={styles.status + " " + (installment.state === "paid" ? styles.settled : overdue ? styles.cancelledLate : installment.state === "partial" ? styles.partial : styles.pending)}>{installment.state === "paid" ? (paidOn ? `Paga em ${shortDate.format(paidOn)}` : "Paga") : installment.state === "partial" ? `Falta ${money.format(installment.remaining / 100)}` : overdue ? "Atrasada" : "Em aberto"}</i>
            <div className={styles.scheduleActions}>
              {isNext ? <form action={markNextInstallmentPaidAction} className={styles.markPaid}><input type="hidden" name="entryId" value={entry.id} /><input name="paidAt" type="date" required defaultValue={today} aria-label="Data do pagamento" /><button type="submit">MARCAR PAGA</button></form> : null}
              {installment.state !== "paid" ? <details className={styles.adjust}><summary>AJUSTAR</summary><form action={updateInstallmentAction}><input type="hidden" name="installmentId" value={installment.id} /><label>Vencimento<input name="dueDate" type="date" required defaultValue={isoDay.format(installment.dueDate)} /></label><label>Valor<input name="amount" inputMode="decimal" required defaultValue={amountField(installment.amountCents)} /></label><button type="submit">SALVAR</button></form></details> : null}
            </div>
          </li>;
        }) : open && remaining ? <li className={styles.scheduleNext}>
          <b>Única</b><span>{shortDate.format(entry.dueDate)}</span><strong>{money.format(remaining / 100)}</strong>
          <i className={styles.status + " " + (late ? styles.cancelledLate : styles.pending)}>{late ? "Atrasada" : "Em aberto"}</i>
          <div className={styles.scheduleActions}><form action={markNextInstallmentPaidAction} className={styles.markPaid}><input type="hidden" name="entryId" value={entry.id} /><input name="paidAt" type="date" required defaultValue={today} aria-label="Data do pagamento" /><button type="submit">MARCAR PAGA</button></form></div>
        </li> : <li><span>{cancelled ? "Lançamento cancelado." : "Tudo recebido."}</span></li>}
      </ol>
    </section>

    {/* 4. Pagamentos recebidos: o histórico do que entrou, com a origem. */}
    <section className={styles.ledger + " " + styles.entryEdit}>
      <div className={styles.ledgerHeading}><div><p className="eyebrow">PAGAMENTOS RECEBIDOS</p><h2>{entry.payments.length ? `${entry.payments.length} ${entry.payments.length === 1 ? "pagamento" : "pagamentos"} · ${money.format(entry.paidCents / 100)}` : "Nenhum pagamento ainda."}</h2><small>Cada valor que entrou, com a data. Os da proposta comercial vêm automaticamente.</small></div></div>
      {entry.payments.length ? <ul className={styles.receiptList}>{entry.payments.map((payment) => <li key={payment.id}>
        <span>{shortDate.format(payment.paidAt)}</span>
        <strong>{money.format(payment.amountCents / 100)}</strong>
        <small>{payment.notes ?? "Sem observação"}{payment.fromQuote ? <em className={styles.originTag}>PROPOSTA</em> : null}</small>
        <details className={styles.adjust}><summary>EDITAR</summary><form action={updateFinancialPaymentAction}><input type="hidden" name="paymentId" value={payment.id} /><label>Data<input name="paidAt" type="date" required defaultValue={isoDay.format(payment.paidAt)} /></label><label>Valor<input name="amount" inputMode="decimal" required defaultValue={amountField(payment.amountCents)} /></label><label>Observação<input name="notes" maxLength={300} defaultValue={payment.notes ?? ""} /></label><button type="submit">SALVAR</button><ConfirmSubmitButton formAction={deleteFinancialPaymentAction} className={styles.cancelAction} message={`Remover este pagamento de ${money.format(payment.amountCents / 100)}? O valor volta a ficar em aberto.`}>REMOVER</ConfirmSubmitButton></form></details>
      </li>)}</ul> : null}
      {!cancelled && remaining ? <details className={styles.installmentPlan}><summary>REGISTRAR OUTRO VALOR</summary><form action={addFinancialPaymentAction} className={styles.paymentRow + " " + styles.paymentNew}>
        <input type="hidden" name="entryId" value={entry.id} />
        <label><span>Data</span><input name="paidAt" type="date" required defaultValue={today} /></label>
        <label><span>Valor</span><input name="amount" inputMode="decimal" required placeholder={amountField(nextAmount)} /></label>
        <label><span>Observação</span><input name="notes" maxLength={300} placeholder="Ex.: pagamento adiantado" /></label>
        <div className={styles.paymentActions}><button className="primary-action" type="submit">REGISTRAR</button></div>
      </form></details> : null}
    </section>

    {/* 5. Dados gerais. */}
    {detailsForm}
  </section></div></main>;
}
