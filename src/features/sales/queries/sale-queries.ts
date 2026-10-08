import { DocumentStatus, SaleStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 50;

type DateFilterInput = { from?: string; to?: string };

function dateAtMaceioMidnight(value?: string) {
  if (!value?.match(/^\d{4}-\d{2}-\d{2}$/)) return undefined;
  const parsed = new Date(`${value}T00:00:00.000-03:00`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function dateRange(input: DateFilterInput) {
  const from = dateAtMaceioMidnight(input.from);
  const toStart = dateAtMaceioMidnight(input.to);
  const to = toStart ? new Date(toStart.getTime() + 86_400_000) : undefined;
  return from || to ? { ...(from ? { gte: from } : {}), ...(to ? { lt: to } : {}) } : undefined;
}

export async function listOpenQuoteOpportunities(input: { cursor?: string } & DateFilterInput) {
  const createdAt = dateRange(input);
  const records = await prisma.quote.findMany({
    where: { status: { in: [DocumentStatus.DRAFT, DocumentStatus.SENT] }, sale: null, ...(createdAt ? { createdAt } : {}) },
    take: PAGE_SIZE + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true, code: true, title: true, amountCents: true, estimatedDays: true, status: true, validUntil: true, createdAt: true, client: { select: { id: true, name: true, company: true } } },
  });
  const hasMore = records.length > PAGE_SIZE;
  const data = hasMore ? records.slice(0, PAGE_SIZE) : records;
  return { data, nextCursor: hasMore ? data.at(-1)?.id ?? null : null };
}

export async function listSales(input: { cursor?: string } & DateFilterInput) {
  const createdAt = dateRange(input);
  const records = await prisma.sale.findMany({
    ...(createdAt ? { where: { createdAt } } : {}),
    take: PAGE_SIZE + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true, code: true, title: true, amountCents: true, origin: true, status: true, confirmedAt: true, paidAt: true, createdAt: true, client: { select: { id: true, name: true, company: true } }, quote: { select: { id: true, code: true } } },
  });
  const hasMore = records.length > PAGE_SIZE;
  const data = hasMore ? records.slice(0, PAGE_SIZE) : records;
  return { data, nextCursor: hasMore ? data.at(-1)?.id ?? null : null };
}

export async function getSalesSummary(input: DateFilterInput) {
  const createdAt = dateRange(input);
  const [openQuotes, pendingSales, confirmedSales] = await Promise.all([
    prisma.quote.aggregate({ where: { status: { in: [DocumentStatus.DRAFT, DocumentStatus.SENT] }, sale: null, ...(createdAt ? { createdAt } : {}) }, _sum: { amountCents: true }, _count: { _all: true } }),
    prisma.sale.aggregate({ where: { status: SaleStatus.PENDING, ...(createdAt ? { createdAt } : {}) }, _sum: { amountCents: true }, _count: { _all: true } }),
    prisma.sale.aggregate({ where: { status: { in: [SaleStatus.CONFIRMED, SaleStatus.PAID] }, ...(createdAt ? { createdAt } : {}) }, _sum: { amountCents: true }, _count: { _all: true } }),
  ]);
  return {
    pendingAmountCents: (openQuotes._sum.amountCents ?? 0) + (pendingSales._sum.amountCents ?? 0),
    pendingCount: openQuotes._count._all + pendingSales._count._all,
    confirmedAmountCents: confirmedSales._sum.amountCents ?? 0,
    confirmedCount: confirmedSales._count._all,
  };
}

export async function getClientForDirectSale(id: string) {
  return prisma.client.findUnique({ where: { id }, select: { id: true, name: true, company: true, email: true } });
}

export const saleStatusLabel: Record<SaleStatus, string> = {
  PENDING: "PENDENTE",
  CONFIRMED: "CONFIRMADA",
  PAID: "PAGA",
  CANCELLED: "CANCELADA",
};

export const quoteStatusLabel: Record<DocumentStatus, string> = {
  DRAFT: "EM ABERTO",
  SENT: "AGUARDANDO CONFIRMAÇÃO",
  ACCEPTED: "ACEITO",
  SIGNED: "ASSINADO",
  EXPIRED: "EXPIRADO",
};
