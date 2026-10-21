import { Prisma, ServiceBillingType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 50;

export async function listServiceCategories() {
  return prisma.serviceCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      sortOrder: true,
      isActive: true,
      _count: { select: { services: true } },
    },
  });
}

export async function listCatalogServices(input: { cursor?: string; query?: string; categoryId?: string }) {
  const query = input.query?.trim();
  const where: Prisma.ServiceCatalogItemWhereInput = {
    isActive: true,
    ...(input.categoryId ? { categoryId: input.categoryId } : {}),
    ...(query ? { OR: [{ name: { contains: query, mode: "insensitive" } }, { description: { contains: query, mode: "insensitive" } }, { proposalText: { contains: query, mode: "insensitive" } }] } : {}),
  };
  const items = await prisma.serviceCatalogItem.findMany({
    where,
    take: PAGE_SIZE + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    orderBy: [{ category: { sortOrder: "asc" } }, { category: { name: "asc" } }, { name: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      proposalText: true,
      billingType: true,
      pricingMethod: true,
      defaultAmountCents: true,
      billingCycle: true,
      category: { select: { id: true, name: true } },
      _count: { select: { subscriptions: { where: { status: "ACTIVE" } } } },
    },
  });
  const hasMore = items.length > PAGE_SIZE;
  const data = hasMore ? items.slice(0, PAGE_SIZE) : items;
  return { data, nextCursor: hasMore ? data.at(-1)?.id ?? null : null };
}

export async function getRecurringServiceOptions() {
  return prisma.serviceCatalogItem.findMany({
    where: { isActive: true, billingType: ServiceBillingType.RECURRING },
    take: 100,
    orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      defaultAmountCents: true,
      billingCycle: true,
      category: { select: { name: true } },
    },
  });
}

export async function getClientForRecurringService(clientId: string) {
  return prisma.client.findUnique({ where: { id: clientId }, select: { id: true, name: true, company: true } });
}

export async function getCatalogService(id: string) {
  return prisma.serviceCatalogItem.findUnique({
    where: { id },
    select: {
      id: true,
      categoryId: true,
      name: true,
      description: true,
      proposalText: true,
      billingType: true,
      pricingMethod: true,
      defaultAmountCents: true,
      estimatedHours: true,
      billingCycle: true,
      isActive: true,
      category: { select: { name: true } },
      _count: { select: { subscriptions: true, quoteItems: true } },
    },
  });
}
