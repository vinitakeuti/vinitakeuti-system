import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 50;

export async function listQuotes(input: { cursor?: string; query?: string }) {
  const query = input.query?.trim();
  const where = query ? { OR: [{ code: { contains: query, mode: "insensitive" as const } }, { title: { contains: query, mode: "insensitive" as const } }, { client: { name: { contains: query, mode: "insensitive" as const } } }] } : undefined;
  const records = await prisma.quote.findMany({ where, take: PAGE_SIZE + 1, ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}), orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true, code: true, title: true, amountCents: true, estimatedDays: true, status: true, createdAt: true, client: { select: { id: true, name: true, company: true } } } });
  const hasMore = records.length > PAGE_SIZE;
  const data = hasMore ? records.slice(0, PAGE_SIZE) : records;
  return { data, nextCursor: hasMore ? data.at(-1)?.id ?? null : null };
}

/** Orçamentos criados que ainda não foram concluídos no editor, do mais recentemente alterado ao mais antigo. */
export async function listPendingQuotes(input: { cursor?: string }) {
  const cursor = input.cursor?.slice(0, 50);
  const records = await prisma.quote.findMany({
    where: { completedAt: null },
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    select: { id: true, code: true, title: true, amountCents: true, createdAt: true, updatedAt: true, client: { select: { id: true, name: true, company: true } }, _count: { select: { items: true } } },
  });
  const hasMore = records.length > PAGE_SIZE;
  const data = hasMore ? records.slice(0, PAGE_SIZE) : records;
  return { data, nextCursor: hasMore ? data.at(-1)?.id ?? null : null };
}

export async function countPendingQuotes() {
  return prisma.quote.count({ where: { completedAt: null } });
}

export async function findClientsForQuote(query?: string) {
  const value = query?.trim();
  if (!value) return prisma.client.findMany({ take: 10, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true, name: true, company: true, email: true } });
  return prisma.client.findMany({ where: { OR: [{ name: { contains: value, mode: "insensitive" } }, { company: { contains: value, mode: "insensitive" } }, { email: { contains: value, mode: "insensitive" } }] }, take: 20, orderBy: [{ name: "asc" }, { id: "asc" }], select: { id: true, name: true, company: true, email: true } });
}

export async function getClientForQuote(id: string) {
  return prisma.client.findUnique({ where: { id }, select: { id: true, name: true, company: true, email: true } });
}

const CATALOG_PAGE_SIZE = 30;

/**
 * Busca no catálogo para montar a proposta: por texto e/ou categoria, agrupável por categoria (ordem da categoria,
 * depois nome) e paginada. O catálogo é pequeno o bastante para paginar por deslocamento, com limite máximo.
 */
export async function findCatalogServicesForQuote(input: { query?: string; categoryId?: string; offset?: number }) {
  const value = input.query?.trim().slice(0, 100);
  const offset = Math.max(0, Math.min(2_000, Math.floor(input.offset ?? 0)));
  const records = await prisma.serviceCatalogItem.findMany({
    where: {
      isActive: true,
      ...(input.categoryId ? { categoryId: input.categoryId.slice(0, 50) } : {}),
      ...(value ? { OR: [{ name: { contains: value, mode: "insensitive" } }, { description: { contains: value, mode: "insensitive" } }, { category: { name: { contains: value, mode: "insensitive" } } }] } : {}),
    },
    skip: offset,
    take: CATALOG_PAGE_SIZE + 1,
    orderBy: [{ category: { sortOrder: "asc" } }, { category: { name: "asc" } }, { name: "asc" }, { id: "asc" }],
    select: { id: true, name: true, billingType: true, pricingMethod: true, defaultAmountCents: true, estimatedHours: true, billingCycle: true, category: { select: { id: true, name: true } } },
  });
  const hasMore = records.length > CATALOG_PAGE_SIZE;
  return { data: hasMore ? records.slice(0, CATALOG_PAGE_SIZE) : records, nextOffset: hasMore ? offset + CATALOG_PAGE_SIZE : null };
}

/** Categorias com serviços ativos, para os filtros do seletor de serviços. */
export async function listCatalogCategoriesForQuote() {
  const categories = await prisma.serviceCategory.findMany({
    where: { isActive: true, services: { some: { isActive: true } } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { id: "asc" }],
    take: 60,
    select: { id: true, name: true, _count: { select: { services: { where: { isActive: true } } } } },
  });
  return categories.map((category) => ({ id: category.id, name: category.name, count: category._count.services }));
}

export async function getQuoteForPdf(id: string) {
  return prisma.quote.findUnique({ where: { id }, select: { id: true, code: true, title: true, scope: true, documentContent: true, amountCents: true, discountCents: true, discountPercentBps: true, terms: true, validUntil: true, createdAt: true, updatedAt: true, completedAt: true, paymentNotes: true, payments: { orderBy: [{ paidAt: "asc" }, { id: "asc" }], take: 50, select: { id: true, amountCents: true, paidAt: true } }, client: { select: { name: true, company: true, document: true, email: true } }, items: { orderBy: { createdAt: "asc" }, select: { id: true, name: true, categoryName: true, proposalText: true, billingType: true, pricingMethod: true, billingCycle: true, quantity: true, unitAmountCents: true, totalAmountCents: true } } } });
}

export async function getQuoteForEdit(id: string) {
  return prisma.quote.findUnique({ where: { id }, select: { id: true, clientId: true, code: true, title: true, scope: true, amountCents: true, discountCents: true, discountPercentBps: true, terms: true, validUntil: true, paymentNotes: true, payments: { orderBy: [{ paidAt: "asc" }, { id: "asc" }], take: 50, select: { amountCents: true, paidAt: true } }, client: { select: { name: true, company: true, email: true } }, items: { orderBy: { createdAt: "asc" }, select: { serviceCatalogItemId: true, name: true, categoryName: true, billingType: true, pricingMethod: true, billingCycle: true, quantity: true, pricingRateCents: true, unitAmountCents: true } } } });
}
