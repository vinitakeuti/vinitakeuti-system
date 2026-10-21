import { MonitoringEventType, MonitoringStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { monitoringRules } from "@/lib/monitoring";
import { logEvent } from "@/features/system-logs/services/system-log";
import { uptimeByApp } from "@/features/monitoring/queries/monitoring-queries";
import { checkMonitoredApp } from "@/features/monitoring/services/monitoring-service";
import { checkCertificate } from "@/features/monitoring/services/certificate-check";
import { checkDomainExpiration, registrableDomain } from "@/features/monitoring/services/domain-check";
import { formatDuration, sendMonitoringEmail } from "@/features/monitoring/services/monitoring-alerts";
import { runAsaasCycle } from "@/features/integrations/services/asaas-scheduler";

const TICK_MS = 60_000;
const CONCURRENCY = 4;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const REMINDER_EVERY_MS = 6 * HOUR;
const CERTIFICATE_EVERY_MS = 12 * HOUR;
const DOMAIN_EVERY_MS = DAY;
const SUMMARY_HOUR = 8;
const RETENTION_DAYS = 90;
const EXPIRY_THRESHOLDS = [1, 7, 30];

const isoDay = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Maceio" });
const hourOf = (date: Date) => Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: "America/Maceio" }).format(date));
const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Maceio" });

/** Inicia o ciclo do monitoramento (uma vez por processo). Chamado pelo instrumentation.ts quando o servidor sobe. */
export function startMonitoringScheduler() {
  const holder = globalThis as typeof globalThis & { __vrMonitoringScheduler?: ReturnType<typeof setInterval> };
  if (holder.__vrMonitoringScheduler) return;
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await runMonitoringCycle(); }
    catch (error) { await logEvent({ source: "sistema", level: "error", event: "monitoring.scheduler.failed", message: `Falha no ciclo do monitoramento: ${error instanceof Error ? error.message : String(error)}`.slice(0, 500) }); }
    // O mesmo ciclo cuida dos pagamentos do Asaas (eventos que falharam e sincronização a cada 30 minutos).
    try { await runAsaasCycle(); }
    catch (error) { await logEvent({ source: "sistema", level: "error", event: "asaas.scheduler.failed", message: `Falha no ciclo do Asaas: ${error instanceof Error ? error.message : String(error)}`.slice(0, 500) }); }
    finally { running = false; }
  };
  holder.__vrMonitoringScheduler = setInterval(tick, TICK_MS);
  holder.__vrMonitoringScheduler.unref?.();
  setTimeout(tick, 20_000).unref?.();
}

export async function runMonitoringCycle(now = new Date()) {
  await checkDueApps(now);
  await sendDownReminders(now);
  await checkCertificatesAndDomains(now);
  await runDailyTasks(now);
}

/** Executa tarefas com no máximo `CONCURRENCY` ao mesmo tempo. */
async function inPool<T>(items: T[], run: (item: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) await run(item);
  }));
}

/** Sistemas cuja verificação chegou: cada um é reservado (avançando nextCheckAt) antes de ser verificado. */
async function checkDueApps(now: Date) {
  const due = await prisma.monitoredApp.findMany({
    where: { OR: [{ healthEndpoint: { not: null } }, { url: { not: null } }], AND: [{ OR: [{ nextCheckAt: null }, { nextCheckAt: { lte: now } }] }] },
    orderBy: [{ nextCheckAt: { sort: "asc", nulls: "first" } }, { id: "asc" }],
    take: 50,
    select: { id: true, name: true },
  });
  const next = new Date(now.getTime() + monitoringRules.intervalMinutes * 60_000);
  await inPool(due, async (app) => {
    const claimed = await prisma.monitoredApp.updateMany({ where: { id: app.id, OR: [{ nextCheckAt: null }, { nextCheckAt: { lte: now } }] }, data: { nextCheckAt: next } });
    if (!claimed.count) return;
    try { await checkMonitoredApp(app.id, { confirmFailures: true }); }
    catch (error) { await logEvent({ source: "sistema", level: "error", event: "monitoring.check.failed", message: `Não foi possível verificar ${app.name}: ${error instanceof Error ? error.message : String(error)}`.slice(0, 500) }); }
  });
}

