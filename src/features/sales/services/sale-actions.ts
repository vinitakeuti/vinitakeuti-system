"use server";

import { DocumentStatus, FinancialEntryOrigin, FinancialEntryStatus, FinancialEntryType, SaleOrigin, SaleStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

function text(formData: FormData, name: string, max: number) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function amountToCents(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

function saleCode() {
  return `VEN-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
}

export async function confirmQuoteSaleAction(formData: FormData) {
  const quoteId = text(formData, "quoteId", 50);
  if (!quoteId) redirect("/vendas");

  const quote = await prisma.quote.findUnique({ where: { id: quoteId }, select: { id: true, code: true, clientId: true, title: true, scope: true, amountCents: true, status: true, completedAt: true, client: { select: { name: true } }, sale: { select: { id: true } } } });
  if (!quote || quote.sale || (quote.status !== DocumentStatus.DRAFT && quote.status !== DocumentStatus.SENT)) redirect("/vendas");

  const now = new Date();
  await prisma.$transaction([
    prisma.quote.update({ where: { id: quote.id }, data: { status: DocumentStatus.ACCEPTED, completedAt: quote.completedAt ?? now } }),
    prisma.sale.create({ data: { clientId: quote.clientId, quoteId: quote.id, code: saleCode(), title: quote.title, description: quote.scope, amountCents: quote.amountCents, origin: SaleOrigin.QUOTE, status: SaleStatus.CONFIRMED, confirmedAt: now } }),
    prisma.financialEntry.upsert({ where: { sourceKey: `quote:${quote.id}` }, update: {}, create: { sourceKey: `quote:${quote.id}`, origin: FinancialEntryOrigin.QUOTE, type: FinancialEntryType.INCOME, status: FinancialEntryStatus.PENDING, description: `${quote.code} · ${quote.title}`, category: "Vendas", counterparty: quote.client.name, amountCents: quote.amountCents, dueDate: now, notes: "Entrada criada automaticamente na confirmação do orçamento." } }),
  ]);

  revalidatePath("/vendas");
  revalidatePath("/financeiro");
  revalidatePath("/orcamentos/pendentes");
  revalidatePath(`/orcamentos/${quote.id}`);
  revalidatePath(`/clientes/${quote.clientId}`);
  redirect("/vendas?confirmed=1");
}

export async function createDirectSaleAction(formData: FormData) {
  const clientId = text(formData, "clientId", 50);
  const title = text(formData, "title", 180);
  const amountCents = amountToCents(text(formData, "amount", 20));
  const statusValue = text(formData, "status", 20);
  const status = statusValue === SaleStatus.PENDING || statusValue === SaleStatus.PAID ? statusValue : SaleStatus.CONFIRMED;
  const errorHref = `/vendas/nova?clientId=${encodeURIComponent(clientId)}&error=Preencha%20os%20dados%20da%20venda.`;
  if (!clientId || !title || amountCents < 1) redirect(errorHref);

  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!client) redirect("/vendas/nova");

  const now = new Date();
  await prisma.sale.create({ data: { clientId: client.id, code: saleCode(), title, description: text(formData, "description", 4_000) || null, amountCents, origin: SaleOrigin.DIRECT, status, confirmedAt: status === SaleStatus.PENDING ? null : now, paidAt: status === SaleStatus.PAID ? now : null } });
  revalidatePath("/vendas");
  revalidatePath(`/clientes/${client.id}`);
  redirect("/vendas?created=1");
}

export async function deletePendingSaleAction(formData: FormData) {
  const saleId = text(formData, "saleId", 50);
  if (!saleId) redirect("/vendas");
  const sale = await prisma.sale.findUnique({ where: { id: saleId }, select: { id: true, clientId: true, status: true } });
  if (!sale || sale.status !== SaleStatus.PENDING) redirect("/vendas");
  await prisma.sale.delete({ where: { id: sale.id } });
  revalidatePath("/vendas");
  revalidatePath(`/clientes/${sale.clientId}`);
  redirect("/vendas?saleDeleted=1");
}

export async function updateSaleStatusAction(formData: FormData) {
  const saleId = text(formData, "saleId", 50);
  const nextStatusValue = text(formData, "status", 20);
  const nextStatus = Object.values(SaleStatus).includes(nextStatusValue as SaleStatus) ? nextStatusValue as SaleStatus : null;
  if (!saleId || !nextStatus) redirect("/vendas");

  const sale = await prisma.sale.findUnique({ where: { id: saleId }, select: { id: true, clientId: true, quoteId: true, origin: true, code: true, title: true, amountCents: true, status: true, confirmedAt: true, client: { select: { name: true } }, quote: { select: { code: true } } } });
  if (!sale) redirect("/vendas");
  const now = new Date();
  const confirmedAt = nextStatus === SaleStatus.PENDING ? null : sale.confirmedAt ?? now;
  const paidAt = nextStatus === SaleStatus.PAID ? now : null;

  await prisma.$transaction(async (tx) => {
    await tx.sale.update({ where: { id: sale.id }, data: { status: nextStatus, confirmedAt, paidAt } });
    if (sale.quoteId) {
      await tx.quote.update({ where: { id: sale.quoteId }, data: { status: nextStatus === SaleStatus.PENDING || nextStatus === SaleStatus.CANCELLED ? DocumentStatus.SENT : DocumentStatus.ACCEPTED } });
      if (nextStatus !== SaleStatus.CANCELLED) {
        await tx.financialEntry.upsert({ where: { sourceKey: `quote:${sale.quoteId}` }, update: { status: nextStatus === SaleStatus.PAID ? FinancialEntryStatus.SETTLED : FinancialEntryStatus.PENDING, settledAt: nextStatus === SaleStatus.PAID ? now : null, amountCents: sale.amountCents }, create: { sourceKey: `quote:${sale.quoteId}`, origin: FinancialEntryOrigin.QUOTE, type: FinancialEntryType.INCOME, status: nextStatus === SaleStatus.PAID ? FinancialEntryStatus.SETTLED : FinancialEntryStatus.PENDING, description: `${sale.quote?.code ?? sale.code} · ${sale.title}`, category: "Vendas", counterparty: sale.client.name, amountCents: sale.amountCents, dueDate: sale.confirmedAt ?? now, settledAt: nextStatus === SaleStatus.PAID ? now : null, notes: "Entrada criada automaticamente na confirmação do orçamento." } });
      } else {
        await tx.financialEntry.updateMany({ where: { sourceKey: `quote:${sale.quoteId}` }, data: { status: FinancialEntryStatus.CANCELLED, settledAt: null } });
      }
    }
  });

  revalidatePath("/vendas");
  revalidatePath("/financeiro");
  if (sale.quoteId) revalidatePath(`/orcamentos/${sale.quoteId}`);
  revalidatePath(`/clientes/${sale.clientId}`);
  redirect("/vendas?saleUpdated=1");
}

export async function deleteSaleAction(formData: FormData) {
  const saleId = text(formData, "saleId", 50);
  if (!saleId) redirect("/vendas");
  const sale = await prisma.sale.findUnique({ where: { id: saleId }, select: { id: true, clientId: true, quoteId: true, status: true } });
  if (!sale || (sale.status !== SaleStatus.PENDING && sale.status !== SaleStatus.CONFIRMED)) redirect("/vendas");

  await prisma.$transaction(async (tx) => {
    await tx.sale.delete({ where: { id: sale.id } });
    if (sale.quoteId) {
      await tx.financialEntry.deleteMany({ where: { sourceKey: `quote:${sale.quoteId}` } });
      await tx.quote.update({ where: { id: sale.quoteId }, data: { status: DocumentStatus.SENT } });
    }
  });
  revalidatePath("/vendas");
  revalidatePath("/financeiro");
  if (sale.quoteId) revalidatePath(`/orcamentos/${sale.quoteId}`);
  revalidatePath(`/clientes/${sale.clientId}`);
  redirect("/vendas?saleDeleted=1");
}
