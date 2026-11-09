import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { costFromPrice, type ModelPrice } from "@/features/ai/services/ai-costs";

const PAGE_SIZE = 20;

function startOfToday() {
  const today = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Maceio" }).format(new Date());
  return new Date(`${today}T00:00:00.000-03:00`);
}

/** Uso da IA: respostas de hoje e tokens dos últimos 30 dias. */
export async function getAiUsage() {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [today, month, pending] = await Promise.all([
    prisma.aiRun.count({ where: { createdAt: { gte: startOfToday() } } }),
    prisma.aiRun.aggregate({ where: { createdAt: { gte: since } }, _sum: { inputTokens: true, outputTokens: true }, _count: { _all: true } }),
    prisma.aiAction.count({ where: { status: "PENDING_CONFIRMATION", createdAt: { gte: new Date(Date.now() - 30 * 60_000) } } }),
  ]);
  return { today, runs30d: month._count._all, inputTokens30d: month._sum.inputTokens ?? 0, outputTokens30d: month._sum.outputTokens ?? 0, pendingConfirmations: pending };
}

/** Conversas da gestão para o histórico da tela do assistente, mais recentes primeiro. */
export async function listAssistantConversations() {
  const rows = await prisma.aiConversation.findMany({ where: { channel: "GESTAO" }, orderBy: [{ lastMessageAt: "desc" }, { id: "desc" }], take: 60, select: { id: true, title: true, lastMessageAt: true } });
  return rows.map((row) => ({ id: row.id, title: row.title ?? "Nova conversa", lastMessageAt: row.lastMessageAt.toISOString() }));
}

/** A IA está pronta para a gestão? Se não, o motivo, para a tela explicar o que falta. */
export async function getAssistantStatus() {
  const settings = await prisma.aiSettings.findUnique({ where: { id: "default" }, select: { isActive: true, keyHint: true, model: true, channels: true, assistantName: true } });
  const assistantName = settings?.assistantName?.trim() || "Eliza";
  if (!settings?.isActive || !settings.keyHint || !settings.model) return { ready: false as const, assistantName, reason: "A IA ainda não está conectada. Escolha o provedor e o modelo em Integrações." };
  if (!settings.channels.includes("GESTAO")) return { ready: false as const, assistantName, reason: "O canal Gestão está desligado. Libere em Integrações › Inteligência artificial." };
  return { ready: true as const, assistantName, model: settings.model };
}

/**
 * Atividade em dois lados: Gestão (Eliza, seu WhatsApp e MCP) e Atendimento (site, área do cliente e os outros
 * números do WhatsApp). O WhatsApp é separado pela lista atual de números do dono.
 */
export type ActivityScope = "gestao" | "atendimento";

export function scopeWhere(scope: ActivityScope, ownerPhones: string[]): Prisma.AiConversationWhereInput {
  return scope === "gestao"
    ? { OR: [{ channel: { in: ["GESTAO", "SISTEMA"] } }, { channel: "WHATSAPP", externalKey: { in: ownerPhones } }] }
    : { OR: [{ channel: { in: ["SITE", "PORTAL"] } }, { channel: "WHATSAPP", externalKey: { notIn: ownerPhones } }] };
}

const DAY = 24 * 60 * 60 * 1000;

/**
 * Resumo de um lado em 30 dias: sessões, respostas, tokens e custo. Respostas antigas sem custo gravado entram com o
 * custo estimado pelo preço atual do modelo (`estimated` indica que parte do valor é estimativa).
 */
