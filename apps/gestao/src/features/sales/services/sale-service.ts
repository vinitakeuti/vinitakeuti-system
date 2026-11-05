import { DocumentStatus, FinancialEntryOrigin, FinancialEntryStatus, FinancialEntryType, SaleOrigin, SaleStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { recalculateFinancialEntry } from "@/features/finance/services/finance-ledger";

/**
 * Regras de vendas usadas pelas telas e pela IA: confirmar a venda de uma proposta (gera a entrada no Financeiro),
 * marcar ou reabrir uma proposta que não virou venda e mudar a situação de uma venda. Devolvem um erro legível em vez de redirecionar.
 */

export function saleCode() {
  return `VEN-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
}

export type SaleResult<T> = ({ ok: true } & T) | { ok: false; error: string };

/** Proposta aceita: vira venda confirmada e entrada a receber (com os pagamentos já registrados na proposta). */
export async function confirmQuoteSale(quoteIdInput: string): Promise<SaleResult<{ quoteId: string; clientId: string; code: string }>> {
  const quoteId = quoteIdInput.slice(0, 50);
  const quote = await prisma.quote.findUnique({ where: { id: quoteId }, select: { id: true, code: true, clientId: true, title: true, scope: true, amountCents: true, status: true, completedAt: true, lostAt: true, client: { select: { name: true } }, sale: { select: { id: true } }, payments: { orderBy: [{ paidAt: "asc" }, { id: "asc" }], take: 50, select: { amountCents: true, paidAt: true } } } });
  if (!quote) return { ok: false, error: "Proposta não encontrada." };
  if (quote.sale) return { ok: false, error: "Esta proposta já tem uma venda." };
  if (quote.status !== DocumentStatus.DRAFT && quote.status !== DocumentStatus.SENT) return { ok: false, error: "Só propostas em rascunho ou enviadas podem ser confirmadas." };
  if (quote.lostAt) return { ok: false, error: "Esta proposta está marcada como não convertida. Reabra antes de confirmar." };

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.quote.update({ where: { id: quote.id }, data: { status: DocumentStatus.ACCEPTED, completedAt: quote.completedAt ?? now } });
    await tx.sale.create({ data: { clientId: quote.clientId, quoteId: quote.id, code: saleCode(), title: quote.title, description: quote.scope, amountCents: quote.amountCents, origin: SaleOrigin.QUOTE, status: SaleStatus.CONFIRMED, confirmedAt: now } });
    const existing = await tx.financialEntry.findUnique({ where: { sourceKey: `quote:${quote.id}` }, select: { id: true } });
    if (existing) return;
    // Os pagamentos já registrados na proposta entram como recebimentos; o restante fica a receber.
    const entry = await tx.financialEntry.create({ data: { sourceKey: `quote:${quote.id}`, origin: FinancialEntryOrigin.QUOTE, type: FinancialEntryType.INCOME, status: FinancialEntryStatus.PENDING, description: `${quote.code} · ${quote.title}`, category: "Vendas", counterparty: quote.client.name, clientId: quote.clientId, amountCents: quote.amountCents, dueDate: now, notes: "Entrada criada automaticamente na confirmação do orçamento.", payments: { create: quote.payments.map((payment) => ({ amountCents: payment.amountCents, paidAt: payment.paidAt, notes: "Registrado na proposta.", fromQuote: true })) } }, select: { id: true } });
    await recalculateFinancialEntry(tx, entry.id, { syncSale: true });
  });

  return { ok: true, quoteId: quote.id, clientId: quote.clientId, code: quote.code };
}

/** Proposta que não virou venda: sai de "Aguardando decisão" sem ser excluída, para entrar no total de não convertidos. */
export async function markQuoteLost(quoteIdInput: string): Promise<SaleResult<{ quoteId: string; clientId: string }>> {
  const quote = await prisma.quote.findUnique({ where: { id: quoteIdInput.slice(0, 50) }, select: { id: true, clientId: true, status: true, lostAt: true, sale: { select: { id: true } } } });
  if (!quote) return { ok: false, error: "Proposta não encontrada." };
  if (quote.sale) return { ok: false, error: "Esta proposta já tem uma venda." };
  if (quote.lostAt) return { ok: false, error: "Esta proposta já está marcada como não convertida." };
  if (quote.status !== DocumentStatus.DRAFT && quote.status !== DocumentStatus.SENT) return { ok: false, error: "Só propostas em aberto podem ser marcadas como não convertidas." };
  await prisma.quote.update({ where: { id: quote.id }, data: { lostAt: new Date() } });
  return { ok: true, quoteId: quote.id, clientId: quote.clientId };
}

/** Desfaz a marcação de não convertida: a proposta volta para "Aguardando decisão". */
export async function reopenLostQuote(quoteIdInput: string): Promise<SaleResult<{ quoteId: string; clientId: string }>> {
  const quote = await prisma.quote.findUnique({ where: { id: quoteIdInput.slice(0, 50) }, select: { id: true, clientId: true, lostAt: true } });
  if (!quote?.lostAt) return { ok: false, error: "Proposta não encontrada entre as não convertidas." };
  await prisma.quote.update({ where: { id: quote.id }, data: { lostAt: null } });
  return { ok: true, quoteId: quote.id, clientId: quote.clientId };
}

/** Muda a situação da venda; nas vendas de proposta, ajusta a proposta e a entrada no Financeiro junto. */
export async function changeSaleStatus(saleIdInput: string, nextStatus: SaleStatus): Promise<SaleResult<{ saleId: string; clientId: string; quoteId: string | null }>> {
  const saleId = saleIdInput.slice(0, 50);
  const sale = await prisma.sale.findUnique({ where: { id: saleId }, select: { id: true, clientId: true, quoteId: true, origin: true, code: true, title: true, amountCents: true, status: true, confirmedAt: true, client: { select: { name: true } }, quote: { select: { code: true } } } });
  if (!sale) return { ok: false, error: "Venda não encontrada." };
  const now = new Date();
  const confirmedAt = nextStatus === SaleStatus.PENDING ? null : sale.confirmedAt ?? now;
  const paidAt = nextStatus === SaleStatus.PAID ? now : null;

  await prisma.$transaction(async (tx) => {
    await tx.sale.update({ where: { id: sale.id }, data: { status: nextStatus, confirmedAt, paidAt } });
    if (sale.quoteId) {
      await tx.quote.update({ where: { id: sale.quoteId }, data: { status: nextStatus === SaleStatus.PENDING || nextStatus === SaleStatus.CANCELLED ? DocumentStatus.SENT : DocumentStatus.ACCEPTED } });
      if (nextStatus !== SaleStatus.CANCELLED) {
        // O valor esperado e os recebimentos editados no Financeiro são preservados; só o cancelamento é desfeito.
        const entry = await tx.financialEntry.upsert({ where: { sourceKey: `quote:${sale.quoteId}` }, update: { status: FinancialEntryStatus.PENDING }, create: { sourceKey: `quote:${sale.quoteId}`, origin: FinancialEntryOrigin.QUOTE, type: FinancialEntryType.INCOME, status: FinancialEntryStatus.PENDING, description: `${sale.quote?.code ?? sale.code} · ${sale.title}`, category: "Vendas", counterparty: sale.client.name, clientId: sale.clientId, amountCents: sale.amountCents, dueDate: sale.confirmedAt ?? now, notes: "Entrada criada automaticamente na confirmação do orçamento." }, select: { id: true, amountCents: true } });
        if (nextStatus === SaleStatus.PAID) {
          // Venda paga: o que ainda falta entra como um recebimento de quitação.
          const paid = await tx.financialPayment.aggregate({ where: { entryId: entry.id }, _sum: { amountCents: true } });
          const remaining = entry.amountCents - (paid._sum.amountCents ?? 0);
          if (remaining > 0) await tx.financialPayment.create({ data: { entryId: entry.id, amountCents: remaining, paidAt: now, notes: "Quitação registrada ao marcar a venda como paga.", fromSale: true } });
        } else {
          await tx.financialPayment.deleteMany({ where: { entryId: entry.id, fromSale: true } });
        }
        await recalculateFinancialEntry(tx, entry.id);
      } else {
        await tx.financialEntry.updateMany({ where: { sourceKey: `quote:${sale.quoteId}` }, data: { status: FinancialEntryStatus.CANCELLED, settledAt: null } });
      }
    }
  });

  return { ok: true, saleId: sale.id, clientId: sale.clientId, quoteId: sale.quoteId };
}
