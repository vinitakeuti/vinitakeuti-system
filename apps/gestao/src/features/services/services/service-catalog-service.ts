import { ServiceBillingType, ServicePricingMethod } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { serializeRichText } from "@/lib/rich-text";
import { markdownToRichText } from "@/features/ai/services/document-markdown";

/**
 * Catálogo de serviços sem formulário (usado pela IA), com as regras da tela: categoria ativa (criada se ainda não
 * existir), valor de referência maior que zero, exceto no valor personalizado, e ciclo nos recorrentes.
 */

export async function listCatalogForQuotes() {
  const [services, categories] = await Promise.all([
    prisma.serviceCatalogItem.findMany({ where: { isActive: true }, orderBy: [{ category: { sortOrder: "asc" } }, { category: { name: "asc" } }, { name: "asc" }, { id: "asc" }], take: 200, select: { id: true, name: true, description: true, billingType: true, billingCycle: true, pricingMethod: true, defaultAmountCents: true, category: { select: { name: true } } } }),
    prisma.serviceCategory.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], take: 100, select: { id: true, name: true } }),
  ]);
  return { services, categories };
}

export async function createCatalogServiceRecord(input: { categoryName: string; name: string; description?: string | null; proposalMarkdown?: string | null; billingType: ServiceBillingType; billingCycle?: string | null; pricingMethod: ServicePricingMethod; defaultAmountCents?: number }) {
  const name = input.name.trim().slice(0, 140);
  const categoryName = input.categoryName.trim().slice(0, 80);
  if (!name || !categoryName) return { ok: false as const, error: "Informe a categoria e o nome do serviço." };
  const defaultAmountCents = input.pricingMethod === ServicePricingMethod.CUSTOM ? 0 : Math.round(input.defaultAmountCents ?? 0);
  if (input.pricingMethod !== ServicePricingMethod.CUSTOM && defaultAmountCents <= 0) return { ok: false as const, error: "Informe um valor de referência maior que zero (ou use valor personalizado)." };
  const duplicate = await prisma.serviceCatalogItem.findFirst({ where: { name: { equals: name, mode: "insensitive" }, isActive: true }, select: { id: true } });
  if (duplicate) return { ok: false as const, error: `Já existe um serviço ativo chamado "${name}" (id ${duplicate.id}).` };
  const existing = await prisma.serviceCategory.findFirst({ where: { name: { equals: categoryName, mode: "insensitive" } }, select: { id: true, isActive: true } });
  const category = existing ?? await prisma.serviceCategory.create({ data: { name: categoryName }, select: { id: true, isActive: true } });
  if (!category.isActive) await prisma.serviceCategory.update({ where: { id: category.id }, data: { isActive: true } });
  const recurring = input.billingType === ServiceBillingType.RECURRING;
  const service = await prisma.serviceCatalogItem.create({
    data: { categoryId: category.id, name, description: input.description?.trim().slice(0, 2_000) || null, proposalText: input.proposalMarkdown?.trim() ? serializeRichText(markdownToRichText(input.proposalMarkdown)) : null, billingType: input.billingType, pricingMethod: input.pricingMethod, defaultAmountCents, estimatedHours: null, billingCycle: recurring ? input.billingCycle?.trim().slice(0, 30) || "MONTHLY" : null },
    select: { id: true, name: true },
  });
  return { ok: true as const, service, categoryCreated: !existing };
}