/** Enquanto um sistema continuar fora do ar, um lembrete a cada 6 horas. */
async function sendDownReminders(now: Date) {
  const threshold = new Date(now.getTime() - REMINDER_EVERY_MS);
  const down = await prisma.monitoredApp.findMany({ where: { status: MonitoringStatus.DOWN, lastAlertAt: { lte: threshold } }, take: 20, select: { id: true, name: true, url: true, lastIncidentAt: true, lastCheckSummary: true } });
  for (const app of down) {
    const claimed = await prisma.monitoredApp.updateMany({ where: { id: app.id, status: MonitoringStatus.DOWN, lastAlertAt: { lte: threshold } }, data: { lastAlertAt: now } });
    if (!claimed.count) continue;
    const since = app.lastIncidentAt ? formatDuration(now.getTime() - app.lastIncidentAt.getTime()) : null;
    await sendMonitoringEmail({ critical: true, subject: `Ainda fora do ar: ${app.name}${since ? ` (há ${since})` : ""}`, title: `${app.name} continua fora do ar.`, lines: [since ? `Fora do ar há ${since}.` : "", app.url ? `Endereço: ${app.url}` : "", app.lastCheckSummary ? `Última verificação: ${app.lastCheckSummary}` : ""].filter(Boolean), path: `/monitoramento/${app.id}` });
  }
}

/** Aviso de vencimento: só quando cruza um novo limite (30, 7 ou 1 dia), para não repetir. */
function expiryThreshold(daysLeft: number) {
  return EXPIRY_THRESHOLDS.find((threshold) => daysLeft <= threshold) ?? null;
}

async function checkCertificatesAndDomains(now: Date) {
  const apps = await prisma.monitoredApp.findMany({
    where: { OR: [{ sslCheckedAt: null }, { sslCheckedAt: { lte: new Date(now.getTime() - CERTIFICATE_EVERY_MS) } }, { domainCheckedAt: null }, { domainCheckedAt: { lte: new Date(now.getTime() - DOMAIN_EVERY_MS) } }], AND: [{ OR: [{ url: { not: null } }, { healthEndpoint: { not: null } }] }] },
    take: 20,
    select: { id: true, name: true, url: true, healthEndpoint: true, domainName: true, sslCheckedAt: true, sslAlertedDays: true, domainCheckedAt: true, domainAlertedDays: true },
  });
  await inPool(apps, async (app) => {
    try { await checkAppExpirations(app, now); }
    catch (error) { await logEvent({ source: "sistema", level: "error", event: "monitoring.expiry.failed", message: `Falha ao conferir certificado e domínio de ${app.name}: ${error instanceof Error ? error.message : String(error)}`.slice(0, 500) }); }
  });
}

type ExpiryApp = { id: string; name: string; url: string | null; healthEndpoint: string | null; domainName: string | null; sslCheckedAt: Date | null; sslAlertedDays: number | null; domainCheckedAt: Date | null; domainAlertedDays: number | null };

