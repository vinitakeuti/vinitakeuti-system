import { MonitoringEventType, MonitoringStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { monitoringRules } from "@/lib/monitoring";

type CheckResult = {
  status: MonitoringStatus;
  responseMs: number;
  statusCode?: number;
  details?: string;
};

function endpointFor(app: { url: string | null; healthEndpoint: string | null }) {
  const endpoint = app.healthEndpoint ?? app.url;
  if (!endpoint) throw new Error("Cadastre uma URL ou endpoint de saúde antes de verificar.");
  return endpoint;
}

async function checkEndpoint(endpoint: string): Promise<CheckResult> {
  const startedAt = Date.now();
  try {
    const response = await fetch(endpoint, {
      cache: "no-store",
      headers: { accept: "application/json, text/plain;q=0.8, */*;q=0.5", "user-agent": "VR-Gestao-Monitor/1.0" },
      signal: AbortSignal.timeout(monitoringRules.timeoutMs),
    });
    const responseMs = Date.now() - startedAt;
    const status = response.ok ? MonitoringStatus.OPERATIONAL : response.status >= 500 ? MonitoringStatus.DOWN : MonitoringStatus.DEGRADED;
    return { status, responseMs, statusCode: response.status, details: `HTTP ${response.status}` };
  } catch (error) {
    return { status: MonitoringStatus.DOWN, responseMs: Date.now() - startedAt, details: error instanceof Error ? error.message.slice(0, 240) : "Falha ao conectar ao endpoint." };
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
        details: [result.details, `${result.responseMs} ms`].filter(Boolean).join(" · "),
        metadata: { statusCode: result.statusCode, responseMs: result.responseMs },
        occurredAt: now,
      },
    });
  });

  return result;
}
