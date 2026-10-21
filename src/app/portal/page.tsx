import Link from "next/link";
import { PortalShell } from "@/features/client-portal/components/portal-shell";
import { OpenInstallmentRow, installmentKey, payableKeys } from "@/features/client-portal/components/open-installment-row";
import { day, money } from "@/features/client-portal/components/portal-format";
import { getPortalContext, getPortalDocuments, getPortalPaymentOptions, getPortalServices, listPortalPayments, portalTodayStart } from "@/features/client-portal/queries/portal-queries";

export const dynamic = "force-dynamic";

const saleStatus = { CONFIRMED: "Em andamento", PAID: "Quitado" } as Record<string, string>;

export default async function PortalHomePage() {
  const context = await getPortalContext();
  const { receivables, clientId } = context;
  const entryIds = receivables.entries.map((entry) => entry.id);
  const [services, documents, payments, options] = await Promise.all([getPortalServices(clientId), getPortalDocuments(clientId, 3), listPortalPayments(entryIds, { take: 5 }), getPortalPaymentOptions()]);
  const todayStart = portalTodayStart();
  const payable = payableKeys(receivables.open);
  const next = receivables.open.slice(0, 3);
  const firstName = (context.client?.name ?? context.user.name).trim().split(/\s+/)[0] || "cliente";
  const progress = receivables.totals.contractedCents ? Math.min(100, Math.round((receivables.totals.paidCents / receivables.totals.contractedCents) * 100)) : 0;

  return <PortalShell context={context} current="home" section="INÍCIO" title={`Olá, ${firstName}.`} description="Seus serviços contratados, pagamentos e documentos em um só lugar.">
    <div className="portal-grid">
      <section className="settings-panel portal-panel-wide" aria-labelledby="portal-next-title">
        <div className="settings-panel-heading"><div><h2 id="portal-next-title">Próximos pagamentos.</h2><p>{receivables.open.length ? `${receivables.open.length} ${receivables.open.length === 1 ? "parcela em aberto" : "parcelas em aberto"}, somando ${money(receivables.totals.remainingCents)}.` : "Nenhum pagamento em aberto."}</p></div><Link className="text-link" href="/pagamentos">VER PAGAMENTOS</Link></div>
        {receivables.entries.length ? <dl className="portal-totals">
          <div><dt>CONTRATADO</dt><dd>{money(receivables.totals.contractedCents)}</dd></div>
          <div><dt>PAGO</dt><dd>{money(receivables.totals.paidCents)}</dd></div>
          <div><dt>EM ABERTO</dt><dd>{money(receivables.totals.remainingCents)}</dd></div>
          <div className="portal-progress" aria-label={`${progress}% pago`}><dt>{progress}% PAGO</dt><dd><span style={{ width: `${progress}%` }} /></dd></div>
        </dl> : null}
        {next.length ? <ul className="portal-list">{next.map((installment) => <OpenInstallmentRow key={installmentKey(installment)} installment={installment} todayStart={todayStart} online={options.online} payable={payable.has(installmentKey(installment))} />)}</ul> : receivables.entries.length ? <p className="settings-empty">Tudo pago. Obrigado!</p> : <p className="settings-empty">Os pagamentos aparecem aqui quando um serviço for contratado.</p>}
      </section>

      <section className="settings-panel" aria-labelledby="portal-services-title">
        <div className="settings-panel-heading"><div><h2 id="portal-services-title">Serviços contratados.</h2><p>{services.sales.length ? `${services.sales.length} ${services.sales.length === 1 ? "contratação" : "contratações"}.` : "Nenhum serviço contratado ainda."}</p></div><Link className="text-link" href="/servicos">VER SERVIÇOS</Link></div>
        {services.sales.length ? <ul className="portal-list">{services.sales.slice(0, 4).map((sale) => <li className="portal-row is-compact" key={sale.id}><div className="portal-row-main"><b>{sale.title}</b><small>{sale.quote?.code ?? sale.code}{sale.confirmedAt ? ` · desde ${day(sale.confirmedAt)}` : ""}</small></div><span className={`portal-tag ${sale.status === "PAID" ? "is-ok" : ""}`}>{saleStatus[sale.status]}</span></li>)}</ul> : null}
      </section>

      <section className="settings-panel" aria-labelledby="portal-history-title">
        <div className="settings-panel-heading"><div><h2 id="portal-history-title">Últimos pagamentos.</h2><p>{payments.data.length ? "Pagamentos já confirmados." : "Nenhum pagamento registrado ainda."}</p></div><Link className="text-link" href="/pagamentos#historico">VER HISTÓRICO</Link></div>
        {payments.data.length ? <ul className="portal-list">{payments.data.map((payment) => <li className="portal-row is-compact" key={payment.id}><div className="portal-row-main"><b>{money(payment.amountCents)}</b><small>{payment.entry.description}</small></div><time className="portal-row-date">{day(payment.paidAt)}</time></li>)}</ul> : null}
      </section>

      <section className="settings-panel portal-panel-wide" aria-labelledby="portal-documents-title">
        <div className="settings-panel-heading"><div><h2 id="portal-documents-title">Documentos.</h2><p>{documents.length ? "Propostas, contratos e demais documentos concluídos." : "Nenhum documento disponível ainda."}</p></div><Link className="text-link" href="/documentos">VER DOCUMENTOS</Link></div>
        {documents.length ? <ul className="portal-list">{documents.map((document) => <li className="portal-row is-compact" key={document.id}><div className="portal-row-main"><b>{document.title}</b><small>{document.code} · {day(document.completedAt)}</small></div><a className="text-link" href={document.href} download>BAIXAR PDF</a></li>)}</ul> : null}
      </section>
    </div>
  </PortalShell>;
}
