import Link from "next/link";
import { notFound } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { ClientPicker } from "@/features/clients/components/client-picker";
import { DeleteMonitoredAppButton } from "@/features/monitoring/components/delete-monitored-app-button";
import { ResponseTimeChart } from "@/features/monitoring/components/response-time-chart";
import { getMonitoredApp, getMonitoringOverview, listMonitoringIncidents } from "@/features/monitoring/queries/monitoring-queries";
import { checkMonitoredAppAction, deleteMonitoredApp, updateMonitoredApp } from "@/features/monitoring/services/monitoring-actions";
import { formatDuration } from "@/features/monitoring/services/monitoring-alerts";
import { registrableDomain } from "@/features/monitoring/services/domain-check";
import { monitoringEnvironments, monitoringStatusClass, monitoringStatusLabel } from "@/features/monitoring/types/monitoring-labels";

export const dynamic = "force-dynamic";

const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Maceio" });
const day = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "America/Maceio" });
const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Maceio" });
const TABS = [{ id: "visao", label: "VISÃO GERAL" }, { id: "incidentes", label: "INCIDENTES" }, { id: "configuracao", label: "CONFIGURAÇÃO" }] as const;
type Tab = (typeof TABS)[number]["id"];
type PageProps = { params: Promise<{ id: string }>; searchParams: Promise<{ aba?: string; error?: string; updated?: string; checked?: string }> };

const DAY_MS = 24 * 60 * 60 * 1000;

function uptimeText(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : `${value >= 99.995 ? "100" : value.toFixed(2).replace(".", ",")}%`;
}

/** Situação de um vencimento (certificado ou domínio): dias restantes e se pede atenção. */
function expiry(expiresAt: Date | null, now: Date) {
  if (!expiresAt) return null;
  const days = Math.floor((expiresAt.getTime() - now.getTime()) / DAY_MS);
  return { days, label: days < 0 ? "Vencido" : days === 0 ? "Vence hoje" : `Vence em ${days} ${days === 1 ? "dia" : "dias"}`, tone: days <= 7 ? "is-critical" : days <= 30 ? "is-warning" : "is-good" };
}

export default async function MonitoredAppPage({ params, searchParams }: PageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const app = await getMonitoredApp(id);
  if (!app) notFound();
  const tab: Tab = TABS.some((item) => item.id === query.aba) ? query.aba as Tab : "visao";
  const now = new Date();
  const statusKey = monitoringStatusClass[app.status];
  const feedback = query.error ?? (query.updated ? "Sistema atualizado." : query.checked ? "Verificação concluída." : null);
  let host: string | null = null;
  try { host = new URL(app.url ?? app.healthEndpoint ?? "").hostname; } catch { host = null; }

  return <main className="app-shell"><AppSidebar current="monitoring" /><div className="workspace"><section className="directory-page monitor-detail">
    <header className="directory-header"><div><p className="eyebrow">MONITORAMENTO / SISTEMA</p><h1>{app.name}</h1><p><span className={`monitoring-status monitoring-status-${statusKey}`}><i />{monitoringStatusLabel[app.status]}</span>{app.client ? <> · <Link className="text-link-inline" href={`/clientes/${app.client.id}?section=systems`}>{app.client.name}</Link></> : null}{app.url ? <> · <a className="text-link-inline" href={app.url} target="_blank" rel="noopener noreferrer">{host}</a></> : null}</p></div>
      <div className="header-actions"><SidebarToggle location="header" /><Link className="monitor-guide-link" href={`/monitoramento/guia?sistema=${app.id}`} title="Guia do endpoint de saúde, preenchido com os dados deste sistema">GUIA DO ENDPOINT</Link><Link className="text-link" href="/monitoramento">VOLTAR</Link><form action={checkMonitoredAppAction}><input type="hidden" name="id" value={app.id} /><input type="hidden" name="returnTo" value="detail" /><button className="primary-action" type="submit">VERIFICAR AGORA</button></form></div>
    </header>
    {feedback ? <p className={query.error ? "form-error" : "form-success"} role={query.error ? "alert" : "status"}>{feedback}</p> : null}
    <nav className="client-tabs monitor-tabs" aria-label="Seções do sistema">{TABS.map((item) => <Link key={item.id} href={item.id === "visao" ? `/monitoramento/${app.id}` : `/monitoramento/${app.id}?aba=${item.id}`} className={tab === item.id ? "active" : undefined} aria-current={tab === item.id ? "page" : undefined}>{item.label}</Link>)}</nav>
    {tab === "visao" ? <OverviewTab app={app} now={now} host={host} /> : null}
    {tab === "incidentes" ? <IncidentsTab appId={app.id} now={now} /> : null}
    {tab === "configuracao" ? <ConfigurationTab app={app} host={host} /> : null}
  </section></div></main>;
}

