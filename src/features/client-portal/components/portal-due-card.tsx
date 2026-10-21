import Link from "next/link";
import type { PortalContext, PortalInstallment } from "@/features/client-portal/queries/portal-queries";
import { payInstallmentAction } from "@/features/client-portal/services/portal-payment-actions";
import { day, money } from "@/features/client-portal/components/portal-format";

const DAY_MS = 24 * 60 * 60 * 1000;

export function installmentTitle(installment: Pick<PortalInstallment, "number" | "total">) {
  return installment.number ? `Parcela ${installment.number} de ${installment.total}` : "Pagamento único";
}

/** Situação de uma parcela em aberto, para a etiqueta. */
export function installmentSituation(installment: Pick<PortalInstallment, "overdue" | "dueDate">, todayStart: Date) {
  if (installment.overdue) {
    const days = Math.round((todayStart.getTime() - installment.dueDate.getTime()) / DAY_MS);
    return { label: days <= 1 ? "Venceu ontem" : `Em atraso há ${days} dias`, tone: "is-late" };
  }
  const days = Math.round((installment.dueDate.getTime() - todayStart.getTime()) / DAY_MS);
  if (days <= 0) return { label: "Vence hoje", tone: "is-soon" };
  if (days <= 7) return { label: days === 1 ? "Vence amanhã" : `Vence em ${days} dias`, tone: "is-soon" };
  return { label: "A vencer", tone: "" };
}

type DueCardProps = { receivables: PortalContext["receivables"]; online: boolean; todayStart: Date; allHref: string };

/**
 * O pagamento em questão, em destaque: a parcela em aberto mais antiga, com PAGAR AGORA e o quanto já foi pago.
 * As demais ficam em VER TODAS AS PARCELAS.
 */
export function PortalDueCard({ receivables, online, todayStart, allHref }: DueCardProps) {
  const current = receivables.open[0] ?? null;
  const { contractedCents, paidCents, remainingCents } = receivables.totals;
  const progress = contractedCents ? Math.min(100, Math.round((paidCents / contractedCents) * 100)) : 0;
  const lateOthers = receivables.overdue.count - (current?.overdue ? 1 : 0);

  if (!current) return <section className="portal-due is-done" aria-label="Pagamentos">
    <div className="portal-due-main"><p className="portal-due-eyebrow">PAGAMENTOS</p><strong className="portal-due-amount">{receivables.entries.length ? "Tudo pago." : "Nada a pagar."}</strong><p className="portal-due-what">{receivables.entries.length ? `${money(paidCents)} pagos. Obrigado!` : "Os pagamentos aparecem aqui quando um serviço for contratado."}</p></div>
  </section>;

  const state = installmentSituation(current, todayStart);
  return <section className={`portal-due ${current.overdue ? "is-late" : ""}`} aria-labelledby="portal-due-title">
    <div className="portal-due-main">
      <p className="portal-due-eyebrow" id="portal-due-title">{current.overdue ? "PAGAMENTO EM ATRASO" : "PRÓXIMO PAGAMENTO"}</p>
      <strong className="portal-due-amount">{money(current.remaining)}</strong>
      <p className="portal-due-what">{installmentTitle(current)} · {current.entryDescription}</p>
      <p className="portal-due-when"><span className={`portal-tag ${state.tone}`}>{state.label}</span><span>vence {day(current.dueDate)}</span></p>
      {current.state === "partial" ? <p className="portal-due-note">Pago em parte: {money(current.paid)} de {money(current.amountCents)}.</p> : null}
      {lateOthers > 0 ? <p className="portal-due-note">Mais {lateOthers} {lateOthers === 1 ? "parcela em atraso" : "parcelas em atraso"}: veja todas as parcelas.</p> : null}
    </div>
    <div className="portal-due-actions">
      {online ? <form action={payInstallmentAction}><input type="hidden" name="entryId" value={current.entryId} /><input type="hidden" name="through" value={current.number ?? ""} /><button className="portal-due-pay" type="submit">PAGAR AGORA</button></form> : null}
      <small>{online ? "Pix, boleto ou cartão. Confirmação automática." : "Pague pelo Pix com a chave abaixo."}</small>
    </div>
    <div className="portal-due-footer">
      <div className="portal-due-progress" aria-label={`${progress}% pago`}><span>{money(paidCents)} de {money(contractedCents)} pagos · falta {money(remainingCents)}</span><i><b style={{ width: `${progress}%` }} /></i></div>
      {receivables.open.length > 1 ? <Link className="portal-due-all" href={allHref}>VER TODAS AS PARCELAS ({receivables.open.length})</Link> : null}
    </div>
  </section>;
}
