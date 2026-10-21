import Link from "next/link";
import { CopyTextButton } from "@/components/copy-text-button";
import { PortalShell } from "@/features/client-portal/components/portal-shell";
import { PortalDueCard, installmentSituation, installmentTitle } from "@/features/client-portal/components/portal-due-card";
import { InstallmentPicker } from "@/features/client-portal/components/installment-picker";
import { day, money } from "@/features/client-portal/components/portal-format";
import { getPortalContext, getPortalPaymentOptions, listPortalPayments, portalTodayStart } from "@/features/client-portal/queries/portal-queries";

export const dynamic = "force-dynamic";

const errors: Record<string, string> = {
  parcela: "Essas parcelas não estão mais em aberto. Confira a lista atualizada.",
  online: "O pagamento online não está disponível no momento. Use o Pix abaixo.",
  cobranca: "Não foi possível abrir a cobrança online agora. Tente de novo em alguns minutos.",
  documento: "Para pagar online, seu cadastro precisa de CPF ou CNPJ. Fale com o responsável para completar.",
};

type PaymentsPageProps = { searchParams: Promise<{ ver?: string; parcelas?: string; cursor?: string; erro?: string }> };

/**
 * Pagamentos: o pagamento em questão em destaque; as demais parcelas em VER TODAS AS PARCELAS (com seleção para pagar
 * várias), o último pagamento com ACESSAR HISTÓRICO e o plano de pagamento recolhido.
 */