type App = NonNullable<Awaited<ReturnType<typeof getMonitoredApp>>>;

async function OverviewTab({ app, now, host }: { app: App; now: Date; host: string | null }) {
  const { uptime, series, recent } = await getMonitoringOverview(app.id, now);
  const ssl = expiry(app.sslExpiresAt, now);
  const domain = expiry(app.domainExpiresAt, now);
  const downFor = app.status === "DOWN" && app.lastIncidentAt ? formatDuration(now.getTime() - app.lastIncidentAt.getTime()) : null;
  return <>
    {downFor ? <p className="monitor-alert is-critical"><b>Fora do ar há {downFor}.</b> Você recebe um lembrete por e-mail a cada 6 horas enquanto continuar assim.</p> : app.status === "DEGRADED" ? <p className="monitor-alert is-warning"><b>Degradado.</b> {app.lastCheckSummary}</p> : null}
    <section className="monitor-facts" aria-label="Disponibilidade">
      <div><span>UPTIME 24 H</span><strong>{uptimeText(uptime.day.uptime)}</strong><small>{uptime.day.checks} verificações</small></div>
      <div><span>UPTIME 7 DIAS</span><strong>{uptimeText(uptime.week.uptime)}</strong><small>{uptime.week.checks} verificações</small></div>
      <div><span>UPTIME 30 DIAS</span><strong>{uptimeText(uptime.month.uptime)}</strong><small>{uptime.month.checks} verificações</small></div>
      <div><span>RESPOSTA MÉDIA 24 H</span><strong>{uptime.day.avgMs !== null ? `${uptime.day.avgMs} ms` : "—"}</strong><small>{app.lastResponseMs !== null ? `Última: ${app.lastResponseMs} ms` : "Sem verificações"}</small></div>
    </section>
    <section className="monitor-panel">
      <div className="monitor-panel-heading"><div><h2>Tempo de resposta · últimas 24 horas.</h2><p>Pontos amarelos: degradado. Pontos vermelhos no topo: fora do ar (sem resposta).</p></div><small>{app.nextCheckAt ? `Próxima verificação automática às ${time.format(app.nextCheckAt)}` : "Verificação automática a cada 5 minutos"}</small></div>
      <ResponseTimeChart points={series.map((point) => ({ checkedAt: point.checkedAt.toISOString(), responseMs: point.responseMs, status: point.status }))} now={now.toISOString()} />
    </section>
    <section className="monitor-facts monitor-facts-secondary" aria-label="Certificado, domínio e última verificação">
      <div><span>CERTIFICADO HTTPS</span>{app.sslError ? <strong className="is-critical">{app.sslError}</strong> : ssl ? <strong className={ssl.tone}>{ssl.label}</strong> : <strong className="is-muted">{app.url?.startsWith("https") || app.healthEndpoint?.startsWith("https") ? "Ainda não conferido" : "Sem HTTPS"}</strong>}<small>{app.sslExpiresAt ? `${day.format(app.sslExpiresAt)}${app.sslIssuer ? ` · ${app.sslIssuer}` : ""}` : host ?? ""}</small></div>
      <div><span>DOMÍNIO</span>{domain ? <strong className={domain.tone}>{domain.label}</strong> : <strong className="is-muted">{app.domainError ?? "Ainda não conferido"}</strong>}<small>{app.domainExpiresAt ? `${app.domainName ?? ""} · ${day.format(app.domainExpiresAt)}` : app.domainName ?? (host ? registrableDomain(host) ?? "Sem domínio" : "")}</small></div>
      <div className="monitor-facts-wide"><span>ÚLTIMA VERIFICAÇÃO</span><strong className="monitor-summary-text">{app.lastCheckSummary ?? "Ainda não verificado"}</strong><small>{app.lastCheckedAt ? date.format(app.lastCheckedAt) : "Use VERIFICAR AGORA ou aguarde a verificação automática"}</small></div>
    </section>
    <section className="monitor-panel">
      <div className="monitor-panel-heading"><div><h2>Verificações recentes.</h2><p>As 12 últimas, da mais nova para a mais antiga.</p></div></div>
      {recent.length ? <table className="monitor-table"><thead><tr><th>HORÁRIO</th><th>SITUAÇÃO</th><th>RESPOSTA</th><th>DETALHE</th></tr></thead><tbody>{recent.map((check) => <tr key={check.id}><td>{date.format(check.checkedAt)}</td><td><span className={`monitoring-status monitoring-status-${monitoringStatusClass[check.status]}`}><i />{monitoringStatusLabel[check.status]}</span></td><td>{check.responseMs} ms</td><td className="monitor-table-detail">{check.summary ?? "—"}</td></tr>)}</tbody></table> : <p className="monitor-chart-empty">Nenhuma verificação ainda.</p>}
    </section>
  </>;
}

