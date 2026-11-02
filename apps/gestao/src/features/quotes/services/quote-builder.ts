import { ServicePricingMethod } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createQuote } from "@/features/quotes/services/create-quote";
import { syncQuotePayments } from "@/features/finance/services/payment-plan";
import { recalculateFinancialEntry } from "@/features/finance/services/finance-ledger";

/**
 * Orçamento a partir de serviços do catálogo, sem formulário (usado pela IA). Mesmas regras da tela de orçamento:
 * cada item é um serviço ativo do catálogo, com forma de cobrança, quantidade e valor unitário; o total é a soma
 * menos o desconto (fixo ou percentual), sempre recalculado aqui. O documento nasce vazio: o editor insere os
 * blocos dos serviços na primeira abertura, como num orçamento novo.
 */

export const MAX_QUOTE_ITEMS = 50;

export type QuoteLine = {
  serviceId: string;
  /** Padrão: a forma de cobrança do serviço no catálogo. */
  pricingMethod?: ServicePricingMethod;
  /** Horas, diárias ou unidades. Padrão: 1. */
  quantity?: number;
  /** Valor por unidade (hora, diária ou o serviço). Padrão: o valor de referência do catálogo. */
  unitCents?: number;
};

export type QuoteDiscount = { amountCents?: number; percent?: number };

type QuoteItem = Parameters<typeof createQuote>[0]["items"][number];
type BuildResult = { ok: true; items: QuoteItem[]; subtotalCents: number } | { ok: false; error: string };

export async function buildQuoteItems(lines: QuoteLine[], preserved: { serviceIds?: string[]; proposalTexts?: Map<string, string | null> } = {}): Promise<BuildResult> {
  if (!lines.length) return { ok: false, error: "Escolha ao menos um serviço." };
  if (lines.length > MAX_QUOTE_ITEMS) return { ok: false, error: `No máximo ${MAX_QUOTE_ITEMS} serviços por orçamento.` };
  const ids = lines.map((line) => line.serviceId.slice(0, 50));
  if (new Set(ids).size !== ids.length) return { ok: false, error: "O mesmo serviço apareceu duas vezes. Junte as quantidades num item só." };
  const services = await prisma.serviceCatalogItem.findMany({ where: { id: { in: ids }, OR: [{ isActive: true }, { id: { in: preserved.serviceIds ?? [] } }] }, take: MAX_QUOTE_ITEMS, select: { id: true, name: true, proposalText: true, billingType: true, billingCycle: true, pricingMethod: true, defaultAmountCents: true, category: { select: { name: true } } } });
  const byId = new Map(services.map((service) => [service.id, service]));
  const missing = ids.filter((id) => !byId.has(id));
  if (missing.length) return { ok: false, error: `Serviço não encontrado ou arquivado: ${missing.join(", ")}.` };

  const items: QuoteItem[] = [];
  for (const line of lines) {
    const service = byId.get(line.serviceId)!;
    const pricingMethod = line.pricingMethod ?? service.pricingMethod;
    const quantity = Math.floor(line.quantity ?? 1);
    const unitCents = Math.round(line.unitCents ?? service.defaultAmountCents);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10_000) return { ok: false, error: `Quantidade inválida para ${service.name}.` };
    if (!Number.isFinite(unitCents) || unitCents < 1) return { ok: false, error: `${service.name} não tem valor de referência no catálogo${pricingMethod === ServicePricingMethod.CUSTOM ? " (valor personalizado)" : ""}: informe o valor.` };
    items.push({ serviceCatalogItemId: service.id, name: service.name, categoryName: service.category.name, proposalText: preserved.proposalTexts?.get(service.id) ?? service.proposalText, billingType: service.billingType, pricingMethod, billingCycle: service.billingCycle, quantity, pricingRateCents: unitCents, unitAmountCents: unitCents, totalAmountCents: quantity * unitCents, estimatedHours: pricingMethod === ServicePricingMethod.HOURLY ? quantity : null });
  }
  return { ok: true, items, subtotalCents: items.reduce((sum, item) => sum + item.totalAmountCents, 0) };
}

function applyDiscount(subtotalCents: number, discount?: QuoteDiscount) {
  if (discount?.percent !== undefined) {
    if (!Number.isFinite(discount.percent) || discount.percent < 0 || discount.percent > 100) return { error: "Desconto percentual entre 0 e 100." };
    const discountPercentBps = Math.round(discount.percent * 100);
    return { discountCents: Math.round((subtotalCents * discountPercentBps) / 10_000), discountPercentBps: discountPercentBps || null };
  }
  const discountCents = Math.round(discount?.amountCents ?? 0);
  if (discountCents < 0 || discountCents > subtotalCents) return { error: "O desconto não pode passar do subtotal." };
  return { discountCents, discountPercentBps: null };
}

