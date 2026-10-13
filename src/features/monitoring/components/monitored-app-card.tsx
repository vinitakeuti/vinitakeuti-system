import Link from "next/link";
import type { MonitoringStatus } from "@prisma/client";
import { checkMonitoredAppAction } from "@/features/monitoring/services/monitoring-actions";
import { monitoringEnvironmentLabel, monitoringStatusClass, monitoringStatusLabel } from "@/features/monitoring/types/monitoring-labels";

type MonitoredAppCardData = {
  id: string;
  name: string;
  url: string | null;
  healthEndpoint: string | null;
  environment: string;
  status: MonitoringStatus;
  lastCheckedAt: Date | null;
  lastResponseMs: number | null;
  lastIncidentAt: Date | null;
  client: { id: string; name: string; company: string | null } | null;
};

const fullDateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Maceio" });
const shortDateTime = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Maceio" });

function relativeTime(date: Date, now: Date) {
  const minutes = Math.max(0, Math.round((now.getTime() - date.getTime()) / 60_000));
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.round(hours / 24);
  return `há ${days} ${days === 1 ? "dia" : "dias"}`;
}

function hostOf(value: string) {
  try { return new URL(value).host; } catch { return value.replace(/^https?:\/\//i, "").split("/")[0]; }
}

function healthPath(health: string, base: string | null) {
  try {
    const url = new URL(health);
    return base && hostOf(base) === url.host ? `${url.pathname}${url.search}` : `${url.host}${url.pathname}`;
  } catch { return health; }
}

/** Cartão de um sistema: identidade e status no topo, três números da última verificação e um rodapé com cliente e ações. */
export function MonitoredAppCard({ app, incidents30d, now, filterClientId }: { app: MonitoredAppCardData; incidents30d: number; now: Date; filterClientId?: string }) {
  const statusKey = monitoringStatusClass[app.status];
  const primaryUrl = app.url ?? app.healthEndpoint;

  return <article className={`monitor-card monitor-card-${statusKey}`} aria-labelledby={`monitor-${app.id}`}>
    <div className="monitor-card-main">
      <div className="monitor-card-meta">
        <span className={`monitoring-status monitoring-status-${statusKey}`}><i aria-hidden="true" />{monitoringStatusLabel[app.status]}</span>
        <span className="monitor-env">{monitoringEnvironmentLabel(app.environment)}</span>
      </div>
      <h3 id={`monitor-${app.id}`}><Link href={`/monitoramento/${app.id}`}>{app.name}</Link></h3>
      {primaryUrl ? <a className="monitor-url" href={primaryUrl} target="_blank" rel="noopener noreferrer" title={`Abrir ${primaryUrl} em nova aba`}>{hostOf(primaryUrl)}</a> : <span className="monitor-url is-missing">Endpoint não configurado</span>}
      {app.healthEndpoint && app.url ? <small className="monitor-health" title={app.healthEndpoint}>Saúde em {healthPath(app.healthEndpoint, app.url)}</small> : null}
      <dl className="monitor-figures">
        <div><dt>Resposta</dt><dd>{app.lastResponseMs !== null ? <>{app.lastResponseMs.toLocaleString("pt-BR")}<small>ms</small></> : <span className="is-empty">—</span>}</dd></div>
        <div><dt>Verificado</dt><dd title={app.lastCheckedAt ? fullDateTime.format(app.lastCheckedAt) : undefined}>{app.lastCheckedAt ? relativeTime(app.lastCheckedAt, now) : <span className="is-empty">nunca</span>}</dd></div>
        <div className={incidents30d ? "has-incidents" : undefined}><dt>Incidentes 30d</dt><dd title={app.lastIncidentAt ? `Última indisponibilidade em ${fullDateTime.format(app.lastIncidentAt)}` : undefined}>{incidents30d}{incidents30d && app.lastIncidentAt ? <small>último {shortDateTime.format(app.lastIncidentAt)}</small> : null}</dd></div>
      </dl>
    </div>
    <footer className="monitor-card-foot">
      <div className="monitor-client">{app.client ? <Link href={`/monitoramento?cliente=${app.client.id}`} title="Ver sistemas deste cliente"><b>{app.client.name}</b>{app.client.company ? <span>{app.client.company}</span> : null}</Link> : <span className="is-empty">Sem cliente</span>}</div>
      <div className="monitor-card-actions">
        <Link className="monitor-text-action" href={`/monitoramento/${app.id}`}>EDITAR</Link>
        <form action={checkMonitoredAppAction}><input type="hidden" name="id" value={app.id} />{filterClientId ? <input type="hidden" name="filterClientId" value={filterClientId} /> : null}<button className="monitor-check" type="submit">VERIFICAR</button></form>
      </div>
    </footer>
  </article>;
}
