import Link from "next/link";
import type { OpenInstallment } from "@/features/finance/queries/finance-queries";
import { confirmInstallmentPaymentAction } from "@/features/finance/services/finance-actions";
import styles from "@/app/financeiro/financeiro.module.css";

/**
 * Parcelas a receber, uma por linha: vencimento, venda, parcela, valor que falta, situação e a cobrança do Asaas.
 * A próxima parcela de cada venda tem "Confirmar pagamento" (Pix direto, dinheiro, transferência): registra o
 * recebimento e cancela a cobrança do Asaas. As seguintes só podem ser confirmadas depois dela.
 */

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Maceio" });
const isoDay = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Maceio" });
const DAY_MS = 24 * 60 * 60 * 1000;

/** Valor no formato do campo (1500,00). */
const amountField = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");

function situation(item: OpenInstallment, today: string) {
  const due = isoDay.format(item.dueDate);
  if (due === today) return { label: "Vence hoje", tone: styles.pending };
  if (!item.overdue) return { label: "Em aberto", tone: styles.pending };
  const days = Math.max(1, Math.round((new Date(`${today}T12:00:00Z`).getTime() - new Date(`${due}T12:00:00Z`).getTime()) / DAY_MS));
  return { label: `Atrasada há ${days} ${days === 1 ? "dia" : "dias"}`, tone: styles.cancelledLate };
}

/**
 * "Confirmar pagamento" da próxima parcela: data, valor recebido (o que falta da parcela) e como recebeu.
 * `returnTo`: "client:<id>", "receivables" (ou "receivables:<id do cliente>") ou "entry".
 */
export function ConfirmInstallmentPayment({ entryId, number, remaining, hasCharge, returnTo }: { entryId: string; number: number; remaining: number; hasCharge: boolean; returnTo: string }) {
  const today = isoDay.format(new Date());
  return <details className={styles.confirmPayment}>
    <summary>Confirmar pagamento</summary>
    <form action={confirmInstallmentPaymentAction}>
      <input type="hidden" name="entryId" value={entryId} />
      <input type="hidden" name="number" value={number} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <label>Data do pagamento<input name="paidAt" type="date" required defaultValue={today} max={today} /></label>
      <label>Valor recebido<input name="amount" inputMode="decimal" required defaultValue={amountField(remaining)} /></label>
      <label className={styles.confirmNote}>Como recebeu<input name="notes" maxLength={200} placeholder="Ex.: Pix direto" /></label>
      <button type="submit">Confirmar pagamento</button>
      <p>{hasCharge ? "A cobrança aberta no Asaas é cancelada para o cliente não pagar de novo." : "O valor entra como recebido nesta venda, na data informada."}</p>
    </form>
  </details>;
}

export function OpenInstallmentsList({ items, returnTo, showClient = true }: { items: OpenInstallment[]; returnTo: string; showClient?: boolean }) {
  const today = isoDay.format(new Date());
  return <ol className={styles.receivableList}>
    {items.map((item) => {
      const state = situation(item, today);
      const firstOpen = items.find((other) => other.entryId === item.entryId && other.isNext);
      return <li key={`${item.entryId}-${item.number}`} className={item.isNext ? styles.receivableNext : undefined}>
        <span className={styles.receivableDate}>{shortDate.format(item.dueDate)}</span>
        <div className={styles.receivableWhat}>
          <Link href={`/financeiro/lancamentos/${item.entryId}`}>{item.description}</Link>
          <small>
            {item.total > 1 ? `Parcela ${item.number} de ${item.total}` : "Cobrança única"}
            {showClient && item.counterparty ? <> · {item.clientId ? <Link href={`/clientes/${item.clientId}?section=finance#parcelas`}>{item.counterparty}</Link> : item.counterparty}</> : null}
            {item.charge ? <> · {item.charge.invoiceUrl ? <a href={item.charge.invoiceUrl} target="_blank" rel="noreferrer">cobrança no Asaas</a> : "cobrança no Asaas"}</> : null}
          </small>
        </div>
        <strong className={styles.receivableAmount}>{money.format(item.remaining / 100)}{item.remaining < item.amountCents ? <small>de {money.format(item.amountCents / 100)}</small> : null}</strong>
        <i className={styles.status + " " + state.tone}>{state.label}</i>
        <div className={styles.receivableAction}>
          {item.isNext ? <ConfirmInstallmentPayment entryId={item.entryId} number={item.number} remaining={item.remaining} hasCharge={Boolean(item.charge)} returnTo={returnTo} /> : <small>{firstOpen ? `Depois da parcela ${firstOpen.number}` : "Depois da parcela anterior"}</small>}
        </div>
      </li>;
    })}
  </ol>;
}
