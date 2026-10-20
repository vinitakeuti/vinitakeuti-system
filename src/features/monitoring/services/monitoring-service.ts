import { MonitoringEventType, MonitoringStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { monitoringRules } from "@/lib/monitoring";

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
    const reason = error instanceof Error ? (error.name === "TimeoutError" ? `sem resposta em ${monitoringRules.timeoutMs / 1000} s` : error.message.slice(0, 200)) : "falha ao conectar ao endpoint";
    return { status: MonitoringStatus.DOWN, responseMs, details: `${responseMs} ms · ${reason}` };
  }
}

function eventSeverity(status: MonitoringStatus) {
  return status === MonitoringStatus.OPERATIONAL ? "info" : status === MonitoringStatus.DEGRADED ? "warning" : "critical";
}

function eventTitle(status: MonitoringStatus) {
  return status === MonitoringStatus.OPERATIONAL ? "Monitoramento normalizado" : status === MonitoringStatus.DEGRADED ? "Resposta degradada detectada" : "Aplicação indisponível";
}

export async function checkMonitoredApp(id: string) {
  const app = await prisma.monitoredApp.findUnique({
    where: { id },
    select: { id: true, name: true, url: true, healthEndpoint: true, status: true },
  });
  if (!app) throw new Error("Aplicação monitorada não encontrada.");

  const result = await checkEndpoint(endpointFor(app));
  const now = new Date();
  const changed = app.status !== result.status;

  await prisma.$transaction(async (transaction) => {
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

    if (!changed) return;

    if (result.status === MonitoringStatus.OPERATIONAL) {
      await transaction.monitoringEvent.updateMany({
        where: { monitoredAppId: app.id, type: MonitoringEventType.UPTIME, resolvedAt: null },
        data: { resolvedAt: now },
      });
    }

    await transaction.monitoringEvent.create({
      data: {
        monitoredAppId: app.id,
        type: MonitoringEventType.UPTIME,
        severity: eventSeverity(result.status),
        title: eventTitle(result.status),
        details: result.details ?? null,
        metadata: { statusCode: result.statusCode ?? null, responseMs: result.responseMs, checks: (result.report?.checks ?? null) as object | null, version: typeof result.report?.version === "string" ? result.report.version : null },
        occurredAt: now,
      },
    });
  });

  return result;
}
