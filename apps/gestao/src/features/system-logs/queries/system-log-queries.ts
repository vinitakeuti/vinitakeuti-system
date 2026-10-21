import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const LOG_PAGE_SIZE = 50;
export const LOG_SOURCES = [{ value: "gestao", label: "Gestão" }, { value: "clientes", label: "Portal do cliente" }, { value: "sistema", label: "Sistema" }] as const;
export const LOG_LEVELS = [{ value: "info", label: "Informação" }, { value: "warning", label: "Atenção" }, { value: "error", label: "Erro" }] as const;

export type SystemLogFilters = { cursor?: string; source?: string; level?: string; query?: string };

/** Eventos mais recentes primeiro, com filtros por origem, nível e texto. */
export async function listSystemLogs(filters: SystemLogFilters = {}) {
  const query = filters.query?.trim().slice(0, 120);
  const where: Prisma.SystemLogWhereInput = {
    ...(LOG_SOURCES.some((item) => item.value === filters.source) ? { source: filters.source } : {}),
    ...(LOG_LEVELS.some((item) => item.value === filters.level) ? { level: filters.level } : {}),
    ...(query ? { OR: [{ event: { contains: query, mode: "insensitive" } }, { message: { contains: query, mode: "insensitive" } }, { actorEmail: { contains: query, mode: "insensitive" } }] } : {}),
  };
  const rows = await prisma.systemLog.findMany({
    where,
    take: LOG_PAGE_SIZE + 1,
    ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true, source: true, level: true, event: true, message: true, actorEmail: true, ip: true, userAgent: true, metadata: true, createdAt: true },
  });
  const hasMore = rows.length > LOG_PAGE_SIZE;
  const data = hasMore ? rows.slice(0, LOG_PAGE_SIZE) : rows;
  return { data, nextCursor: hasMore ? data.at(-1)?.id ?? null : null };
}

/** Contagem das últimas 24 horas por nível, para o resumo. */
export async function getSystemLogSummary() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const groups = await prisma.systemLog.groupBy({ by: ["level"], where: { createdAt: { gte: since } }, _count: { _all: true } });
  const count = (level: string) => groups.find((group) => group.level === level)?._count._all ?? 0;
  return { info: count("info"), warning: count("warning"), error: count("error") };
}

export type EmailLogFilters = { cursor?: string; status?: string };

export async function listEmailLogs(filters: EmailLogFilters = {}) {
  const rows = await prisma.emailLog.findMany({
    where: filters.status === "SENT" || filters.status === "FAILED" ? { status: filters.status } : undefined,
    take: LOG_PAGE_SIZE + 1,
    ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true, kind: true, status: true, toAddress: true, subject: true, messageId: true, response: true, error: true, durationMs: true, actorEmail: true, createdAt: true },
  });
  const hasMore = rows.length > LOG_PAGE_SIZE;
  const data = hasMore ? rows.slice(0, LOG_PAGE_SIZE) : rows;
  return { data, nextCursor: hasMore ? data.at(-1)?.id ?? null : null };
}
