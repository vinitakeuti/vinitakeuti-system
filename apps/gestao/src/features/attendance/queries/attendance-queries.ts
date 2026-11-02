import type { AttendanceStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { scopeWhere } from "@/features/ai/queries/ai-queries";

/**
 * Atendimentos: as conversas da IA com clientes e visitantes (site, área do cliente e WhatsApp de quem não é você),
 * com a pessoa, o contato, o resumo curto, a reunião marcada e a situação. Listagem paginada por cursor, mais
 * recentes primeiro, com filtros por situação, canal e busca.
 */

export const ATTENDANCE_STATUSES = ["NEW", "IN_PROGRESS", "CONVERTED", "ARCHIVED"] as const;
export const attendanceStatusLabel: Record<AttendanceStatus, string> = { NEW: "Novo", IN_PROGRESS: "Em andamento", CONVERTED: "Convertido", ARCHIVED: "Arquivado" };
export const ATTENDANCE_CHANNELS = { site: "SITE", whatsapp: "WHATSAPP", portal: "PORTAL" } as const;
export type AttendanceChannelFilter = keyof typeof ATTENDANCE_CHANNELS;

const PAGE_SIZE = 25;

async function ownerPhones() {
  const settings = await prisma.aiSettings.findUnique({ where: { id: "default" }, select: { ownerPhones: true } });
  return settings?.ownerPhones ?? [];
}

export type AttendanceFilters = { status?: AttendanceStatus | "ALL"; channel?: AttendanceChannelFilter; query?: string; cursor?: string };

function filterWhere(phones: string[], filters: Omit<AttendanceFilters, "cursor">): Prisma.AiConversationWhereInput {
  const query = filters.query?.trim().slice(0, 120);
  const digits = query?.replace(/\D/g, "") ?? "";
  // Entra quem conversou e também quem deixou os dados no site sem chegar a mandar mensagem (é um contato).
  const and: Prisma.AiConversationWhereInput[] = [scopeWhere("atendimento", phones), { OR: [{ messages: { some: { role: "user" } } }, { contactName: { not: null } }] }];
  if (filters.status && filters.status !== "ALL") and.push({ attendanceStatus: filters.status });
  if (filters.channel) and.push({ channel: ATTENDANCE_CHANNELS[filters.channel] });
  if (query) and.push({ OR: [
    { contactName: { contains: query, mode: "insensitive" } },
    { contactEmail: { contains: query, mode: "insensitive" } },
    { summary: { contains: query, mode: "insensitive" } },
    { client: { name: { contains: query, mode: "insensitive" } } },
    ...(digits.length >= 4 ? [{ contactPhone: { contains: digits } }, { externalKey: { contains: digits } }] : []),
  ] });
  return { AND: and };
}

/** Quantos atendimentos em cada situação (com o canal e a busca aplicados), para as abas. */
export async function countAttendances(filters: Omit<AttendanceFilters, "cursor" | "status">) {
  const phones = await ownerPhones();
  const groups = await prisma.aiConversation.groupBy({ by: ["attendanceStatus"], where: filterWhere(phones, filters), _count: { _all: true } });
  const counts = Object.fromEntries(ATTENDANCE_STATUSES.map((status) => [status, groups.find((group) => group.attendanceStatus === status)?._count._all ?? 0])) as Record<AttendanceStatus, number>;
  return { ...counts, ALL: Object.values(counts).reduce((sum, value) => sum + value, 0) };
}

export async function listAttendances(filters: AttendanceFilters) {
  const phones = await ownerPhones();
  const rows = await prisma.aiConversation.findMany({
    where: filterWhere(phones, filters),
    orderBy: [{ lastMessageAt: "desc" }, { id: "desc" }],
    take: PAGE_SIZE + 1,
    ...(filters.cursor ? { cursor: { id: filters.cursor.slice(0, 50) }, skip: 1 } : {}),
    select: { id: true, channel: true, externalKey: true, contactName: true, contactPhone: true, contactEmail: true, summary: true, attendanceStatus: true, createdAt: true, lastMessageAt: true, client: { select: { id: true, name: true, phone: true, email: true } } },
  });
  const page = rows.slice(0, PAGE_SIZE);
  const ids = page.map((row) => row.id);
  const [counts, meetings, firstMessages] = ids.length ? await Promise.all([
    prisma.aiMessage.groupBy({ by: ["conversationId"], where: { conversationId: { in: ids }, role: "user" }, _count: { _all: true } }),
    prisma.calendarEvent.findMany({ where: { conversationId: { in: ids }, status: "SCHEDULED" }, orderBy: [{ startsAt: "asc" }, { id: "asc" }], take: ids.length * 2, select: { conversationId: true, startsAt: true } }),
    // Sem resumo, a lista mostra a primeira mensagem da pessoa.
    prisma.aiMessage.findMany({ where: { conversationId: { in: ids }, role: "user" }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], distinct: ["conversationId"], take: ids.length, select: { conversationId: true, content: true } }),
  ]) : [[], [], []];
  const countBy = new Map(counts.map((item) => [item.conversationId, item._count._all]));
  const meetingBy = new Map<string, Date>();
  for (const meeting of meetings) if (meeting.conversationId && !meetingBy.has(meeting.conversationId)) meetingBy.set(meeting.conversationId, meeting.startsAt);
  const firstBy = new Map(firstMessages.map((message) => [message.conversationId, message.content]));
  return {
    data: page.map((row) => ({ ...row, ...contactOf(row), messages: countBy.get(row.id) ?? 0, meetingAt: meetingBy.get(row.id) ?? null, firstMessage: firstBy.get(row.id) ?? null })),
    nextCursor: rows.length > PAGE_SIZE ? page.at(-1)!.id : null,
  };
}

