"use client";

import { useState } from "react";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** "1.500,00", "1500,00" ou "1500" em centavos. */
function toCents(value: string) {
  const normalized = value.includes(",") ? value.replace(/\./g, "").replace(",", ".") : value.replace(/[^\d.]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) : 0;
}

function field(cents: number) {
  return cents > 0 ? (cents / 100).toFixed(2).replace(".", ",") : "";
}

/**
 * Valor total, valor por parcela e quantidade de parcelas, já descontado o que foi pago. Preenchendo o valor
 * mensal, calcula quantas parcelas faltam; preenchendo a quantidade, calcula o valor de cada uma.
 */
export function PaymentPlanCalculator({ paidCents, paidCount, defaultTotalCents, defaultCount, defaultMonthlyCents, classNames }: { paidCents: number; paidCount: number; defaultTotalCents: number; defaultCount: number; defaultMonthlyCents: number | null; classNames: { grid: string; preview: string; hint: string } }) {
  const [total, setTotal] = useState(field(defaultTotalCents));
  const [monthly, setMonthly] = useState(field(defaultMonthlyCents ?? 0));
  const [count, setCount] = useState(String(defaultCount));
  const [driver, setDriver] = useState<"monthly" | "count">(defaultMonthlyCents ? "monthly" : "count");
  const remaining = Math.max(0, toCents(total) - paidCents);

  function recalculate(next: { total?: string; monthly?: string; count?: string }, by: "monthly" | "count") {
    const rest = Math.max(0, toCents(next.total ?? total) - paidCents);
    if (by === "monthly") {
      const value = toCents(next.monthly ?? monthly);
      if (value && rest) setCount(String(Math.min(60, Math.max(1, Math.ceil(rest / value)))));
    } else {
      const parts = Math.floor(Number(next.count ?? count));
      if (parts >= 1 && rest) setMonthly(field(Math.floor(rest / parts)));
    }
  }

  const parts = Math.max(1, Math.floor(Number(count)) || 1);
  const each = driver === "monthly" && toCents(monthly) ? toCents(monthly) : Math.floor(remaining / parts);
  const last = remaining - each * (parts - 1);
  const preview = !remaining ? "Nada a parcelar: o valor total já foi pago."
    : parts === 1 ? `Falta ${money.format(remaining / 100)} em 1 parcela.`
    : last === each ? `Falta ${money.format(remaining / 100)} em ${parts} parcelas de ${money.format(each / 100)}.`
    : last > 0 ? `Falta ${money.format(remaining / 100)}: ${parts - 1} de ${money.format(each / 100)} e a última de ${money.format(last / 100)}.`
    : `O valor por parcela é maior que o que falta. Ajuste a quantidade.`;

  return <>
    <div className={classNames.grid}>
      <label>Valor total da venda<input name="total" inputMode="decimal" required value={total} onChange={(event) => { setTotal(event.target.value); recalculate({ total: event.target.value }, driver); }} /></label>
      <label>Valor por parcela<input name="monthly" inputMode="decimal" value={monthly} placeholder="Ex.: 500,00" disabled={!remaining} onChange={(event) => { setMonthly(event.target.value); setDriver("monthly"); recalculate({ monthly: event.target.value }, "monthly"); }} /></label>
      <label>Parcelas que faltam<input name="count" type="number" min={1} max={60} inputMode="numeric" value={count} disabled={!remaining} onChange={(event) => { setCount(event.target.value); setDriver("count"); recalculate({ count: event.target.value }, "count"); }} /></label>
    </div>
    <p className={classNames.preview}>{preview}</p>
    {paidCents ? <p className={classNames.hint}>Já pago: {money.format(paidCents / 100)} em {paidCount} {paidCount === 1 ? "pagamento" : "pagamentos"}. Eles entram como parcelas pagas, nas datas em que foram recebidos.</p> : null}
  </>;
}
