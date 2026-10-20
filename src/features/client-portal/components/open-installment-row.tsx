import Link from "next/link";
import type { PortalInstallment } from "@/features/client-portal/queries/portal-queries";
import { notifyPaymentAction, payInstallmentAction } from "@/features/client-portal/services/portal-payment-actions";
import { day, money } from "@/features/client-portal/components/portal-format";

const DAY_MS = 24 * 60 * 60 * 1000;

export function installmentKey(installment: Pick<PortalInstallment, "entryId" | "number">) {
  return `${installment.entryId}:${installment.number ?? 0}`;
}

export function installmentTitle(installment: Pick<PortalInstallment, "number" | "total" | "entryDescription">) {
  return installment.number ? `Parcela ${installment.number} de ${installment.total}` : "Pagamento único";
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

type RowProps = { installment: PortalInstallment; todayStart: Date; online: boolean; notice?: { amountCents: number; createdAt: Date } | null; notifyOpen?: boolean };

/** Parcela em aberto: situação, valor e as ações PAGAR (online) e JÁ PAGUEI (aviso para conferência). */
export function OpenInstallmentRow({ installment, todayStart, online, notice, notifyOpen = false }: RowProps) {
  const state = situation(installment, todayStart);
  const key = installmentKey(installment);
  const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Maceio" }).format(new Date());
  return <li className={`portal-row ${installment.overdue ? "is-late" : ""}`} id={`parcela-${key.replace(":", "-")}`}>
    <div className="portal-row-main">
      <b>{installmentTitle(installment)}</b>
      <small>{installment.entryDescription}</small>
      <span className={`portal-tag ${state.tone}`}>{state.label}</span>
      {installment.state === "partial" ? <small>Pago em parte: {money(installment.paid)} de {money(installment.amountCents)}.</small> : null}
      {notice ? <small className="portal-row-notice">Você avisou um pagamento de {money(notice.amountCents)} em {day(notice.createdAt)}. Aguardando confirmação.</small> : null}
    </div>
    <div className="portal-row-amount"><strong>{money(installment.remaining)}</strong><small>vence {day(installment.dueDate)}</small></div>
    <div className="portal-row-actions">
      {online ? <form action={payInstallmentAction}><input type="hidden" name="entryId" value={installment.entryId} /><input type="hidden" name="number" value={installment.number ?? ""} /><button className="primary-action" type="submit">PAGAR</button></form> : null}
      {!notice ? <Link className={online ? "text-link" : "secondary-action"} href={notifyOpen ? "/pagamentos#em-aberto" : `/pagamentos?avisar=${key}#parcela-${key.replace(":", "-")}`} scroll={!notifyOpen}>{notifyOpen ? "CANCELAR" : "JÁ PAGUEI"}</Link> : null}
    </div>
    {notifyOpen ? <form className="portal-notify-form" action={notifyPaymentAction}>
      <input type="hidden" name="entryId" value={installment.entryId} />
      <input type="hidden" name="number" value={installment.number ?? ""} />
      <p>Informe o pagamento feito por Pix ou transferência. Ele aparece como confirmado depois da conferência.</p>
      <label>Valor pago (R$)<input name="amount" type="number" inputMode="decimal" min="0.01" step="0.01" max={(installment.remaining / 100).toFixed(2)} defaultValue={(installment.remaining / 100).toFixed(2)} required /></label>
      <label>Data do pagamento<input name="paidOn" type="date" max={todayKey} defaultValue={todayKey} required /></label>
      <label className="portal-notify-wide">Mensagem (opcional)<textarea name="message" maxLength={500} rows={2} placeholder="Ex.: paguei pelo Pix do banco X, comprovante enviado por e-mail." /></label>
      <button className="primary-action" type="submit">ENVIAR AVISO</button>
    </form> : null}
  </li>;
}
