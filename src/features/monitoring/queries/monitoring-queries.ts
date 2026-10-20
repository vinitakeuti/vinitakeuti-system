import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 50;

export async function listMonitoredApps(input: { cursor?: string; clientId?: string } = {}) {
  const cursor = input.cursor?.slice(0, 50);
  const clientId = input.clientId?.slice(0, 50);
  const rows = await prisma.monitoredApp.findMany({
    ...(clientId ? { where: { clientId } } : {}),
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      name: true,
      url: true,
      healthEndpoint: true,
      environment: true,
      status: true,
      lastCheckedAt: true,
      lastResponseMs: true,
      lastIncidentAt: true,
      lastCheckSummary: true,
      sslExpiresAt: true,
      sslError: true,
      domainName: true,
      domainExpiresAt: true,
      client: { select: { id: true, name: true, company: true } },
    },
  });
  const hasMore = rows.length > PAGE_SIZE;
  const data = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  return { data, nextCursor: hasMore ? data.at(-1)?.id ?? null : null };
}

/** Incidentes críticos dos últimos 30 dias para os sistemas exibidos, em uma única consulta agrupada. */
export async function countRecentIncidents(appIds: string[], since: Date) {
  if (!appIds.length) return new Map<string, number>();
  const groups = await prisma.monitoringEvent.groupBy({
    by: ["monitoredAppId"],
    where: { monitoredAppId: { in: appIds.slice(0, 50) }, severity: "critical", occurredAt: { gte: since } },
    _count: { _all: true },
  });
  return new Map(groups.map((group) => [group.monitoredAppId, group._count._all]));
}

/** Contagem por status para a faixa de resumo; respeita o filtro de cliente. */
export async function getMonitoringSummary(clientId?: string) {
  const groups = await prisma.monitoredApp.groupBy({ by: ["status"], ...(clientId ? { where: { clientId } } : {}), _count: { _all: true } });
  const count = (status: string) => groups.find((group) => group.status === status)?._count._all ?? 0;
  return { total: groups.reduce((sum, group) => sum + group._count._all, 0), operational: count("OPERATIONAL"), degraded: count("DEGRADED"), down: count("DOWN"), unknown: count("UNKNOWN") };
}

export async function getMonitoredApp(id: string) {
  return prisma.monitoredApp.findUnique({
    where: { id },
    select: { id: true, name: true, url: true, healthEndpoint: true, environment: true, status: true, lastCheckedAt: true, lastResponseMs: true, lastCheckSummary: true, lastIncidentAt: true, nextCheckAt: true, sslExpiresAt: true, sslIssuer: true, sslCheckedAt: true, sslError: true, domainName: true, domainExpiresAt: true, domainCheckedAt: true, domainError: true, createdAt: true, client: { select: { id: true, name: true, company: true } } },
  });
}

export async function getClientForMonitoring(id: string) {
  return prisma.client.findUnique({ where: { id }, select: { id: true, name: true, company: true } });
}

/** Uptime (verificações fora de "indisponível" sobre o total) e tempo médio de resposta desde uma data, por sistema. */
export async function uptimeByApp(appIds: string[], since: Date) {
  if (!appIds.length) return new Map<string, { uptime: number | null; checks: number; avgMs: number | null }>();
  const groups = await prisma.monitoringCheck.groupBy({ by: ["monitoredAppId", "status"], where: { monitoredAppId: { in: appIds }, checkedAt: { gte: since } }, _count: { _all: true }, _avg: { responseMs: true } });
  const result = new Map<string, { uptime: number | null; checks: number; avgMs: number | null }>();
  for (const id of appIds) {
    const rows = groups.filter((group) => group.monitoredAppId === id);
    const total = rows.reduce((sum, row) => sum + row._count._all, 0);
    const down = rows.filter((row) => row.status === "DOWN").reduce((sum, row) => sum + row._count._all, 0);
    const weighted = rows.reduce((sum, row) => sum + (row._avg.responseMs ?? 0) * row._count._all, 0);
    result.set(id, { uptime: total ? ((total - down) / total) * 100 : null, checks: total, avgMs: total ? Math.round(weighted / total) : null });
  }
  return result;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Dados da tela do sistema: uptime em três janelas, tempo de resposta das últimas 24 h e verificações recentes. */
export async function getMonitoringOverview(appId: string, now = new Date()) {
  const [day, week, month, series, recent] = await Promise.all([
    uptimeByApp([appId], new Date(now.getTime() - DAY_MS)),
    uptimeByApp([appId], new Date(now.getTime() - 7 * DAY_MS)),
    uptimeByApp([appId], new Date(now.getTime() - 30 * DAY_MS)),
    prisma.monitoringCheck.findMany({ where: { monitoredAppId: appId, checkedAt: { gte: new Date(now.getTime() - DAY_MS) } }, orderBy: { checkedAt: "asc" }, take: 600, select: { checkedAt: true, responseMs: true, status: true } }),
    prisma.monitoringCheck.findMany({ where: { monitoredAppId: appId }, orderBy: [{ checkedAt: "desc" }, { id: "desc" }], take: 12, select: { id: true, checkedAt: true, responseMs: true, status: true, summary: true } }),
  ]);
  return { uptime: { day: day.get(appId)!, week: week.get(appId)!, month: month.get(appId)! }, series, recent };
}

/** Incidentes (quedas e degradações), do mais recente para o mais antigo, com início, fim e detalhes. */
export async function listMonitoringIncidents(appId: string) {
  return prisma.monitoringEvent.findMany({
    where: { monitoredAppId: appId, type: "UPTIME", severity: { not: "info" } },
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    take: 50,
    select: { id: true, severity: true, title: true, details: true, occurredAt: true, resolvedAt: true },
  });
}
