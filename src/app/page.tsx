import Link from "next/link";
import { AppSidebar } from "@/components/app-sidebar";
import { NotificationList, type DashboardNotification } from "@/components/notification-list";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { headers } from "next/headers";
import { LandingPage } from "@/features/landing/components/landing-page";
import { portalForRequest } from "@/features/auth/services/auth-host";
import { requireManagementUser } from "@/features/auth/services/auth-session";
import { getOverviewData } from "@/features/overview/queries/overview-queries";

export const dynamic = "force-dynamic";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Maceio" });
const month = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "America/Maceio" });

function monitoringState(status: string) {
  if (status === "DOWN" || status === "DEGRADED") return "attention";
  if (status === "OPERATIONAL") return "ok";
  return "neutral";
}

function monitoringDetail(app: { status: string; lastCheckedAt: Date | null; lastResponseMs: number | null; healthEndpoint: string | null }) {
  if (app.status === "UNKNOWN") return app.healthEndpoint ? "Endpoint ainda não verificado" : "Endpoint de saúde não configurado";
  if (app.status === "DOWN") return "Sistema indisponível na última verificação";
  if (app.status === "DEGRADED") return app.lastResponseMs ? `Resposta lenta · ${app.lastResponseMs} ms` : "Resposta abaixo do esperado";
  return app.lastCheckedAt ? `Operacional · verificado às ${app.lastCheckedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Maceio" })}` : "Operacional";
}

export default async function Home() {
  const portal = portalForRequest(await headers());
  if (portal === "landing") return <LandingPage />;
  await requireManagementUser();
  const data = await getOverviewData();
  const { finance, monitoring, payments, monitoredApps, openQuotes, paymentNotices, period } = data;
  const expected = finance.incomeSettled + finance.incomePending;
  const progress = expected ? Math.min(100, Math.round((finance.incomeSettled / expected) * 100)) : 0;
  const periodLabel = month.format(new Date(Date.UTC(period.year, period.month - 1, 15))).replace(" de ", " / ").toUpperCase();

  const notifications: DashboardNotification[] = [
    ...(paymentNotices.count ? [{ id: "payment-notices", title: "Clientes avisaram pagamentos", detail: `${paymentNotices.count} aviso${paymentNotices.count === 1 ? "" : "s"} do portal aguardando conferência`, state: "attention" as const, href: paymentNotices.entryId ? `/financeiro/lancamentos/${paymentNotices.entryId}` : "/financeiro" }] : []),
    ...(finance.overdueCount ? [{ id: "overdue", title: "Recebimentos em atraso", detail: `${finance.overdueCount} lançamento${finance.overdueCount === 1 ? "" : "s"} · ${money.format(finance.overdueAmount / 100)}`, state: "attention" as const }] : []),
    ...(monitoring.down ? [{ id: "monitor-down", title: "Sistemas indisponíveis", detail: `${monitoring.down} monitoramento${monitoring.down === 1 ? "" : "s"} exigindo atenção`, state: "attention" as const }] : []),
    ...(openQuotes ? [{ id: "open-quotes", title: "Orçamentos aguardando decisão", detail: `${openQuotes} proposta${openQuotes === 1 ? "" : "s"} em aberto`, state: "info" as const }] : []),
    ...(monitoring.degraded ? [{ id: "monitor-degraded", title: "Sistemas degradados", detail: `${monitoring.degraded} monitoramento${monitoring.degraded === 1 ? "" : "s"} com resposta abaixo do esperado`, state: "neutral" as const }] : []),
  ].slice(0, 6);

  return <main className="app-shell">
    <AppSidebar current="overview" />
    <div className="workspace">
      <header className="topbar"><div><p className="eyebrow">GESTÃO / OPERAÇÃO / 01</p><h1>Visão geral.</h1></div><div className="topbar-actions"><SidebarToggle location="header" /></div></header>
      <section id="visao-geral" className="overview" aria-label="Visão geral">
        <article className="revenue-summary">
          <div className="section-heading"><div><p className="eyebrow">FATURAMENTO / MENSAL</p><h2>Resultado financeiro</h2></div><span className="period-label">{periodLabel}</span></div>
          <div className="revenue-main"><div><span>Recebido no mês</span><strong>{money.format(finance.incomeSettled / 100)}</strong><small>{progress}% do previsto</small></div><div className="revenue-progress" aria-label={`${progress}% do faturamento previsto realizado`}><span style={{ width: `${progress}%` }} /></div></div>
          <div className="revenue-breakdown"><div><span>Previsto</span><b>{money.format(expected / 100)}</b></div><div><span>Em aberto</span><b>{money.format(finance.incomePending / 100)}</b></div><div><span>Atrasado</span><b className="attention-text">{money.format(finance.overdueAmount / 100)}</b></div></div>
        </article>
        <article className="notification-panel" aria-labelledby="notifications-title">
          <div className="section-heading"><div><p className="eyebrow">ATENÇÃO / SISTEMA</p><h2 id="notifications-title">Notificações relevantes</h2></div><Link className="text-button" href="/financeiro">VER FINANCEIRO</Link></div>
          <NotificationList notifications={notifications} />
        </article>
      </section>
      <section className="main-grid">
        <div id="monitoramento" className="panel monitoring-panel">
          <div className="section-heading"><div><p className="eyebrow">MONITORAMENTO / LIVE</p><h2>Central de sinais</h2></div><Link className="text-button" href="/monitoramento">VER MONITORAMENTO</Link></div>
          {monitoredApps.length ? <div className="alerts scroll-region">{monitoredApps.map((app) => <div className="alert-row" key={app.id}><span className={`signal ${monitoringState(app.status)}`} /><div><b>{app.name}</b><small>{monitoringDetail(app)}</small></div><span className="chevron">›</span></div>)}</div> : <p className="list-empty">Nenhum sistema monitorado.</p>}
        </div>
        <div id="financeiro" className="panel payments-panel">
          <div className="section-heading"><div><p className="eyebrow">FINANCEIRO / A RECEBER</p><h2>Próximos pagamentos</h2></div><Link className="text-button" href="/financeiro">VER FINANCEIRO</Link></div>
          {payments.length ? <div className="payment-list scroll-region" aria-label="Lista de próximos pagamentos">{payments.map((payment) => <div className="payment-row" key={payment.id}><span className="signal info" /><div><b>{payment.counterparty || payment.description}</b><small>{money.format(payment.amountCents / 100)} · vence {date.format(payment.dueDate)}</small></div><span className="chevron">›</span></div>)}</div> : <p className="list-empty">Nenhum recebimento previsto.</p>}
        </div>
      </section>
    </div>
  </main>;
}