async function IncidentsTab({ appId, now }: { appId: string; now: Date }) {
  const incidents = await listMonitoringIncidents(appId);
  return <section className="monitor-panel">
    <div className="monitor-panel-heading"><div><h2>Incidentes.</h2><p>Quedas e degradações, com início, fim e quanto duraram. Os 50 mais recentes.</p></div></div>
    {incidents.length ? <ol className="monitor-incidents">{incidents.map((incident) => {
      const ongoing = !incident.resolvedAt;
      const duration = formatDuration((incident.resolvedAt ?? now).getTime() - incident.occurredAt.getTime());
      return <li key={incident.id} className={incident.severity === "critical" ? "is-critical" : "is-warning"}>
        <i aria-hidden="true" />
        <div><b>{incident.severity === "critical" ? "Fora do ar" : "Degradado"}{ongoing ? " · em andamento" : ""}</b><small>{date.format(incident.occurredAt)}{incident.resolvedAt ? ` até ${date.format(incident.resolvedAt)}` : ""}</small>{incident.details ? <p>{incident.details}</p> : null}</div>
        <strong>{ongoing ? `há ${duration}` : duration}</strong>
      </li>;
    })}</ol> : <p className="monitor-chart-empty">Nenhum incidente registrado. Quando o sistema cair ou ficar degradado, o registro aparece aqui com a duração.</p>}
  </section>;
}

function ConfigurationTab({ app, host }: { app: App; host: string | null }) {
  return <>
    <form className="client-form" action={updateMonitoredApp}>
      <input type="hidden" name="id" value={app.id} />
      <section><p className="eyebrow">CLIENTE</p><ClientPicker label="Cliente associado" hint="Vincule o sistema ao cliente para vê-lo no perfil dele. Remova o vínculo para deixá-lo sem cliente." initialClient={app.client} /></section>
      <section><p className="eyebrow">IDENTIFICAÇÃO E ENDPOINTS</p><div className="form-grid">
        <label>Nome do sistema<input name="name" required maxLength={140} defaultValue={app.name} /></label>
        <label>Ambiente<select name="environment" defaultValue={app.environment}>{monitoringEnvironments.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label>URL principal<input name="url" type="url" maxLength={500} defaultValue={app.url ?? ""} placeholder="https://exemplo.com" /></label>
        <label>Endpoint de saúde<input name="healthEndpoint" type="url" maxLength={500} defaultValue={app.healthEndpoint ?? ""} placeholder="Opcional: https://exemplo.com/api/health" /></label>
        <label>Domínio registrado<input name="domainName" maxLength={253} defaultValue={app.domainName ?? ""} placeholder={host ? registrableDomain(host) ?? "cliente.com.br" : "cliente.com.br"} /><small className="form-hint">Usado no aviso de vencimento. Vazio: calculado a partir da URL.</small></label>
      </div></section>
      <div className="form-actions"><Link className="text-link" href={`/monitoramento/${app.id}`}>CANCELAR</Link><button className="primary-action" type="submit">SALVAR SISTEMA</button></div>
    </form>
    <section className="service-record-actions"><div><p className="eyebrow">GESTÃO DO REGISTRO</p><p>Ao remover, o sistema deixa de ser monitorado e o histórico de verificações é apagado. O cliente vinculado não é alterado.</p></div><DeleteMonitoredAppButton id={app.id} action={deleteMonitoredApp} /></section>
  </>;
}
