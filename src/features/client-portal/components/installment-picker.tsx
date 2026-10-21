"use client";

import { useState } from "react";
import { payInstallmentAction } from "@/features/client-portal/services/portal-payment-actions";

type PickerInstallment = { number: number | null; title: string; due: string; remaining: number; situation: { label: string; tone: string } };

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Parcelas em aberto de uma venda, para escolher quantas pagar. As parcelas são quitadas em ordem, então a seleção é
 * sempre seguida a partir da primeira: marcar a parcela 5 marca até ela; desmarcar a 3 desmarca as seguintes.
 */
export function InstallmentPicker({ entryId, description, installments, online }: { entryId: string; description: string; installments: PickerInstallment[]; online: boolean }) {
  const [count, setCount] = useState(1);
  const total = installments.slice(0, count).reduce((sum, installment) => sum + installment.remaining, 0);
  const toggle = (index: number) => setCount(index < count ? index : index + 1);

  return <form className="portal-picker" action={payInstallmentAction}>
    <input type="hidden" name="entryId" value={entryId} />
    <input type="hidden" name="through" value={count ? installments[count - 1].number ?? "" : ""} />
    <p className="portal-picker-title">{description}</p>
    <ul>{installments.map((installment, index) => <li key={installment.number ?? 0} className={online && index < count ? "is-selected" : undefined}>
      <label>
        {online ? <input type="checkbox" checked={index < count} onChange={() => toggle(index)} aria-label={`Pagar ${installment.title}`} /> : null}
        <span className="portal-picker-main"><b>{installment.title}</b><small>vence {installment.due}</small></span>
        <span className={`portal-tag ${installment.situation.tone}`}>{installment.situation.label}</span>
        <strong>{money.format(installment.remaining / 100)}</strong>
      </label>
    </li>)}</ul>
    {online ? <div className="portal-picker-footer">
      <span>{count ? `${count} ${count === 1 ? "parcela selecionada" : "parcelas selecionadas"}` : "Nenhuma parcela selecionada"}</span>
      <button className="primary-action" type="submit" disabled={!count}>{count ? `PAGAR ${money.format(total / 100)}` : "PAGAR"}</button>
    </div> : null}
  </form>;
}
