import type { PortalInstallment } from "@/features/client-portal/queries/portal-queries";
import { payInstallmentAction } from "@/features/client-portal/services/portal-payment-actions";
import { day, money } from "@/features/client-portal/components/portal-format";

const DAY_MS = 24 * 60 * 60 * 1000;

export function installmentKey(installment: Pick<PortalInstallment, "entryId" | "number">) {
  return `${installment.entryId}:${installment.number ?? 0}`;
}

export function installmentTitle(installment: Pick<PortalInstallment, "number" | "total" | "entryDescription">) {
  return installment.number ? `Parcela ${installment.number} de ${installment.total}` : "Pagamento único";
}

/** Primeira parcela em aberto de cada venda: as parcelas são quitadas em ordem, então só ela pode ser paga agora. */
export function payableKeys(open: PortalInstallment[]) {
  const seen = new Set<string>();
  const keys = new Set<string>();
  for (const installment of [...open].sort((left, right) => (left.number ?? 0) - (right.number ?? 0))) {
    if (seen.has(installment.entryId)) continue;
    seen.add(installment.entryId);
    keys.add(installmentKey(installment));
  }
  return keys;
}

function situation(installment: PortalInstallment, todayStart: Date) {
  if (installment.overdue) {
    const days = Math.round((todayStart.getTime() - installment.dueDate.getTime()) / DAY_MS);
    return { label: days <= 1 ? "Venceu ontem" : `Em atraso há ${days} dias`, tone: "is-late" };
  }
  const days = Math.round((installment.dueDate.getTime() - todayStart.getTime()) / DAY_MS);
  if (days <= 0) return { label: "Vence hoje", tone: "is-soon" };
  if (days <= 7) return { label: days === 1 ? "Vence amanhã" : `Vence em ${days} dias`, tone: "is-soon" };
  return { label: "A vencer", tone: "" };
}

type RowProps = { installment: PortalInstallment; todayStart: Date; online: boolean; payable: boolean };

/**
 * Parcela em aberto: situação, valor e PAGAR AGORA (fatura do Asaas). A parcela só fica paga quando o Asaas confirma
 * o pagamento; não há como o cliente marcá-la como paga.
 */
export function OpenInstallmentRow({ installment, todayStart, online, payable }: RowProps) {
  const state = situation(installment, todayStart);
  return <li className={`portal-row ${installment.overdue ? "is-late" : ""}`} id={`parcela-${installmentKey(installment).replace(":", "-")}`}>
    <div className="portal-row-main">
      <b>{installmentTitle(installment)}</b>
      <small>{installment.entryDescription}</small>
      <span className={`portal-tag ${state.tone}`}>{state.label}</span>
      {installment.state === "partial" ? <small>Pago em parte: {money(installment.paid)} de {money(installment.amountCents)}.</small> : null}
    </div>
    <div className="portal-row-amount"><strong>{money(installment.remaining)}</strong><small>vence {day(installment.dueDate)}</small></div>
    <div className="portal-row-actions">
      {online && payable ? <form action={payInstallmentAction}><input type="hidden" name="entryId" value={installment.entryId} /><input type="hidden" name="number" value={installment.number ?? ""} /><button className="primary-action" type="submit">PAGAR AGORA</button></form> : null}
      {online && !payable ? <small className="portal-row-wait">Após a parcela {(installment.number ?? 1) - 1}</small> : null}
    </div>
  </li>;
}
