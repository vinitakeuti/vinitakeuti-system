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

export async function findClientsForQuote(query?: string) {
  const value = query?.trim();
  if (!value) return prisma.client.findMany({ take: 10, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true, name: true, company: true, email: true } });
  return prisma.client.findMany({ where: { OR: [{ name: { contains: value, mode: "insensitive" } }, { company: { contains: value, mode: "insensitive" } }, { email: { contains: value, mode: "insensitive" } }] }, take: 20, orderBy: [{ name: "asc" }, { id: "asc" }], select: { id: true, name: true, company: true, email: true } });
}

export async function getClientForQuote(id: string) {
  return prisma.client.findUnique({ where: { id }, select: { id: true, name: true, company: true, email: true } });
}

export async function findCatalogServicesForQuote(query?: string) {
  const value = query?.trim().slice(0, 100);
  return prisma.serviceCatalogItem.findMany({
    where: {
      isActive: true,
      ...(value ? { OR: [{ name: { contains: value, mode: "insensitive" } }, { description: { contains: value, mode: "insensitive" } }, { category: { name: { contains: value, mode: "insensitive" } } }] } : {}),
    },
    take: value ? 20 : 10,
    orderBy: value ? [{ name: "asc" }, { id: "asc" }] : [{ createdAt: "desc" }, { id: "desc" }],
    select: { id: true, name: true, billingType: true, pricingMethod: true, defaultAmountCents: true, estimatedHours: true, billingCycle: true, category: { select: { name: true } } },
  });
}

export async function getQuoteForPdf(id: string) {
  return prisma.quote.findUnique({ where: { id }, select: { id: true, code: true, title: true, scope: true, documentContent: true, amountCents: true, discountCents: true, terms: true, validUntil: true, createdAt: true, client: { select: { name: true, company: true, document: true, email: true } }, items: { orderBy: { createdAt: "asc" }, select: { id: true, name: true, categoryName: true, proposalText: true, billingType: true, pricingMethod: true, billingCycle: true, quantity: true, unitAmountCents: true, totalAmountCents: true } } } });
}

export async function getQuoteForDocumentEditor(id: string) {
  return prisma.quote.findUnique({ where: { id }, select: { id: true, code: true, title: true, documentContent: true, client: { select: { name: true, company: true } }, items: { orderBy: { createdAt: "asc" }, select: { id: true, name: true, categoryName: true, proposalText: true } } } });
}

export async function getQuoteForEdit(id: string) {
  return prisma.quote.findUnique({ where: { id }, select: { id: true, clientId: true, code: true, title: true, scope: true, discountCents: true, terms: true, validUntil: true, client: { select: { name: true, company: true, email: true } }, items: { orderBy: { createdAt: "asc" }, select: { serviceCatalogItemId: true, name: true, categoryName: true, billingType: true, pricingMethod: true, billingCycle: true, quantity: true, pricingRateCents: true, unitAmountCents: true } } } });
}
