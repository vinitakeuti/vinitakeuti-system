import { ProjectStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 50;

export async function listClients(input: { cursor?: string; query?: string }) {
  const query = input.query?.trim();
  const where = query ? {
    OR: [
      { name: { contains: query, mode: "insensitive" as const } },
      { company: { contains: query, mode: "insensitive" as const } },
      { email: { contains: query, mode: "insensitive" as const } },
    ],
  } : undefined;
  const clients = await prisma.client.findMany({
    where,
    take: PAGE_SIZE + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true, name: true, company: true, email: true, phone: true, city: true, createdAt: true,
      _count: { select: { quotes: true, projects: true, subscriptions: { where: { status: "ACTIVE" } } } },
    },
  });
  const hasMore = clients.length > PAGE_SIZE;
  const data = hasMore ? clients.slice(0, PAGE_SIZE) : clients;
  return { data, nextCursor: hasMore ? data.at(-1)?.id ?? null : null };
}

export async function getClientProfile(id: string) {
  return prisma.client.findUnique({
    where: { id },
    select: {
      id: true, name: true, company: true, email: true, phone: true, document: true, address: true, city: true, notes: true, createdAt: true,
      quotes: { take: 25, orderBy: { createdAt: "desc" }, select: { id: true, code: true, title: true, amountCents: true, status: true, createdAt: true, validUntil: true } },
      projects: { where: { status: { in: [ProjectStatus.PLANNING, ProjectStatus.IN_PROGRESS, ProjectStatus.WAITING_CLIENT] } }, take: 25, orderBy: { updatedAt: "desc" }, select: { id: true, name: true, status: true, deliveryAt: true, budgetCents: true } },
      subscriptions: { take: 25, orderBy: [{ status: "asc" }, { nextPaymentAt: "asc" }], select: { id: true, name: true, status: true, amountCents: true, billingCycle: true, nextPaymentAt: true, serviceCatalogItem: { select: { category: { select: { name: true } } } } } },
    },
  });
}