/** Certificado HTTPS (a cada 12 h) e vencimento do domínio (a cada 24 h) de um sistema, com os avisos de vencimento. */
async function checkAppExpirations(app: ExpiryApp, now: Date) {
  let host: URL;
  try { host = new URL(app.url ?? app.healthEndpoint!); } catch { return; }
  const path = `/monitoramento/${app.id}`;

  if (!app.sslCheckedAt || app.sslCheckedAt.getTime() <= now.getTime() - CERTIFICATE_EVERY_MS) {
    const claimed = await prisma.monitoredApp.updateMany({ where: { id: app.id, OR: [{ sslCheckedAt: null }, { sslCheckedAt: { lte: new Date(now.getTime() - CERTIFICATE_EVERY_MS) } }] }, data: { sslCheckedAt: now } });
    if (claimed.count && host.protocol === "https:") {
      const certificate = await checkCertificate(host.hostname, Number(host.port) || 443);
      const daysLeft = certificate.expiresAt ? Math.floor((certificate.expiresAt.getTime() - now.getTime()) / DAY) : null;
      const threshold = daysLeft !== null ? expiryThreshold(daysLeft) : null;
      const alert = threshold !== null && (app.sslAlertedDays === null || threshold < app.sslAlertedDays);
      await prisma.monitoredApp.update({ where: { id: app.id }, data: { sslExpiresAt: certificate.expiresAt, sslIssuer: certificate.issuer, sslError: certificate.error, sslAlertedDays: threshold === null ? null : alert ? threshold : app.sslAlertedDays } });
      if (alert && certificate.expiresAt && daysLeft !== null) await sendMonitoringEmail({ critical: daysLeft <= 7, subject: daysLeft < 0 ? `Certificado HTTPS vencido: ${app.name}` : `Certificado HTTPS vence em ${Math.max(daysLeft, 0)} ${daysLeft === 1 ? "dia" : "dias"}: ${app.name}`, title: `Certificado HTTPS de ${app.name}.`, lines: [`Domínio: ${host.hostname}`, `Vence em ${shortDate.format(certificate.expiresAt)}${certificate.issuer ? ` (emitido por ${certificate.issuer})` : ""}.`, "Se a renovação é automática (Let's Encrypt), confira se ela está funcionando no servidor."], path });
    }
  }

  if (!app.domainCheckedAt || app.domainCheckedAt.getTime() <= now.getTime() - DOMAIN_EVERY_MS) {
    const domain = app.domainName ?? registrableDomain(host.hostname);
    const claimed = await prisma.monitoredApp.updateMany({ where: { id: app.id, OR: [{ domainCheckedAt: null }, { domainCheckedAt: { lte: new Date(now.getTime() - DOMAIN_EVERY_MS) } }] }, data: { domainCheckedAt: now } });
    if (claimed.count && domain) {
      const result = await checkDomainExpiration(domain);
      const daysLeft = result.expiresAt ? Math.floor((result.expiresAt.getTime() - now.getTime()) / DAY) : null;
      const threshold = daysLeft !== null ? expiryThreshold(daysLeft) : null;
      const alert = threshold !== null && (app.domainAlertedDays === null || threshold < app.domainAlertedDays);
      await prisma.monitoredApp.update({ where: { id: app.id }, data: { domainName: app.domainName ?? domain, domainExpiresAt: result.expiresAt, domainError: result.error, domainAlertedDays: threshold === null ? null : alert ? threshold : app.domainAlertedDays } });
      if (alert && result.expiresAt && daysLeft !== null) await sendMonitoringEmail({ critical: daysLeft <= 7, subject: daysLeft < 0 ? `Domínio vencido: ${domain}` : `Domínio vence em ${Math.max(daysLeft, 0)} ${daysLeft === 1 ? "dia" : "dias"}: ${domain}`, title: `Domínio de ${app.name}.`, lines: [`Domínio: ${domain}`, `Vence em ${shortDate.format(result.expiresAt)}.`, "A renovação é feita onde o domínio foi registrado (Registro.br, GoDaddy, Hostinger...). Avise o cliente se o domínio for dele."], path });
    }
  }
}

/** Reserva uma tarefa diária: só uma instância a executa por dia. */
async function claimDaily(key: string, day: string) {
  const updated = await prisma.schedulerState.updateMany({ where: { key, value: { not: day } }, data: { value: day } });
  if (updated.count) return true;
  try { await prisma.schedulerState.create({ data: { key, value: day } }); return true; } catch { return false; }
}

