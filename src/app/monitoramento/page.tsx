import Link from "next/link";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { MonitoredAppCard } from "@/features/monitoring/components/monitored-app-card";
import { MonitoringDashboard } from "@/features/monitoring/components/monitoring-dashboard";
import { MonitoringGuide } from "@/features/monitoring/components/monitoring-guide";
import { countRecentIncidents, getClientForMonitoring, getMonitoringSummary, listMonitoredApps } from "@/features/monitoring/queries/monitoring-queries";

export const dynamic = "force-dynamic";

const THIRTY_DAYS_MS = 30 * 86_400_000;

type MonitoringPageProps = { searchParams: Promise<{ cursor?: string; cliente?: string; error?: string; created?: string; checked?: string; deleted?: string }> };

export default async function MonitoringPage({ searchParams }: MonitoringPageProps) {
  const params = await searchParams;
  const now = new Date();
  const filterClient = params.cliente ? await getClientForMonitoring(params.cliente.slice(0, 50)) : null;
  const [{ data: apps, nextCursor }, summary] = await Promise.all([listMonitoredApps({ cursor: params.cursor, clientId: filterClient?.id }), getMonitoringSummary(filterClient?.id)]);
  const incidents = await countRecentIncidents(apps.map((app) => app.id), new Date(now.getTime() - THIRTY_DAYS_MS));
  const nextHref = nextCursor ? `/monitoramento?${new URLSearchParams({ ...(filterClient ? { cliente: filterClient.id } : {}), cursor: nextCursor })}` : null;
  const newHref = filterClient ? `/monitoramento/novo?cliente=${filterClient.id}` : "/monitoramento/novo";
  const feedback = params.error ?? (params.created ? "Sistema cadastrado. Use VERIFICAR AGORA para confirmar o endpoint." : params.checked ? "Verificação concluída." : params.deleted ? "Sistema removido do monitoramento." : null);

  return <main className="app-shell"><AppSidebar current="monitoring" /><div className="workspace"><section className="directory-page monitoring-page">
    <header className="directory-header"><div><p className="eyebrow">OPERAÇÃO / MONITORAMENTO</p><h1>Monitoramento.</h1><p>Sistemas dos seus clientes, com disponibilidade e tempo de resposta sempre à vista.</p></div><div className="header-actions"><SidebarToggle location="header" /><Link className="primary-action" href={newHref}>ADICIONAR NOVO</Link></div></header>
    {feedback ? <p className={params.error ? "form-error monitoring-feedback" : "form-success monitoring-feedback"} role={params.error ? "alert" : "status"}>{feedback}</p> : null}
    {filterClient ? <div className="monitoring-client-filter"><div><span>FILTRANDO POR CLIENTE</span><b>{filterClient.name}</b><small>{filterClient.company ?? "Pessoa física"}</small></div><div><Link className="text-link" href={`/clientes/${filterClient.id}?section=systems`}>ABRIR CLIENTE</Link><Link className="text-link" href="/monitoramento">VER TODOS OS SISTEMAS</Link></div></div> : null}
    <MonitoringDashboard summary={summary} />
    <MonitoringGuide />
    <div className="monitor-grid-heading"><div><p className="eyebrow">SISTEMAS</p><h2>Por sistema.</h2></div><span>{apps.length} {apps.length === 1 ? "EXIBIDO" : "EXIBIDOS"}</span></div>
    {apps.length ? <div className="monitor-grid">{apps.map((app) => <MonitoredAppCard key={app.id} app={app} incidents30d={incidents.get(app.id) ?? 0} now={now} filterClientId={filterClient?.id} />)}</div> : <section className="monitoring-surface monitoring-empty"><p>{filterClient ? "Nenhum sistema vinculado a este cliente." : "Nenhum sistema monitorado."}</p><span>Cadastre a URL ou o endpoint de saúde de um sistema para começar a acompanhar a disponibilidade.</span><Link className="primary-action" href={newHref}>ADICIONAR NOVO</Link></section>}
    {nextHref ? <div className="monitor-grid-footer"><Link className="text-link" href={nextHref}>CARREGAR PRÓXIMOS 50</Link></div> : null}
  </section></div></main>;
}
