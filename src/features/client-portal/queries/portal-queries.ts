import { cache } from "react";
import { FinancialEntryStatus, FinancialEntryType, Prisma, ProjectStatus, SaleStatus, SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isAsaasConfigured } from "@/lib/asaas";
import { requireClientUser } from "@/features/auth/services/auth-session";
import { allocateInstallments, installmentPaidDates, MAX_INSTALLMENTS } from "@/features/finance/services/installments";
import { MAX_FINANCIAL_PAYMENTS } from "@/features/finance/services/finance-ledger";

/**
 * Consultas da área do cliente. Tudo é filtrado pelo cliente da sessão: os lançamentos do Financeiro não têm
 * clientId, então são encontrados pelas propostas do cliente (sourceKey "quote:<id>").
 */

const MAX_QUOTES = 200;
const MAX_ITEMS = 50;
const DAY_MS = 24 * 60 * 60 * 1000;
export const PORTAL_PAGE_SIZE = 50;

/** Início de hoje no fuso da operação: parcelas com vencimento antes disso estão em atraso. */
export function portalTodayStart(now = new Date()) {
  const today = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Maceio" }).format(now);
  return new Date(`${today}T00:00:00.000-03:00`);
}

async function clientQuoteKeys(clientId: string) {
  const quotes = await prisma.quote.findMany({ where: { clientId, sale: { isNot: null } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: MAX_QUOTES, select: { id: true } });
  return quotes.map((quote) => `quote:${quote.id}`);
}

/** O lançamento pertence ao cliente? (proposta de origem do cliente). Devolve o id da proposta. */
export async function clientOwnsEntry(clientId: string, sourceKey: string | null) {
  const quoteId = sourceKey?.startsWith("quote:") ? sourceKey.slice("quote:".length) : null;
  if (!quoteId) return false;
  return (await prisma.quote.count({ where: { id: quoteId, clientId } })) > 0;
}

export type PortalInstallment = { entryId: string; entryDescription: string; number: number | null; total: number; dueDate: Date; amountCents: number; paid: number; remaining: number; state: "paid" | "partial" | "open"; overdue: boolean; paidOn: Date | null };

const entrySelect = {
  id: true, description: true, amountCents: true, paidCents: true, dueDate: true, status: true, paymentCondition: true, sourceKey: true,
  installments: { orderBy: { number: "asc" }, take: MAX_INSTALLMENTS, select: { number: true, dueDate: true, amountCents: true } },
  payments: { orderBy: [{ paidAt: "asc" }, { id: "asc" }], take: MAX_FINANCIAL_PAYMENTS, select: { amountCents: true, paidAt: true } },
} satisfies Prisma.FinancialEntrySelect;

type EntryRow = { id: string; description: string; amountCents: number; paidCents: number; dueDate: Date; paymentCondition: string | null; installments: Array<{ number: number; dueDate: Date; amountCents: number }>; payments: Array<{ amountCents: number; paidAt: Date }> };

/** Parcelas do lançamento com o que já foi pago em cada uma. Sem parcelas, o lançamento vence de uma vez. */
export function entrySchedule(entry: EntryRow, todayStart = portalTodayStart()): PortalInstallment[] {
  const plan = entry.installments.length ? entry.installments : [{ number: 0, dueDate: entry.dueDate, amountCents: entry.amountCents }];
  const paidDates = installmentPaidDates(plan, entry.payments);
  return allocateInstallments(plan, entry.paidCents).map((installment) => ({
    entryId: entry.id,
    entryDescription: entry.description,
    number: entry.installments.length ? installment.number : null,
    total: entry.installments.length,
    dueDate: installment.dueDate,
    amountCents: installment.amountCents,
    paid: installment.paid,
    remaining: installment.remaining,
    state: installment.state,
    overdue: installment.remaining > 0 && installment.dueDate < todayStart,
    paidOn: installment.state === "paid" ? paidDates.get(installment.number) ?? null : null,
  }));
}

async function loadReceivables(clientId: string) {
  const keys = await clientQuoteKeys(clientId);
  if (!keys.length) return { entries: [], open: [], overdue: { count: 0, amountCents: 0, oldest: null as Date | null }, dueSoon: [], totals: { contractedCents: 0, paidCents: 0, remainingCents: 0 } };
  const rows = await prisma.financialEntry.findMany({
    where: { sourceKey: { in: keys }, type: FinancialEntryType.INCOME, status: { not: FinancialEntryStatus.CANCELLED } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: MAX_QUOTES,
    select: entrySelect,
  });
  const todayStart = portalTodayStart();
  const entries = rows.map((entry) => ({ ...entry, schedule: entrySchedule(entry, todayStart) }));
  const open = entries.flatMap((entry) => entry.schedule.filter((installment) => installment.remaining > 0)).sort((left, right) => left.dueDate.getTime() - right.dueDate.getTime() || left.entryId.localeCompare(right.entryId) || (left.number ?? 0) - (right.number ?? 0));
  const late = open.filter((installment) => installment.overdue);
  const soonLimit = new Date(todayStart.getTime() + 8 * DAY_MS);
  return {
    entries,
    open,
    overdue: { count: late.length, amountCents: late.reduce((sum, installment) => sum + installment.remaining, 0), oldest: late[0]?.dueDate ?? null },
    dueSoon: open.filter((installment) => !installment.overdue && installment.dueDate < soonLimit),
    totals: {
      contractedCents: entries.reduce((sum, entry) => sum + entry.amountCents, 0),
      paidCents: entries.reduce((sum, entry) => sum + Math.min(entry.paidCents, entry.amountCents), 0),
      remainingCents: open.reduce((sum, installment) => sum + installment.remaining, 0),
    },
  };
}

/**
 * Dados comuns a todas as páginas do portal (sessão, cliente e situação dos pagamentos, para o alerta de atraso).
 * `cache` evita repetir as consultas entre a página e a moldura dentro da mesma requisição.
 */
export const getPortalContext = cache(async () => {
  const user = await requireClientUser();
  const clientId = user.clientId!;
  const [client, receivables] = await Promise.all([
    prisma.client.findUnique({ where: { id: clientId }, select: { id: true, name: true, company: true, email: true, document: true, phone: true } }),
    loadReceivables(clientId),
  ]);
  return { user, clientId, client, receivables };
});

export type PortalContext = Awaited<ReturnType<typeof getPortalContext>>;

/** Histórico de pagamentos do cliente, mais recentes primeiro, paginado por cursor. */
export async function listPortalPayments(entryIds: string[], { cursor, take = PORTAL_PAGE_SIZE }: { cursor?: string; take?: number } = {}) {
  if (!entryIds.length) return { data: [], nextCursor: null };
  const rows = await prisma.financialPayment.findMany({
    where: { entryId: { in: entryIds } },
    orderBy: [{ paidAt: "desc" }, { id: "desc" }],
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor.slice(0, 40) }, skip: 1 } : {}),
    select: { id: true, amountCents: true, paidAt: true, chargeId: true, entry: { select: { description: true } } },
  });
  const data = rows.slice(0, take);
  return { data, nextCursor: rows.length > take ? data.at(-1)!.id : null };
}