export default async function PortalPaymentsPage({ searchParams }: PaymentsPageProps) {
  const params = await searchParams;
  const context = await getPortalContext();
  const { receivables } = context;
  const entryIds = receivables.entries.map((entry) => entry.id);

  if (params.ver === "historico") {
    const history = await listPortalPayments(entryIds, { cursor: params.cursor });
    return <PortalShell context={context} current="payments" section="PAGAMENTOS / HISTÓRICO" title="Histórico de pagamentos." description="Pagamentos confirmados, do mais recente ao mais antigo.">
      <section className="settings-panel" aria-labelledby="portal-history-title">
        <div className="settings-panel-heading"><div><h2 id="portal-history-title">{history.data.length ? "Pagamentos confirmados." : "Nenhum pagamento ainda."}</h2><p>Cada valor que entrou, com a data e a forma de confirmação.</p></div><Link className="text-link" href="/pagamentos">VOLTAR PARA PAGAMENTOS</Link></div>
        {history.data.length ? <ul className="portal-list">{history.data.map((payment) => <li className="portal-row is-compact" key={payment.id}><div className="portal-row-main"><b>{money(payment.amountCents)}</b><small>{payment.entry.description}</small></div><div className="portal-row-amount"><time>{day(payment.paidAt)}</time><small>{payment.chargeId ? "Pago online" : "Confirmado"}</small></div></li>)}</ul> : <p className="settings-empty">Os pagamentos aparecem aqui assim que são confirmados.</p>}
        {history.nextCursor ? <div className="table-footer"><Link className="text-link" href={`/pagamentos?ver=historico&cursor=${history.nextCursor}`}>CARREGAR MAIS 50</Link></div> : null}
      </section>
    </PortalShell>;
  }

  const [lastPayment, options] = await Promise.all([listPortalPayments(entryIds, { take: 1 }), getPortalPaymentOptions()]);
  const todayStart = portalTodayStart();
  const { profile } = options;
  const contact = [profile?.email, profile?.phone].filter(Boolean).join(" · ");
  const showAll = params.parcelas === "todas" && receivables.open.length > 1;
  const last = lastPayment.data[0] ?? null;
  const openEntries = receivables.entries.map((entry) => ({ entry, open: entry.schedule.filter((installment) => installment.remaining > 0) })).filter((item) => item.open.length);

  return <PortalShell context={context} current="payments" section="PAGAMENTOS" title="Pagamentos." description="O que vence agora, as demais parcelas e o histórico do que já foi pago.">
    {params.erro && errors[params.erro] ? <p className="portal-feedback is-error" role="alert">{errors[params.erro]}</p> : null}

    <PortalDueCard receivables={receivables} online={options.online} todayStart={todayStart} allHref="/pagamentos?parcelas=todas#parcelas" />

    {showAll ? <section className="settings-panel" id="parcelas" aria-labelledby="portal-all-title">
      <div className="settings-panel-heading"><div><h2 id="portal-all-title">Todas as parcelas em aberto.</h2><p>{options.online ? "Marque quantas quiser pagar agora. As parcelas são pagas em ordem, a partir da mais antiga." : `${receivables.open.length} parcelas · ${money(receivables.totals.remainingCents)} no total.`}</p></div><Link className="text-link" href="/pagamentos" scroll={false}>OCULTAR</Link></div>
      {openEntries.map(({ entry, open }) => <InstallmentPicker key={entry.id} entryId={entry.id} description={entry.description} online={options.online} installments={open.map((installment) => ({ number: installment.number, title: installmentTitle(installment), due: day(installment.dueDate), remaining: installment.remaining, situation: installmentSituation(installment, todayStart) }))} />)}
    </section> : null}

    {/* Sem o Asaas, o pagamento é pelo Pix manual (conferido pela gestão); com ele, tudo passa pela fatura. */}
    {!options.online ? <section className="settings-panel" aria-labelledby="portal-how-title">
      <div className="settings-panel-heading"><div><h2 id="portal-how-title">Como pagar.</h2><p>Pague pelo Pix com a chave abaixo. A parcela aparece como paga depois que o recebimento é conferido.</p></div></div>
      <div className="settings-panel-body">
        {profile?.pixKey ? <div className="portal-pix"><div><span>CHAVE PIX</span><code>{profile.pixKey}</code>{profile.name ? <small>Favorecido: {profile.name}</small> : null}</div><CopyTextButton text={profile.pixKey} label="COPIAR CHAVE PIX" /></div> : null}
        {profile?.paymentInstructions ? <p className="portal-instructions">{profile.paymentInstructions}</p> : null}
        {!profile?.pixKey && !profile?.paymentInstructions ? <p className="portal-instructions">Para combinar a forma de pagamento, fale com {profile?.name ?? "Vinicius Riudi"}{contact ? `: ${contact}` : ""}.</p> : null}
      </div>
    </section> : null}

    <section className="settings-panel" aria-labelledby="portal-last-title">
      <div className="settings-panel-heading"><div><h2 id="portal-last-title">Último pagamento.</h2>{!last ? <p>Nenhum pagamento confirmado ainda.</p> : null}</div>{last ? <Link className="text-link" href="/pagamentos?ver=historico">ACESSAR HISTÓRICO</Link> : null}</div>
      {last ? <ul className="portal-list"><li className="portal-row is-compact"><div className="portal-row-main"><b>{money(last.amountCents)}</b><small>{last.entry.description}</small></div><div className="portal-row-amount"><time>{day(last.paidAt)}</time><small>{last.chargeId ? "Pago online" : "Confirmado"}</small></div></li></ul> : null}
    </section>

    {receivables.entries.length ? <section className="settings-panel" aria-labelledby="portal-plan-title">
      <div className="settings-panel-heading"><div><h2 id="portal-plan-title">Plano de pagamento.</h2><p>O combinado de cada contratação, parcela por parcela.</p></div></div>
      <ul className="portal-plan">{receivables.entries.map((entry) => {
        const remaining = entry.schedule.reduce((sum, installment) => sum + installment.remaining, 0);
        return <li key={entry.id}><details>
          <summary><div><b>{entry.description}</b><small>{entry.paymentCondition ? `${entry.paymentCondition} · ` : ""}{entry.installments.length ? `${entry.installments.length} parcelas` : "pagamento único"}</small></div><dl><div><dt>TOTAL</dt><dd>{money(entry.amountCents)}</dd></div><div><dt>PAGO</dt><dd>{money(Math.min(entry.paidCents, entry.amountCents))}</dd></div><div><dt>EM ABERTO</dt><dd className={remaining && entry.schedule.some((item) => item.overdue) ? "is-late" : undefined}>{money(remaining)}</dd></div></dl></summary>
          <ol className="portal-schedule">{entry.schedule.map((installment) => <li key={installment.number ?? 0} className={`is-${installment.state} ${installment.overdue ? "is-late" : ""}`}>
            <span>{installmentTitle(installment)}</span><span>vence {day(installment.dueDate)}</span><b>{money(installment.amountCents)}</b>
            <span className="portal-schedule-state">{installment.state === "paid" ? `Pago${installment.paidOn ? ` em ${day(installment.paidOn)}` : ""}` : installment.overdue ? "Em atraso" : installment.state === "partial" ? `Falta ${money(installment.remaining)}` : "Em aberto"}</span>
          </li>)}</ol>
        </details></li>;
      })}</ul>
    </section> : null}

    {contact ? <p className="portal-page-note">Dúvidas sobre pagamentos: {contact}</p> : null}
  </PortalShell>;
}
