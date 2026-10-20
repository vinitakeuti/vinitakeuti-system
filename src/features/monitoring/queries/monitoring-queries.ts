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
    select: { id: true, name: true, url: true, healthEndpoint: true, environment: true, status: true, lastCheckedAt: true, lastResponseMs: true, lastCheckSummary: true, createdAt: true, client: { select: { id: true, name: true, company: true } } },
  });
}

export async function getClientForMonitoring(id: string) {
  return prisma.client.findUnique({ where: { id }, select: { id: true, name: true, company: true } });
}
