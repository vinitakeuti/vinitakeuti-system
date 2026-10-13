"use client";

import { useEffect, useRef, useState } from "react";
import { MAX_QUOTE_PAYMENT_NOTES, MAX_QUOTE_PAYMENTS } from "@/features/quotes/schemas/quote-payments";
import { QUOTE_TOTAL_CHANGE_EVENT } from "@/features/quotes/types/quote-events";

type InitialPayment = { amountCents: number; paidAt: string };
type PaymentRow = { key: string; amount: string; date: string };

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const EXCEEDED_MESSAGE = "A soma dos pagamentos não pode ultrapassar o total do orçamento.";

function todayInMaceio() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Maceio", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function rowCents(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) : 0;
}

export function QuotePaymentsFields({ initialPayments = [], initialNotes = "", initialTotalCents = 0 }: { initialPayments?: InitialPayment[]; initialNotes?: string | null; initialTotalCents?: number }) {
  const [rows, setRows] = useState<PaymentRow[]>(() => initialPayments.map((payment, index) => ({ key: `saved-${index}`, amount: (payment.amountCents / 100).toFixed(2), date: payment.paidAt })));
  const [totalCents, setTotalCents] = useState(initialTotalCents);
  const containerRef = useRef<HTMLDivElement>(null);
  const nextKeyRef = useRef(0);
  const paidCents = rows.reduce((total, row) => total + rowCents(row.amount), 0);
  const exceedsTotal = paidCents > totalCents;

  useEffect(() => {
    const syncTotal = (event: Event) => setTotalCents((event as CustomEvent<number>).detail);
    window.addEventListener(QUOTE_TOTAL_CHANGE_EVENT, syncTotal);
    // O seletor de serviços pode ter calculado o total antes deste componente começar a ouvir o evento.
    const totalField = containerRef.current?.closest("form")?.querySelector<HTMLInputElement>('input[name="amount"]');
    const currentTotal = totalField ? Math.round(Number(totalField.value) * 100) : Number.NaN;
    if (Number.isFinite(currentTotal)) setTotalCents(currentTotal);
    return () => window.removeEventListener(QUOTE_TOTAL_CHANGE_EVENT, syncTotal);
  }, []);

  useEffect(() => {
    const inputs = Array.from(containerRef.current?.querySelectorAll<HTMLInputElement>('input[name="paymentAmount"]') ?? []);
    inputs.forEach((input, index) => input.setCustomValidity(exceedsTotal && index === inputs.length - 1 ? EXCEEDED_MESSAGE : ""));
  }, [exceedsTotal, rows.length]);

  function addRow() {
    nextKeyRef.current += 1;
    setRows((current) => current.length >= MAX_QUOTE_PAYMENTS ? current : [...current, { key: `new-${nextKeyRef.current}`, amount: "", date: todayInMaceio() }]);
  }

  function updateRow(key: string, patch: Partial<Omit<PaymentRow, "key">>) {
    setRows((current) => current.map((row) => row.key === key ? { ...row, ...patch } : row));
  }

  return <div className={`quote-payments${rows.length ? "" : " is-empty"}`} ref={containerRef}>
    <div className="quote-payments-heading">
      <div><span>PAGAMENTOS JÁ RECEBIDOS</span><small>Opcional. Registre sinais ou parcelas que o cliente já pagou.</small></div>
      <button className="secondary-action quote-payments-add" type="button" onClick={addRow} disabled={rows.length >= MAX_QUOTE_PAYMENTS}>ADICIONAR PAGAMENTO</button>
    </div>
    {rows.length ? <>
      <div className="quote-payments-rows" aria-live="polite">{rows.map((row, index) => <div className="quote-payment-row" key={row.key}>
        <span className="quote-payment-index">{String(index + 1).padStart(2, "0")}</span>
        <label>VALOR PAGO (R$)<input name="paymentAmount" type="number" min="0.01" step="0.01" inputMode="decimal" required value={row.amount} onChange={(event) => updateRow(row.key, { amount: event.target.value })} placeholder="0,00" /></label>
        <label>DATA DO PAGAMENTO<input name="paymentDate" type="date" required value={row.date} onChange={(event) => updateRow(row.key, { date: event.target.value })} /></label>
        <button className="quote-remove-service" type="button" onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))} aria-label={`Remover pagamento ${index + 1}`}>REMOVER</button>
      </div>)}</div>
      <dl className="quote-payments-summary">
        <div><dt>Total da proposta</dt><dd>{money.format(totalCents / 100)}</dd></div>
        <div><dt>Total já pago</dt><dd>{money.format(paidCents / 100)}</dd></div>
        <div className={exceedsTotal ? "is-invalid" : undefined}><dt>Saldo a receber</dt><dd>{money.format(Math.max(0, totalCents - paidCents) / 100)}</dd></div>
      </dl>
      {exceedsTotal ? <p className="form-error" role="alert">{EXCEEDED_MESSAGE}</p> : null}
      <label className="quote-payments-notes">Observação sobre os pagamentos<textarea name="paymentNotes" maxLength={MAX_QUOTE_PAYMENT_NOTES} defaultValue={initialNotes ?? ""} placeholder="Ex.: Sinal de 50% pago via PIX. O saldo será quitado na entrega." /><small>Opcional. Aparece no PDF logo abaixo dos valores já pagos.</small></label>
    </> : <input type="hidden" name="paymentNotes" value={initialNotes ?? ""} />}
  </div>;
}
