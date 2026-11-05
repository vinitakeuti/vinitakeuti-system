import { ProjectUpdateStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ACTIVE_PROJECT_STATUSES, PROJECT_LIMITS } from "@/features/projects/types/project";

const PAGE_SIZE = 50;
const LOG_PAGE = 20;

export type ProjectListFilter = "ativos" | "entregues" | "todos";
export type ProjectKindFilter = "todos" | "clientes" | "pessoais";

export async function listProjects(input: { cursor?: string; filter: ProjectListFilter; kind: ProjectKindFilter; query?: string }) {
  const query = input.query?.trim().slice(0, 100);
  const where: Prisma.ProjectWhereInput = {
    ...(input.filter === "ativos" ? { status: { in: [...ACTIVE_PROJECT_STATUSES] } } : input.filter === "entregues" ? { status: "DELIVERED" } : {}),
    ...(input.kind === "clientes" ? { clientId: { not: null } } : input.kind === "pessoais" ? { clientId: null } : {}),
    ...(query ? { OR: [{ name: { contains: query, mode: "insensitive" } }, { client: { name: { contains: query, mode: "insensitive" } } }, { client: { company: { contains: query, mode: "insensitive" } } }] } : {}),
  };
  const records = await prisma.project.findMany({
    where,
    take: PAGE_SIZE + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    select: { id: true, name: true, status: true, totalWeight: true, doneWeight: true, deliveryAt: true, updatedAt: true, client: { select: { id: true, name: true, company: true } }, _count: { select: { tasks: true } } },
  });
  const hasMore = records.length > PAGE_SIZE;
  const data = hasMore ? records.slice(0, PAGE_SIZE) : records;
  return { data, nextCursor: hasMore ? data.at(-1)?.id ?? null : null };
}

/** Projeto com o plano inteiro (funcionalidades e subatividades, dentro dos limites do plano). */
export async function getProject(id: string) {
  return prisma.project.findUnique({
    where: { id },
    select: {
      id: true, name: true, description: true, status: true, startedAt: true, deliveryAt: true, totalWeight: true, doneWeight: true, createdAt: true, updatedAt: true,
      client: { select: { id: true, name: true, company: true } },
      quotes: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 5, select: { id: true, code: true, title: true, scope: true } },
      features: {
        orderBy: [{ position: "asc" }, { id: "asc" }],
        take: PROJECT_LIMITS.features,
        select: { id: true, title: true, description: true, tasks: { orderBy: [{ position: "asc" }, { id: "asc" }], take: PROJECT_LIMITS.tasksPerFeature, select: { id: true, title: true, notes: true, status: true, weight: true, doneAt: true } } },
      },
    },
  });
}

export type ProjectDetail = NonNullable<Awaited<ReturnType<typeof getProject>>>;

export async function getProjectTotals(projectId: string) {
  const [minutes, statusCounts] = await Promise.all([
    prisma.projectLog.aggregate({ where: { projectId }, _sum: { minutes: true }, _count: { _all: true } }),
    prisma.projectTask.groupBy({ by: ["status"], where: { projectId }, _count: { _all: true } }),
  ]);
  return { minutes: minutes._sum.minutes ?? 0, logs: minutes._count._all, byStatus: Object.fromEntries(statusCounts.map((row) => [row.status, row._count._all])) as Partial<Record<string, number>> };
}

export async function listProjectLogs(projectId: string, cursor?: string) {
  const records = await prisma.projectLog.findMany({ where: { projectId }, take: LOG_PAGE + 1, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), orderBy: [{ day: "desc" }, { id: "desc" }], select: { id: true, day: true, summary: true, minutes: true, tasks: true, source: true, createdAt: true } });
  const hasMore = records.length > LOG_PAGE;
  const data = hasMore ? records.slice(0, LOG_PAGE) : records;
  return { data, nextCursor: hasMore ? data.at(-1)?.id ?? null : null };
}

export async function listProjectUpdates(projectId: string) {
  return prisma.projectUpdate.findMany({ where: { projectId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 30, select: { id: true, title: true, body: true, status: true, progressPercent: true, publishedAt: true, emailedAt: true, createdAt: true } });
}

/** Último trabalho da Eliza de cada tipo no projeto (para mostrar o andamento ou o rascunho a revisar). */
export async function latestProjectJobs(projectId: string) {
  const jobs = await prisma.projectAiJob.findMany({ where: { projectId, status: { in: ["PENDING", "RUNNING", "READY", "FAILED"] } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 10, select: { id: true, kind: true, status: true, input: true, day: true, minutes: true, result: true, error: true, createdAt: true } });
  return { plan: jobs.find((job) => job.kind === "PLAN") ?? null, day: jobs.find((job) => job.kind === "DAY") ?? null, update: jobs.find((job) => job.kind === "UPDATE") ?? null };
}

/** Orçamentos do cliente que podem ser vinculados ao projeto (sem projeto ou já deste projeto). */
export async function listLinkableQuotes(clientId: string, projectId?: string) {
  return prisma.quote.findMany({ where: { clientId, OR: [{ projectId: null }, ...(projectId ? [{ projectId }] : [])] }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 30, select: { id: true, code: true, title: true } });
}

export async function getQuoteForProject(quoteId: string) {
  return prisma.quote.findUnique({ where: { id: quoteId }, select: { id: true, code: true, title: true, scope: true, projectId: true, estimatedDays: true, client: { select: { id: true, name: true, company: true } } } });
}

/** Atualizações publicadas para o portal: o cliente só vê as próprias. */
export function publishedUpdatesWhere(clientId: string): Prisma.ProjectUpdateWhereInput {
  return { status: ProjectUpdateStatus.PUBLISHED, project: { clientId } };
}
