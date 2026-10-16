"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createQuote } from "@/features/quotes/services/create-quote";
import { createDefaultQuoteDocument, QUOTE_DOCUMENT_MAX_JSON_LENGTH } from "@/features/quotes/types/document-content";
import { saveQuoteDocument } from "@/features/quotes/services/quote-document-service";
import { parseQuotePayments } from "@/features/quotes/schemas/quote-payments";

function text(formData: FormData, name: string, max: number) { const value = formData.get(name); return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function amountToCents(value: string) { const parsed = Number(value.replace(",", ".")); return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0; }
function withError(href: string, message: string) { return `${href}${href.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}`; }

function revalidateQuoteLists(quoteId: string, clientId: string) {
  revalidatePath("/orcamentos");
  revalidatePath("/orcamentos/pendentes");
  revalidatePath("/vendas");
  revalidatePath(`/orcamentos/${quoteId}`);
  revalidatePath(`/clientes/${clientId}`);
}

async function quoteItemsFromForm(formData: FormData, errorHref: string, preservedServiceIds: string[] = [], preservedProposalTexts = new Map<string, string | null>()) {
  const ids = formData.getAll("serviceId").map((value) => typeof value === "string" ? value.slice(0, 50) : "").filter(Boolean);
  const pricingMethods = formData.getAll("servicePricingMethod").map((value) => typeof value === "string" ? value : "");
  const quantities = formData.getAll("serviceQuantity").map((value) => Number(value));
  const rates = formData.getAll("serviceRate").map((value) => amountToCents(String(value)));
  const validPricingMethods = new Set(["FIXED", "HOURLY", "DAILY", "CUSTOM"]);
  const invalidItems = ids.length < 1 || ids.length > 50 || ids.length !== quantities.length || ids.length !== rates.length || ids.length !== pricingMethods.length || new Set(ids).size !== ids.length || quantities.some((value) => !Number.isInteger(value) || value < 1 || value > 10_000) || rates.some((value) => value < 0) || pricingMethods.some((value) => !validPricingMethods.has(value));
  if (invalidItems) redirect(errorHref);
  const services = await prisma.serviceCatalogItem.findMany({ where: { id: { in: ids }, OR: [{ isActive: true }, { id: { in: preservedServiceIds } }] }, take: 50, select: { id: true, name: true, proposalText: true, billingType: true, billingCycle: true, estimatedHours: true, category: { select: { name: true } } } });
  if (services.length !== ids.length) redirect(errorHref);
  const byId = new Map(services.map((service) => [service.id, service]));
  const items = ids.map((id, index) => {
    const service = byId.get(id)!;
    const quantity = quantities[index];
    const pricingRateCents = rates[index];
    const pricingMethod = pricingMethods[index] as "FIXED" | "HOURLY" | "DAILY" | "CUSTOM";
    return { serviceCatalogItemId: service.id, name: service.name, categoryName: service.category.name, proposalText: preservedProposalTexts.get(service.id) ?? service.proposalText, billingType: service.billingType, pricingMethod, billingCycle: service.billingCycle, quantity, pricingRateCents, unitAmountCents: pricingRateCents, totalAmountCents: quantity * pricingRateCents, estimatedHours: pricingMethod === "HOURLY" ? quantity : null };
  });
  const subtotalCents = items.reduce((total, item) => total + item.totalAmountCents, 0);
  return { items, subtotalCents };
}

/** Desconto fixo em centavos ou percentual em pontos-base; o valor em centavos é sempre recalculado no servidor. */
function discountFromForm(formData: FormData, subtotalCents: number, errorHref: string) {
  if (text(formData, "discountType", 10) === "percent") {
    const percent = Number(text(formData, "discountPercent", 10).replace(",", ".") || "0");
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) redirect(errorHref);
    const discountPercentBps = Math.round(percent * 100);
    return { discountCents: Math.round((subtotalCents * discountPercentBps) / 10_000), discountPercentBps: discountPercentBps || null };
  }
  const discountCents = amountToCents(text(formData, "discountAmount", 20));
  if (discountCents < 0 || discountCents > subtotalCents) redirect(errorHref);
  return { discountCents, discountPercentBps: null };
}

export async function createQuoteAction(formData: FormData) {
  const clientId = text(formData, "clientId", 40);
  const title = text(formData, "title", 180);
  const invalidBase = !clientId || !title;
  const errorHref = `/orcamentos/novo?clientId=${clientId}&error=Preencha%20os%20dados%20e%20selecione%20ao%20menos%20um%20servi%C3%A7o.`;
  if (invalidBase) redirect(errorHref);
  const { items, subtotalCents } = await quoteItemsFromForm(formData, errorHref);
  if (subtotalCents < 1) redirect(errorHref);
  const { discountCents, discountPercentBps } = discountFromForm(formData, subtotalCents, errorHref);
  const amountCents = subtotalCents - discountCents;
  const paymentResult = parseQuotePayments(formData, amountCents);
  if (!paymentResult.ok) redirect(withError(`/orcamentos/novo?clientId=${encodeURIComponent(clientId)}`, paymentResult.error));
  const { payments, paymentNotes } = paymentResult;
  const validUntilRaw = text(formData, "validUntil", 10);
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { name: true } });
  if (!client) redirect("/orcamentos/novo?error=Cliente%20n%C3%A3o%20encontrado.");
  const quote = await createQuote({ clientId, code: `ORC-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`, title, scope: "Conteúdo da proposta definido no editor de PDF.", estimatedHours: 0, estimatedDays: 0, pricingMethod: "FIXED", pricingRateCents: null, amountCents, discountCents, discountPercentBps, items, documentContent: createDefaultQuoteDocument({ title, clientName: client.name }), terms: text(formData, "terms", 4_000) || null, validUntil: validUntilRaw ? new Date(`${validUntilRaw}T12:00:00.000Z`) : null, payments, paymentNotes });
  revalidateQuoteLists(quote.id, clientId);
  redirect(`/orcamentos/${quote.id}/editor`);
}