const validity = (value?: string | null) => value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00.000Z`) : null;

export function newQuoteCode() {
  return `ORC-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
}

export async function createQuoteFromServices(input: { clientId: string; title: string; lines: QuoteLine[]; discount?: QuoteDiscount; validUntil?: string | null; terms?: string | null }) {
  const title = input.title.trim().slice(0, 180);
  if (!title) return { ok: false as const, error: "Dê um título ao orçamento." };
  const client = await prisma.client.findUnique({ where: { id: input.clientId.slice(0, 50) }, select: { id: true } });
  if (!client) return { ok: false as const, error: "Cliente não encontrado." };
  const built = await buildQuoteItems(input.lines);
  if (!built.ok) return built;
  const discount = applyDiscount(built.subtotalCents, input.discount);
  if ("error" in discount) return { ok: false as const, error: discount.error! };
  const amountCents = built.subtotalCents - discount.discountCents;
  if (amountCents < 1) return { ok: false as const, error: "O total do orçamento precisa ser maior que zero." };
  // Sem documentContent: o editor monta o documento com os blocos dos serviços na primeira abertura.
  const quote = await createQuote({ clientId: client.id, code: newQuoteCode(), title, scope: "Conteúdo da proposta definido no editor de PDF.", estimatedHours: 0, estimatedDays: 0, pricingMethod: "FIXED", pricingRateCents: null, amountCents, discountCents: discount.discountCents, discountPercentBps: discount.discountPercentBps, items: built.items, terms: input.terms?.trim().slice(0, 4_000) || null, validUntil: validity(input.validUntil) });
  return { ok: true as const, quote: { ...quote, subtotalCents: built.subtotalCents, discountCents: discount.discountCents, amountCents } };
}

/**
 * Troca os serviços (e o título, o desconto e a validade) de um orçamento ainda não concluído. Orçamentos concluídos
 * já estão com o cliente e não mudam por aqui. Os pagamentos registrados na proposta são mantidos.
 */
export async function updateQuoteServices(input: { quoteId: string; title?: string; lines: QuoteLine[]; discount?: QuoteDiscount; validUntil?: string | null }) {
  const quote = await prisma.quote.findUnique({ where: { id: input.quoteId.slice(0, 50) }, select: { id: true, clientId: true, title: true, completedAt: true, discountCents: true, discountPercentBps: true, items: { select: { serviceCatalogItemId: true, proposalText: true } }, payments: { select: { amountCents: true } } } });
  if (!quote) return { ok: false as const, error: "Orçamento não encontrado." };
  if (quote.completedAt) return { ok: false as const, error: "Este orçamento já foi concluído e enviado ao cliente. Altere pela tela do orçamento ou crie outro." };
  const preservedServiceIds = quote.items.map((item) => item.serviceCatalogItemId).filter((id): id is string => Boolean(id));
  const built = await buildQuoteItems(input.lines, { serviceIds: preservedServiceIds, proposalTexts: new Map(quote.items.flatMap((item) => item.serviceCatalogItemId ? [[item.serviceCatalogItemId, item.proposalText] as const] : [])) });
  if (!built.ok) return built;
  // Sem desconto informado, mantém o atual (o percentual é recalculado sobre o novo subtotal).
  const discount = applyDiscount(built.subtotalCents, input.discount ?? (quote.discountPercentBps !== null ? { percent: quote.discountPercentBps / 100 } : { amountCents: Math.min(quote.discountCents, built.subtotalCents) }));
  if ("error" in discount) return { ok: false as const, error: discount.error! };
  const amountCents = built.subtotalCents - discount.discountCents;
  if (amountCents < 1) return { ok: false as const, error: "O total do orçamento precisa ser maior que zero." };
  const paid = quote.payments.reduce((sum, payment) => sum + payment.amountCents, 0);
  if (paid > amountCents) return { ok: false as const, error: "O novo total ficaria abaixo do que já foi pago nesta proposta." };
  await prisma.quote.update({ where: { id: quote.id }, data: { title: input.title?.trim().slice(0, 180) || quote.title, amountCents, discountCents: discount.discountCents, discountPercentBps: discount.discountPercentBps, ...(input.validUntil !== undefined ? { validUntil: validity(input.validUntil) } : {}), items: { deleteMany: {}, create: built.items } } });
  await prisma.$transaction(async (tx) => {
    const entryId = await syncQuotePayments(tx, quote.id);
    if (entryId) await recalculateFinancialEntry(tx, entryId, { syncSale: true });
  });
  return { ok: true as const, quote: { id: quote.id, clientId: quote.clientId, subtotalCents: built.subtotalCents, discountCents: discount.discountCents, amountCents } };
}