/** Avisos de pagamento ainda não conferidos, por lançamento e parcela. */
export async function listPendingNotices(clientId: string) {
  return prisma.paymentNotice.findMany({ where: { clientId, status: "PENDING" }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 50, select: { id: true, financialEntryId: true, installmentNumber: true, amountCents: true, paidOn: true, createdAt: true } });
}

/** Como o cliente paga: online pelo Asaas, ou Pix e instruções do perfil profissional. */
export async function getPortalPaymentOptions() {
  const [online, profile] = await Promise.all([
    isAsaasConfigured(),
    prisma.professionalProfile.findUnique({ where: { id: "default" }, select: { name: true, email: true, phone: true, website: true, pixKey: true, paymentInstructions: true } }),
  ]);
  return { online, profile };
}

export async function getPortalServices(clientId: string) {
  const [sales, subscriptions, projects, systems] = await Promise.all([
    prisma.sale.findMany({
      where: { clientId, status: { in: [SaleStatus.CONFIRMED, SaleStatus.PAID] } },
      orderBy: [{ confirmedAt: "desc" }, { id: "desc" }],
      take: MAX_ITEMS,
      select: { id: true, code: true, title: true, status: true, amountCents: true, confirmedAt: true, createdAt: true, quote: { select: { code: true, items: { orderBy: { createdAt: "asc" }, take: MAX_ITEMS, select: { id: true, name: true, categoryName: true, billingType: true, billingCycle: true, quantity: true } } } } },
    }),
    prisma.subscription.findMany({ where: { clientId, status: { not: SubscriptionStatus.CANCELLED } }, orderBy: [{ startedAt: "desc" }, { id: "desc" }], take: MAX_ITEMS, select: { id: true, name: true, amountCents: true, billingCycle: true, status: true, nextPaymentAt: true, startedAt: true } }),
    prisma.project.findMany({ where: { clientId, status: { notIn: [ProjectStatus.LEAD, ProjectStatus.CANCELLED] } }, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take: MAX_ITEMS, select: { id: true, name: true, description: true, status: true, startedAt: true, deliveryAt: true } }),
    prisma.monitoredApp.findMany({ where: { clientId }, orderBy: [{ name: "asc" }, { id: "asc" }], take: 20, select: { id: true, name: true, url: true, status: true, lastCheckedAt: true } }),
  ]);
  return { sales, subscriptions, projects, systems };
}

const latestSignedCopy = { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1, select: { id: true, createdAt: true, signatureDetected: true } } satisfies Prisma.Quote$signedCopiesArgs;

/** Propostas e documentos concluídos do cliente (os rascunhos não aparecem), com a última via assinada enviada. */
export async function getPortalDocuments(clientId: string, take = MAX_ITEMS) {
  const [quotes, documents] = await Promise.all([
    prisma.quote.findMany({ where: { clientId, completedAt: { not: null } }, orderBy: [{ completedAt: "desc" }, { id: "desc" }], take, select: { id: true, code: true, title: true, completedAt: true, signedCopies: latestSignedCopy } }),
    prisma.clientDocument.findMany({ where: { clientId, completedAt: { not: null } }, orderBy: [{ completedAt: "desc" }, { id: "desc" }], take, select: { id: true, code: true, title: true, kind: true, completedAt: true, signedCopies: latestSignedCopy } }),
  ]);
  return [
    ...quotes.map((quote) => ({ id: quote.id, code: quote.code, title: quote.title, kind: "PROPOSAL" as const, target: "proposal" as const, completedAt: quote.completedAt!, href: `/api/portal/propostas/${quote.id}/pdf`, signed: quote.signedCopies[0] ?? null })),
    ...documents.map((document) => ({ id: document.id, code: document.code, title: document.title, kind: document.kind, target: "document" as const, completedAt: document.completedAt!, href: `/api/portal/documentos/${document.id}/pdf`, signed: document.signedCopies[0] ?? null })),
  ].sort((left, right) => right.completedAt.getTime() - left.completedAt.getTime()).slice(0, take);
}