export async function getActivitySummary(scope: ActivityScope, ownerPhones: string[], price: ModelPrice) {
  const since = new Date(Date.now() - 30 * DAY);
  const where = { createdAt: { gte: since }, conversation: scopeWhere(scope, ownerPhones) };
  // Os trabalhos da Eliza nos projetos e no editor de documentos contam do lado da Gestão.
  const gestao = scope === "gestao";
  const jobsWhere = { createdAt: { gte: since }, status: { notIn: ["PENDING" as const, "RUNNING" as const] } };
  const jobSums = { _count: { _all: true as const }, _sum: { inputTokens: true as const, outputTokens: true as const, costMicros: true as const } };
  const [runs, unpriced, sessions, today, projectJobs, unpricedProjectJobs, documentJobs, unpricedDocumentJobs, jobsToday] = await Promise.all([
    prisma.aiRun.aggregate({ where, _count: { _all: true }, _sum: { inputTokens: true, outputTokens: true, costMicros: true } }),
    prisma.aiRun.aggregate({ where: { ...where, costMicros: null }, _count: { _all: true }, _sum: { inputTokens: true, outputTokens: true } }),
    prisma.aiConversation.count({ where: { AND: [scopeWhere(scope, ownerPhones), { runs: { some: { createdAt: { gte: since } } } }] } }),
    prisma.aiRun.count({ where: { createdAt: { gte: startOfToday() }, conversation: scopeWhere(scope, ownerPhones) } }),
    gestao ? prisma.projectAiJob.aggregate({ where: jobsWhere, ...jobSums }) : null,
    gestao ? prisma.projectAiJob.aggregate({ where: { ...jobsWhere, costMicros: null, inputTokens: { gt: 0 } }, ...jobSums }) : null,
    gestao ? prisma.documentAiJob.aggregate({ where: jobsWhere, ...jobSums }) : null,
    gestao ? prisma.documentAiJob.aggregate({ where: { ...jobsWhere, costMicros: null, inputTokens: { gt: 0 } }, ...jobSums }) : null,
    gestao ? Promise.all([prisma.projectAiJob.count({ where: { createdAt: { gte: startOfToday() } } }), prisma.documentAiJob.count({ where: { createdAt: { gte: startOfToday() } } })]).then(([projects, documents]) => projects + documents) : 0,
  ]);
  const jobs = [projectJobs, documentJobs];
  const unpricedJobs = [unpricedProjectJobs, unpricedDocumentJobs];
  const sum = (items: typeof jobs, pick: (item: NonNullable<(typeof jobs)[number]>) => number | null | undefined) => items.reduce((total, item) => total + (item ? pick(item) ?? 0 : 0), 0);
  const unpricedCount = unpriced._count._all + sum(unpricedJobs, (item) => item._count._all);
  const estimate = unpricedCount ? costFromPrice((unpriced._sum.inputTokens ?? 0) + sum(unpricedJobs, (item) => item._sum.inputTokens), (unpriced._sum.outputTokens ?? 0) + sum(unpricedJobs, (item) => item._sum.outputTokens), price) : 0;
  const known = (runs._sum.costMicros ?? 0) + sum(jobs, (item) => item._sum.costMicros);
  return {
    sessions,
    runs: runs._count._all + sum(jobs, (item) => item._count._all),
    today: today + jobsToday,
    inputTokens: (runs._sum.inputTokens ?? 0) + sum(jobs, (item) => item._sum.inputTokens),
    outputTokens: (runs._sum.outputTokens ?? 0) + sum(jobs, (item) => item._sum.outputTokens),
    costMicros: estimate === null ? (known || null) : known + estimate,
    estimated: unpricedCount > 0 && estimate !== null && estimate > 0,
    unpricedRuns: estimate === null ? unpricedCount : 0,
  };
}

const SESSION_PAGE = 20;
const RUNS_PER_SESSION = 30;

/** Sessões (uma por conversa) de um lado, mais recentes primeiro, com os totais e as últimas respostas de cada uma. */
export async function listActivitySessions(scope: ActivityScope, ownerPhones: string[], cursor?: string) {
  const rows = await prisma.aiConversation.findMany({
    where: { AND: [scopeWhere(scope, ownerPhones), { runs: { some: {} } }] },
    orderBy: [{ lastMessageAt: "desc" }, { id: "desc" }],
    take: SESSION_PAGE + 1,
    ...(cursor ? { cursor: { id: cursor.slice(0, 50) }, skip: 1 } : {}),
    select: { id: true, channel: true, title: true, externalKey: true, contactName: true, contactPhone: true, contactEmail: true, summary: true, summaryUpdatedAt: true, createdAt: true, lastMessageAt: true, client: { select: { name: true } } },
  });
  const sessions = rows.slice(0, SESSION_PAGE);
  const ids = sessions.map((session) => session.id);
  if (!ids.length) return { data: [], nextCursor: null };
  const [totals, runs] = await Promise.all([
    prisma.aiRun.groupBy({ by: ["conversationId"], where: { conversationId: { in: ids } }, _count: { _all: true }, _sum: { inputTokens: true, outputTokens: true, costMicros: true }, _max: { createdAt: true } }),
    prisma.aiRun.findMany({ where: { conversationId: { in: ids } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: SESSION_PAGE * RUNS_PER_SESSION, select: { id: true, conversationId: true, status: true, model: true, steps: true, inputTokens: true, outputTokens: true, costMicros: true, error: true, createdAt: true } }),
  ]);
  const actions = runs.length ? await prisma.aiAction.findMany({ where: { runId: { in: runs.map((run) => run.id) } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 2_000, select: { runId: true, tool: true, status: true, mutates: true } }) : [];
  const actionsByRun = new Map<string, typeof actions>();
  for (const action of actions) actionsByRun.set(action.runId!, [...(actionsByRun.get(action.runId!) ?? []), action]);
  const totalsById = new Map(totals.map((total) => [total.conversationId, total]));
  return {
    data: sessions.map((session) => {
      const total = totalsById.get(session.id);
      const sessionRuns = runs.filter((run) => run.conversationId === session.id).slice(0, RUNS_PER_SESSION);
      return {
        ...session,
        runCount: total?._count._all ?? 0,
        inputTokens: total?._sum.inputTokens ?? 0,
        outputTokens: total?._sum.outputTokens ?? 0,
        costMicros: total?._sum.costMicros ?? null,
        unpricedRuns: sessionRuns.filter((run) => run.costMicros === null && run.status === "DONE").length,
        failedRuns: sessionRuns.filter((run) => run.status === "FAILED").length,
        lastStatus: sessionRuns[0]?.status ?? "DONE",
        runs: sessionRuns.map((run) => ({ ...run, actions: actionsByRun.get(run.id) ?? [] })),
      };
    }),
    nextCursor: rows.length > SESSION_PAGE ? sessions.at(-1)!.id : null,
  };
}
