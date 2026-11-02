import { prisma } from "@/lib/prisma";

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

/** Atividade recente: cada resposta da IA com o canal, a situação, o consumo e as ferramentas usadas. */
export async function listAiActivity(cursor?: string) {
  const rows = await prisma.aiRun.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor.slice(0, 50) }, skip: 1 } : {}),
    select: { id: true, status: true, model: true, steps: true, inputTokens: true, outputTokens: true, error: true, createdAt: true, finishedAt: true, conversation: { select: { id: true, channel: true, title: true, client: { select: { name: true } } } } },
  });
  const data = rows.slice(0, PAGE_SIZE);
  const actions = data.length ? await prisma.aiAction.findMany({ where: { runId: { in: data.map((run) => run.id) } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 200, select: { runId: true, tool: true, status: true, mutates: true } }) : [];
  const byRun = new Map<string, typeof actions>();
  for (const action of actions) byRun.set(action.runId!, [...(byRun.get(action.runId!) ?? []), action]);
  return { data: data.map((run) => ({ ...run, actions: byRun.get(run.id) ?? [] })), nextCursor: rows.length > PAGE_SIZE ? data.at(-1)!.id : null };
}

/** Conversas da gestão para o histórico da tela do assistente, mais recentes primeiro. */
export async function listAssistantConversations() {
  const rows = await prisma.aiConversation.findMany({ where: { channel: "GESTAO" }, orderBy: [{ lastMessageAt: "desc" }, { id: "desc" }], take: 60, select: { id: true, title: true, lastMessageAt: true } });
  return rows.map((row) => ({ id: row.id, title: row.title ?? "Nova conversa", lastMessageAt: row.lastMessageAt.toISOString() }));
}

/** A IA está pronta para a gestão? Se não, o motivo, para a tela explicar o que falta. */
export async function getAssistantStatus() {
  const settings = await prisma.aiSettings.findUnique({ where: { id: "default" }, select: { isActive: true, keyHint: true, model: true, channels: true } });
  if (!settings?.isActive || !settings.keyHint || !settings.model) return { ready: false as const, reason: "A IA ainda não está conectada. Escolha o provedor e o modelo em Integrações." };
  if (!settings.channels.includes("GESTAO")) return { ready: false as const, reason: "O canal Gestão está desligado. Libere em Integrações › Inteligência artificial." };
  return { ready: true as const, model: settings.model };
}
