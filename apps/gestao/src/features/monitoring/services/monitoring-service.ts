import { MonitoringEventType, MonitoringStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { monitoringRules } from "@/lib/monitoring";
import { formatDuration, sendMonitoringEmail } from "@/features/monitoring/services/monitoring-alerts";

type CheckResult = {
  status: MonitoringStatus;
  responseMs: number;
  statusCode?: number;
  details?: string;
  report?: HealthReport | null;
};

/** Relatório no formato do guia de integração (Monitoramento > Guia para o endpoint de saúde). */
type HealthCheck = { status?: unknown; latencyMs?: unknown; message?: unknown };
type HealthReport = { status?: unknown; version?: unknown; service?: unknown; checks?: Record<string, HealthCheck> };

function endpointFor(app: { url: string | null; healthEndpoint: string | null }) {
  const endpoint = app.healthEndpoint ?? app.url;
  if (!endpoint) throw new Error("Cadastre uma URL ou endpoint de saúde antes de verificar.");
  return endpoint;
}

function reportStatus(value: unknown) {
  const text = typeof value === "string" ? value.toLowerCase() : "";
  if (text === "ok" || text === "pass" || text === "up" || text === "healthy") return MonitoringStatus.OPERATIONAL;
  if (text === "degraded" || text === "warn" || text === "warning") return MonitoringStatus.DEGRADED;
  if (text === "down" || text === "fail" || text === "error" || text === "unhealthy") return MonitoringStatus.DOWN;
  return null;
}

const RANK = { [MonitoringStatus.OPERATIONAL]: 0, [MonitoringStatus.UNKNOWN]: 0, [MonitoringStatus.DEGRADED]: 1, [MonitoringStatus.DOWN]: 2 } as const;
const worst = (left: MonitoringStatus, right: MonitoringStatus) => RANK[right] > RANK[left] ? right : left;

async function readReport(response: Response): Promise<HealthReport | null> {
  if (!(response.headers.get("content-type") ?? "").includes("json")) return null;
  try {
    const body = await response.json() as unknown;
    return body && typeof body === "object" && !Array.isArray(body) ? body as HealthReport : null;
  } catch { return null; }
}

/** Texto curto da verificação: "HTTP 200 · 142 ms · database ok 12 ms · cache ok 3 ms · v1.4.2". */
function summarize(result: { statusCode?: number; responseMs: number; report?: HealthReport | null; note?: string | null }) {
  const checks = result.report?.checks && typeof result.report.checks === "object" ? Object.entries(result.report.checks).slice(0, 8).map(([name, check]) => `${name.slice(0, 30)} ${typeof check?.status === "string" ? check.status.slice(0, 12) : "?"}${typeof check?.latencyMs === "number" ? ` ${Math.round(check.latencyMs)} ms` : ""}`) : [];
  const version = typeof result.report?.version === "string" ? `v${result.report.version.replace(/^v/, "").slice(0, 20)}` : null;
  return [result.statusCode ? `HTTP ${result.statusCode}` : null, `${result.responseMs} ms`, ...checks, version, result.note].filter(Boolean).join(" · ").slice(0, 500);
}

const CONNECTION_ERRORS: Record<string, string> = {
  ENOTFOUND: "domínio não encontrado (DNS)",
  EAI_AGAIN: "falha temporária de DNS",
  ECONNREFUSED: "conexão recusada pelo servidor",
  ECONNRESET: "conexão interrompida pelo servidor",
  EHOSTUNREACH: "servidor inalcançável",
  ETIMEDOUT: "tempo de conexão esgotado",
  UND_ERR_CONNECT_TIMEOUT: "tempo de conexão esgotado",
  CERT_HAS_EXPIRED: "certificado HTTPS vencido",
  ERR_TLS_CERT_ALTNAME_INVALID: "certificado HTTPS de outro domínio",
  DEPTH_ZERO_SELF_SIGNED_CERT: "certificado HTTPS autoassinado",
  SELF_SIGNED_CERT_IN_CHAIN: "certificado HTTPS autoassinado",
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: "cadeia do certificado HTTPS incompleta",
  ERR_SSL_WRONG_VERSION_NUMBER: "o endereço não responde HTTPS nesta porta",
};

/** Motivo legível de uma falha de conexão ("fetch failed" esconde a causa real em error.cause). */
function describeConnectionError(error: unknown) {
  if (!(error instanceof Error)) return "falha ao conectar ao endpoint";
  if (error.name === "TimeoutError") return `sem resposta em ${monitoringRules.timeoutMs / 1000} s`;
  const cause = (error as Error & { cause?: { code?: string; message?: string } }).cause;
  if (cause?.code && CONNECTION_ERRORS[cause.code]) return CONNECTION_ERRORS[cause.code];
  return (cause?.code ? `${cause.code}${cause.message ? `: ${cause.message}` : ""}` : error.message).slice(0, 200);
}

/**
 * Verifica o endpoint. Com o relatório do guia, o status vem do campo "status" e das dependências em "checks";
 * sem ele (sistemas antigos), vale o código HTTP. Respostas saudáveis mais lentas que o limite contam como degradadas.
 */
async function checkEndpoint(endpoint: string): Promise<CheckResult> {
  const startedAt = Date.now();
  try {
    const response = await fetch(endpoint, {
      cache: "no-store",
      headers: { accept: "application/json, text/plain;q=0.8, */*;q=0.5", "user-agent": "VR-Gestao-Monitor/1.0" },
      signal: AbortSignal.timeout(monitoringRules.timeoutMs),
    });
    const report = await readReport(response);
    const responseMs = Date.now() - startedAt;
    let status: MonitoringStatus = response.ok ? MonitoringStatus.OPERATIONAL : response.status >= 500 ? MonitoringStatus.DOWN : MonitoringStatus.DEGRADED;
    let note: string | null = !response.ok && response.status < 500 ? "confira o endereço do endpoint" : null;
    const declared = reportStatus(report?.status);
    if (declared && (response.ok || response.status === 503)) status = declared;
    // Uma dependência fora do ar não pode passar como "ok".
    if (report?.checks && typeof report.checks === "object") {
      for (const check of Object.values(report.checks)) {
        const checkStatus = reportStatus(check?.status);
        if (checkStatus === MonitoringStatus.DOWN) status = worst(status, MonitoringStatus.DEGRADED);
        else if (checkStatus) status = worst(status, checkStatus);
      }
    }
    if (status === MonitoringStatus.OPERATIONAL && responseMs > monitoringRules.slowResponseMs) {
      status = MonitoringStatus.DEGRADED;
      note = `resposta acima de ${monitoringRules.slowResponseMs} ms`;
    }
    if (response.ok && !report) note = "sem relatório de dependências";
    return { status, responseMs, statusCode: response.status, report, details: summarize({ statusCode: response.status, responseMs, report, note }) };
  } catch (error) {
    const responseMs = Date.now() - startedAt;
    const reason = describeConnectionError(error);
    return { status: MonitoringStatus.DOWN, responseMs, details: `${responseMs} ms · ${reason}` };
  }
}

function eventSeverity(status: MonitoringStatus) {
  return status === MonitoringStatus.OPERATIONAL ? "info" : status === MonitoringStatus.DEGRADED ? "warning" : "critical";
}

function eventTitle(status: MonitoringStatus) {
  return status === MonitoringStatus.OPERATIONAL ? "Monitoramento normalizado" : status === MonitoringStatus.DEGRADED ? "Resposta degradada detectada" : "Aplicação indisponível";
}

const CONFIRMATION_DELAY_MS = 15_000;

/**
 * Verifica um sistema, grava a verificação no histórico e trata mudanças de status: abre e fecha incidentes
 * (com a duração) e envia os e-mails de "fora do ar" e "voltou". Com `confirmFailures` (verificação automática),
 * uma queda só é declarada depois de uma segunda tentativa, para evitar alarme falso por oscilação de rede.
 */
export async function checkMonitoredApp(id: string, { confirmFailures = false } = {}) {
  const app = await prisma.monitoredApp.findUnique({
    where: { id },
    select: { id: true, name: true, url: true, healthEndpoint: true, status: true },
  });
  if (!app) throw new Error("Aplicação monitorada não encontrada.");

  const endpoint = endpointFor(app);
  let result = await checkEndpoint(endpoint);
  if (confirmFailures && result.status === MonitoringStatus.DOWN && app.status !== MonitoringStatus.DOWN) {
    await new Promise((resolve) => setTimeout(resolve, CONFIRMATION_DELAY_MS));
    result = await checkEndpoint(endpoint);
  }
  const now = new Date();
  const changed = app.status !== result.status;
  const metadata = { statusCode: result.statusCode ?? null, responseMs: result.responseMs, checks: (result.report?.checks ?? null) as object | null, version: typeof result.report?.version === "string" ? result.report.version : null };

  const transition = await prisma.$transaction(async (transaction) => {
    await transaction.monitoringCheck.create({ data: { monitoredAppId: app.id, status: result.status, responseMs: result.responseMs, statusCode: result.statusCode ?? null, summary: result.details ?? null, checkedAt: now } });
    await transaction.monitoredApp.update({
      where: { id: app.id },
      data: {
        status: result.status,
        lastCheckedAt: now,
        lastResponseMs: result.responseMs,
        lastCheckSummary: result.details ?? null,
        ...(result.status === MonitoringStatus.DOWN && app.status !== MonitoringStatus.DOWN ? { lastIncidentAt: now } : {}),
      },
    });
    if (!changed) return null;

    // Fecha o incidente em aberto (queda ou degradação) e mede quanto durou.
    const open = await transaction.monitoringEvent.findFirst({ where: { monitoredAppId: app.id, type: MonitoringEventType.UPTIME, resolvedAt: null, severity: { not: "info" } }, orderBy: { occurredAt: "asc" }, select: { occurredAt: true } });
    await transaction.monitoringEvent.updateMany({ where: { monitoredAppId: app.id, type: MonitoringEventType.UPTIME, resolvedAt: null }, data: { resolvedAt: now } });
    const durationMs = open ? now.getTime() - open.occurredAt.getTime() : null;

    // A primeira verificação de um sistema novo (status desconhecido) não é "normalização".
    if (result.status !== MonitoringStatus.OPERATIONAL || app.status !== MonitoringStatus.UNKNOWN) {
      await transaction.monitoringEvent.create({
        data: {
          monitoredAppId: app.id,
          type: MonitoringEventType.UPTIME,
          severity: eventSeverity(result.status),
          title: eventTitle(result.status),
          details: [result.details, durationMs !== null && result.status === MonitoringStatus.OPERATIONAL ? `${app.status === MonitoringStatus.DOWN ? "fora do ar" : "degradado"} por ${formatDuration(durationMs)}` : null].filter(Boolean).join(" · ") || null,
          metadata: { ...metadata, previousStatus: app.status, durationMs },
          occurredAt: now,
          ...(result.status === MonitoringStatus.OPERATIONAL ? { resolvedAt: now } : {}),
        },
      });
    }
    return { from: app.status, to: result.status, durationMs };
  });

  if (transition) await alertTransition(app, transition, result.details ?? null);
  return result;
}

/** E-mail de queda (na hora) e de volta (com o tempo fora do ar). Degradações aparecem no resumo diário. */
async function alertTransition(app: { id: string; name: string; url: string | null }, transition: { from: MonitoringStatus; to: MonitoringStatus; durationMs: number | null }, details: string | null) {
  const path = `/monitoramento/${app.id}`;
  if (transition.to === MonitoringStatus.DOWN) {
    // O lembrete (a cada 6 h enquanto continuar fora) conta a partir desta tentativa de aviso.
    await sendMonitoringEmail({ critical: true, subject: `Fora do ar: ${app.name}`, title: `${app.name} está fora do ar.`, lines: [app.url ? `Endereço: ${app.url}` : "", details ? `Última verificação: ${details}` : "", "A queda foi confirmada em duas tentativas. Você recebe outro aviso quando o sistema voltar."].filter(Boolean), path });
    await prisma.monitoredApp.update({ where: { id: app.id }, data: { lastAlertAt: new Date() } });
  } else if (transition.from === MonitoringStatus.DOWN) {
    await sendMonitoringEmail({ subject: `Voltou: ${app.name}${transition.durationMs !== null ? ` (fora por ${formatDuration(transition.durationMs)})` : ""}`, title: `${app.name} voltou a responder.`, lines: [transition.durationMs !== null ? `Ficou fora do ar por ${formatDuration(transition.durationMs)}.` : "", details ? `Verificação: ${details}` : "", transition.to === MonitoringStatus.DEGRADED ? "Atenção: voltou, mas ainda está degradado." : ""].filter(Boolean), path });
    await prisma.monitoredApp.update({ where: { id: app.id }, data: { lastAlertAt: null } });
  }
}