async function runDailyTasks(now: Date) {
  const today = isoDay.format(now);
  if (await claimDaily("monitoring-retention", today)) {
    const removed = await prisma.monitoringCheck.deleteMany({ where: { checkedAt: { lt: new Date(now.getTime() - RETENTION_DAYS * DAY) } } });
    if (removed.count) await logEvent({ source: "sistema", event: "monitoring.retention", message: `${removed.count} verificações com mais de ${RETENTION_DAYS} dias removidas.` });
  }
  if (hourOf(now) >= SUMMARY_HOUR && await claimDaily("monitoring-daily-summary", today)) await sendDailySummary(now);
}

/** Resumo diário: o que pede atenção primeiro, depois quantos sistemas estão bem. */
export async function sendDailySummary(now = new Date()) {
  const apps = await prisma.monitoredApp.findMany({ take: 200, orderBy: { name: "asc" }, select: { id: true, name: true, status: true, sslExpiresAt: true, sslError: true, domainName: true, domainExpiresAt: true, lastCheckSummary: true, client: { select: { name: true } } } });
  if (!apps.length) return false;
  const since = new Date(now.getTime() - DAY);
  const [uptime, incidents] = await Promise.all([
    uptimeByApp(apps.map((app) => app.id), since),
    prisma.monitoringEvent.groupBy({ by: ["monitoredAppId"], where: { monitoredAppId: { in: apps.map((app) => app.id) }, type: MonitoringEventType.UPTIME, severity: { not: "info" }, occurredAt: { gte: since } }, _count: { _all: true } }),
  ]);
  const statusLabel = { OPERATIONAL: "Operacional", DEGRADED: "Degradado", DOWN: "Fora do ar", UNKNOWN: "Não verificado" } as const;
  const daysUntil = (date: Date | null) => date ? Math.floor((date.getTime() - now.getTime()) / DAY) : null;
  const attention: string[] = [];
  let healthy = 0;
  for (const app of apps) {
    const issues: string[] = [];
    if (app.status === MonitoringStatus.DOWN || app.status === MonitoringStatus.DEGRADED) issues.push(statusLabel[app.status]);
    const incidentCount = incidents.find((item) => item.monitoredAppId === app.id)?._count._all ?? 0;
    if (incidentCount) issues.push(`${incidentCount} ${incidentCount === 1 ? "incidente" : "incidentes"} em 24 h`);
    const sslDays = daysUntil(app.sslExpiresAt);
    if (app.sslError) issues.push(`certificado: ${app.sslError}`);
    else if (sslDays !== null && sslDays <= 30) issues.push(`certificado vence em ${sslDays} dias`);
    const domainDays = daysUntil(app.domainExpiresAt);
    if (domainDays !== null && domainDays <= 30) issues.push(`domínio ${app.domainName} vence em ${domainDays} dias`);
    const stats = uptime.get(app.id);
    if (issues.length) attention.push(`${app.name}${app.client ? ` (${app.client.name})` : ""}: ${issues.join(" · ")}${stats?.uptime !== null && stats?.uptime !== undefined ? ` · uptime 24 h ${stats.uptime.toFixed(2).replace(".", ",")}%` : ""}`);
    else healthy += 1;
  }
  const subject = `Resumo do monitoramento · ${shortDate.format(now).slice(0, 5)} · ${attention.length ? `${attention.length} ${attention.length === 1 ? "pede" : "pedem"} atenção` : "tudo certo"}`;
  await sendMonitoringEmail({ subject, title: attention.length ? `${attention.length} de ${apps.length} sistemas pedem atenção.` : `Todos os ${apps.length} sistemas estão bem.`, lines: [...attention, healthy ? `${healthy} ${healthy === 1 ? "sistema sem pendências" : "sistemas sem pendências"}.` : ""].filter(Boolean), path: "/monitoramento" });
  return true;
}
