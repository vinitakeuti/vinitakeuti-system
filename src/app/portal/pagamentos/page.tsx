import Link from "next/link";
import { CopyTextButton } from "@/components/copy-text-button";
import { PortalShell } from "@/features/client-portal/components/portal-shell";
import { OpenInstallmentRow, installmentKey, installmentTitle, payableKeys } from "@/features/client-portal/components/open-installment-row";
import { day, money } from "@/features/client-portal/components/portal-format";
import { getPortalContext, getPortalPaymentOptions, listPortalPayments, portalTodayStart } from "@/features/client-portal/queries/portal-queries";

export const dynamic = "force-dynamic";

const errors: Record<string, string> = {
  parcela: "Essa parcela não pode ser paga agora: as parcelas são pagas em ordem, ou ela já foi quitada. Confira a lista atualizada.",
  online: "O pagamento online não está disponível no momento. Use o Pix abaixo.",
  cobranca: "Não foi possível abrir a cobrança online agora. Tente de novo em alguns minutos.",
  documento: "Para pagar online, seu cadastro precisa de CPF ou CNPJ. Fale com o responsável para completar.",
};

type PaymentsPageProps = { searchParams: Promise<{ cursor?: string; erro?: string }> };

export default async function PortalPaymentsPage({ searchParams }: PaymentsPageProps) {
  const params = await searchParams;
  const context = await getPortalContext();
  const { receivables } = context;
  const [history, options] = await Promise.all([listPortalPayments(receivables.entries.map((entry) => entry.id), { cursor: params.cursor }), getPortalPaymentOptions()]);
  const todayStart = portalTodayStart();
  const payable = payableKeys(receivables.open);
  const { profile } = options;
  const contact = [profile?.email, profile?.phone].filter(Boolean).join(" · ");

  // Sem pagamento online, a chave Pix é o caminho para pagar: aparece antes das parcelas.
  const howToPay = <section className="settings-panel" aria-labelledby="portal-how-title">
      <div className="settings-panel-heading"><div><h2 id="portal-how-title">Como pagar.</h2><p>{options.online ? "Em PAGAR AGORA, a fatura abre com Pix, boleto ou cartão. A parcela é confirmada automaticamente assim que o pagamento cai, em geral em poucos minutos (boleto: até 3 dias úteis)." : "Pague pelo Pix com a chave abaixo. A parcela aparece como paga depois que o recebimento é conferido."}</p></div></div>
      <div className="settings-panel-body">
        {/* Com o Asaas, todo pagamento passa pela fatura (confirmação automática); a chave Pix manual só aparece sem ele. */}
        {!options.online && profile?.pixKey ? <div className="portal-pix"><div><span>CHAVE PIX</span><code>{profile.pixKey}</code>{profile.name ? <small>Favorecido: {profile.name}</small> : null}</div><CopyTextButton text={profile.pixKey} label="COPIAR CHAVE PIX" /></div> : null}
        {!options.online && profile?.paymentInstructions ? <p className="portal-instructions">{profile.paymentInstructions}</p> : null}
        {!profile?.pixKey && !profile?.paymentInstructions && !options.online ? <p className="portal-instructions">Para combinar a forma de pagamento, fale com {profile?.name ?? "Vinicius Riudi"}{contact ? `: ${contact}` : ""}.</p> : null}
        {contact && (options.online || profile?.pixKey || profile?.paymentInstructions) ? <small className="portal-contact">Dúvidas sobre pagamentos: {contact}</small> : null}
      </div>
    </section>;

  return <PortalShell context={context} current="payments" section="PAGAMENTOS" title="Pagamentos." description="Parcelas em aberto, como pagar e o histórico do que já foi pago.">
    {params.erro && errors[params.erro] ? <p className="portal-feedback is-error" role="alert">{errors[params.erro]}</p> : null}

    {!options.online ? howToPay : null}

    <section className="settings-panel" id="em-aberto" aria-labelledby="portal-open-title">
      <div className="settings-panel-heading"><div><h2 id="portal-open-title">Em aberto.</h2><p>{receivables.open.length ? `${receivables.open.length} ${receivables.open.length === 1 ? "parcela" : "parcelas"} · ${money(receivables.totals.remainingCents)} no total.` : "Nenhum pagamento em aberto."}</p></div></div>
      {receivables.open.length ? <ul className="portal-list">{receivables.open.map((installment) => <OpenInstallmentRow key={installmentKey(installment)} installment={installment} todayStart={todayStart} online={options.online} payable={payable.has(installmentKey(installment))} />)}</ul> : <p className="settings-empty">{receivables.entries.length ? "Tudo pago. Obrigado!" : "Os pagamentos aparecem aqui quando um serviço for contratado."}</p>}
    </section>

    {options.online ? howToPay : null}

    {receivables.entries.length ? <section className="settings-panel" aria-labelledby="portal-plan-title">
      <div className="settings-panel-heading"><div><h2 id="portal-plan-title">Plano de pagamento.</h2><p>O combinado de cada contratação, parcela por parcela.</p></div></div>
      <ul className="portal-plan">{receivables.entries.map((entry) => {
        const remaining = entry.schedule.reduce((sum, installment) => sum + installment.remaining, 0);
        return <li key={entry.id}><details open={receivables.entries.length === 1}>
          <summary><div><b>{entry.description}</b><small>{entry.paymentCondition ? `${entry.paymentCondition} · ` : ""}{entry.installments.length ? `${entry.installments.length} parcelas` : "pagamento único"}</small></div><dl><div><dt>TOTAL</dt><dd>{money(entry.amountCents)}</dd></div><div><dt>PAGO</dt><dd>{money(Math.min(entry.paidCents, entry.amountCents))}</dd></div><div><dt>EM ABERTO</dt><dd className={remaining && entry.schedule.some((item) => item.overdue) ? "is-late" : undefined}>{money(remaining)}</dd></div></dl></summary>
          <ol className="portal-schedule">{entry.schedule.map((installment) => <li key={installment.number ?? 0} className={`is-${installment.state} ${installment.overdue ? "is-late" : ""}`}>
            <span>{installmentTitle(installment)}</span><span>vence {day(installment.dueDate)}</span><b>{money(installment.amountCents)}</b>
            <span className="portal-schedule-state">{installment.state === "paid" ? `Pago${installment.paidOn ? ` em ${day(installment.paidOn)}` : ""}` : installment.overdue ? "Em atraso" : installment.state === "partial" ? `Falta ${money(installment.remaining)}` : "Em aberto"}</span>
          </li>)}</ol>
        </details></li>;
      })}</ul>
    </section> : null}

    <section className="settings-panel" id="historico" aria-labelledby="portal-history-title">
      <div className="settings-panel-heading"><div><h2 id="portal-history-title">Histórico.</h2><p>Pagamentos confirmados, do mais recente ao mais antigo.</p></div></div>
      {history.data.length ? <ul className="portal-list">{history.data.map((payment) => <li className="portal-row is-compact" key={payment.id}><div className="portal-row-main"><b>{money(payment.amountCents)}</b><small>{payment.entry.description}</small></div><div className="portal-row-amount"><time>{day(payment.paidAt)}</time><small>{payment.chargeId ? "Pago online" : "Confirmado"}</small></div></li>)}</ul> : <p className="settings-empty">Nenhum pagamento registrado ainda.</p>}
      {history.nextCursor ? <div className="table-footer"><Link className="text-link" href={`/pagamentos?cursor=${history.nextCursor}#historico`}>CARREGAR MAIS 50</Link></div> : null}
    </section>
  </PortalShell>;
}