export async function updateQuoteDocumentAction(formData: FormData) {
  const quoteId = text(formData, "quoteId", 50);
  // O documento é lido inteiro: cortar o JSON no meio o tornaria inválido e o conteúdo seria perdido.
  const rawField = formData.get("documentContent");
  const serializedDocument = typeof rawField === "string" ? rawField : "";
  if (!quoteId || !serializedDocument) redirect("/orcamentos");
  if (serializedDocument.length > QUOTE_DOCUMENT_MAX_JSON_LENGTH) redirect(`/orcamentos/${quoteId}/editor?error=${encodeURIComponent("O documento ficou grande demais para salvar.")}`);
  let rawDocument: unknown;
  try {
    rawDocument = JSON.parse(serializedDocument);
  } catch {
    redirect(`/orcamentos/${quoteId}/editor?error=O%20conte%C3%BAdo%20do%20documento%20n%C3%A3o%20%C3%A9%20v%C3%A1lido.`);
  }
  const intent = text(formData, "intent", 20);
  const complete = intent === "complete";
  const result = await saveQuoteDocument(quoteId, rawDocument, { complete, cleanImages: true });
  if (!result.ok) redirect("/orcamentos");
  const quote = result.quote;
  revalidateQuoteLists(quote.id, quote.clientId);
  revalidatePath(`/orcamentos/${quote.id}/editor`);
  // Ir ao texto padrão a partir do editor salva o documento antes, e a página de destino oferece o retorno ao PDF.
  if (intent === "template") redirect(`/orcamentos/texto-padrao?orcamento=${quote.id}`);
  redirect(complete ? `/orcamentos/${quote.id}?concluido=1` : `/orcamentos/${quote.id}/editor?salvo=1`);
}

/** Conclui o orçamento sem alterar o documento; usado na página de detalhe. */
export async function completeQuoteAction(formData: FormData) {
  const quoteId = text(formData, "quoteId", 50);
  if (!quoteId) redirect("/orcamentos/pendentes");
  const quote = await prisma.quote.findUnique({ where: { id: quoteId }, select: { id: true, clientId: true } });
  if (!quote) redirect("/orcamentos/pendentes");
  await prisma.quote.updateMany({ where: { id: quote.id, completedAt: null }, data: { completedAt: new Date() } });
  revalidateQuoteLists(quote.id, quote.clientId);
  redirect(`/orcamentos/${quote.id}?concluido=1`);
}

export async function updateQuoteAction(formData: FormData) {
  const quoteId = text(formData, "quoteId", 50);
  const clientId = text(formData, "clientId", 50);
  if (!quoteId || !clientId) redirect("/orcamentos");
  const title = text(formData, "title", 180);
  const errorHref = `/orcamentos/${quoteId}/editar?error=Preencha%20os%20dados%20e%20mantenha%20ao%20menos%20um%20servi%C3%A7o.`;
  if (!title) redirect(errorHref);
  const quote = await prisma.quote.findUnique({ where: { id: quoteId }, select: { clientId: true, items: { select: { serviceCatalogItemId: true, proposalText: true } } } });
  if (!quote || quote.clientId !== clientId) redirect("/orcamentos");
  const preservedServiceIds = quote.items.map((item) => item.serviceCatalogItemId).filter((id): id is string => Boolean(id));
  const preservedProposalTexts = new Map(quote.items.flatMap((item) => item.serviceCatalogItemId ? [[item.serviceCatalogItemId, item.proposalText] as const] : []));
  const { items, subtotalCents } = await quoteItemsFromForm(formData, errorHref, preservedServiceIds, preservedProposalTexts);
  if (subtotalCents < 1) redirect(errorHref);
  const { discountCents, discountPercentBps } = discountFromForm(formData, subtotalCents, errorHref);
  const amountCents = subtotalCents - discountCents;
  const paymentResult = parseQuotePayments(formData, amountCents);
  if (!paymentResult.ok) redirect(withError(`/orcamentos/${quoteId}/editar`, paymentResult.error));
  const { payments, paymentNotes } = paymentResult;
  const validUntilRaw = text(formData, "validUntil", 10);
  await prisma.quote.update({ where: { id: quoteId }, data: { title, estimatedHours: 0, estimatedDays: 0, pricingMethod: "FIXED", pricingRateCents: null, amountCents, discountCents, discountPercentBps, terms: text(formData, "terms", 4_000) || null, validUntil: validUntilRaw ? new Date(`${validUntilRaw}T12:00:00.000Z`) : null, paymentNotes, items: { deleteMany: {}, create: items }, payments: { deleteMany: {}, create: payments } } });
  revalidateQuoteLists(quoteId, clientId);
  redirect(`/orcamentos/${quoteId}`);
}

export async function deleteQuoteAction(formData: FormData) {
  const quoteId = text(formData, "quoteId", 50);
  if (!quoteId) redirect("/orcamentos");
  const quote = await prisma.quote.findUnique({ where: { id: quoteId }, select: { id: true, clientId: true } });
  if (!quote) redirect("/orcamentos");
  await prisma.quote.delete({ where: { id: quote.id } });
  revalidatePath("/orcamentos");
  revalidatePath("/orcamentos/pendentes");
  revalidatePath("/vendas");
  revalidatePath(`/clientes/${quote.clientId}`);
  redirect(text(formData, "returnTo", 20) === "pending" ? "/orcamentos/pendentes?excluido=1" : "/vendas?quoteDeleted=1");
}