/** Pessoa e contato de um atendimento, venha de onde vier (site, WhatsApp ou cliente do portal). */
export function contactOf(row: { channel: string; externalKey: string | null; contactName: string | null; contactPhone: string | null; contactEmail: string | null; client: { name: string; phone: string | null; email: string | null } | null }) {
  return {
    person: row.contactName ?? row.client?.name ?? (row.channel === "WHATSAPP" ? "Contato do WhatsApp" : "Visitante"),
    phone: row.contactPhone ?? (row.channel === "WHATSAPP" ? row.externalKey : null) ?? row.client?.phone ?? null,
    email: row.contactEmail ?? row.client?.email ?? null,
  };
}

/** Um atendimento, com a pessoa, a situação, as anotações e as reuniões. A conversa vem de conversationView. */
export async function getAttendance(id: string) {
  const phones = await ownerPhones();
  const row = await prisma.aiConversation.findFirst({
    where: { AND: [{ id: id.slice(0, 50) }, scopeWhere("atendimento", phones)] },
    select: { id: true, channel: true, externalKey: true, contactName: true, contactPhone: true, contactEmail: true, summary: true, summaryUpdatedAt: true, attendanceStatus: true, ownerNotes: true, createdAt: true, lastMessageAt: true, clientId: true, client: { select: { id: true, name: true, phone: true, email: true } }, events: { orderBy: [{ startsAt: "desc" }, { id: "desc" }], take: 10, select: { id: true, title: true, startsAt: true, endsAt: true, status: true } } },
  });
  if (!row) return null;
  const [usage, userMessages] = await Promise.all([
    prisma.aiRun.aggregate({ where: { conversationId: row.id }, _sum: { inputTokens: true, outputTokens: true, costMicros: true }, _count: { _all: true } }),
    prisma.aiMessage.count({ where: { conversationId: row.id, role: "user" } }),
  ]);
  return { ...row, ...contactOf(row), userMessages, runs: usage._count._all, tokens: (usage._sum.inputTokens ?? 0) + (usage._sum.outputTokens ?? 0), costMicros: usage._sum.costMicros };
}
