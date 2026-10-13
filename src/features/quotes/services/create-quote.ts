import { DocumentStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { QuotePaymentInput } from "@/features/quotes/schemas/quote-payments";

type QuoteServiceItemInput = {
  serviceCatalogItemId: string;
  name: string;
  categoryName: string;
  proposalText?: string | null;
  billingType: "ONE_TIME" | "RECURRING";
  pricingMethod: "FIXED" | "HOURLY" | "DAILY" | "CUSTOM";
  billingCycle?: string | null;
  quantity: number;
  pricingRateCents?: number | null;
  unitAmountCents: number;
  totalAmountCents: number;
  estimatedHours?: number | null;
};

export type CreateQuoteInput = {
  clientId: string;
  code: string;
  title: string;
  scope: string;
  estimatedHours: number;
  estimatedDays: number;
  pricingMethod?: "FIXED" | "HOURLY" | "DAILY";
  pricingRateCents?: number | null;
  amountCents: number;
  discountCents?: number;
  discountPercentBps?: number | null;
  costCents?: number | null;
  documentContent?: Prisma.InputJsonValue;
  terms?: string | null;
  validUntil?: Date | null;
  items: QuoteServiceItemInput[];
  payments?: QuotePaymentInput[];
  paymentNotes?: string | null;
};

/**
 * Todo orçamento pertence a um perfil de cliente e fica acessível por ele.
 * Nasce pendente de conclusão até ser concluído no editor do documento.
 */
export async function createQuote(input: CreateQuoteInput) {
  if (!input.clientId) throw new Error("Selecione um cliente antes de gerar um orçamento.");
  const { items, payments = [], ...quote } = input;
  return prisma.quote.create({
    data: { ...quote, status: DocumentStatus.DRAFT, completedAt: null, items: { create: items }, payments: { create: payments } },
    select: { id: true, clientId: true, code: true },
  });
}
