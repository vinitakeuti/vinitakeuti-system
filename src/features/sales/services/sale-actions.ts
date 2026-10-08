"use server";

import { DocumentStatus, SaleOrigin, SaleStatus } from "@prisma/client";
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

  const quote = await prisma.quote.findUnique({ where: { id: quoteId }, select: { id: true, clientId: true, title: true, scope: true, amountCents: true, status: true, sale: { select: { id: true } } } });
  if (!quote || quote.sale || (quote.status !== DocumentStatus.DRAFT && quote.status !== DocumentStatus.SENT)) redirect("/vendas");

  await prisma.$transaction([
    prisma.quote.update({ where: { id: quote.id }, data: { status: DocumentStatus.ACCEPTED } }),
    prisma.sale.create({ data: { clientId: quote.clientId, quoteId: quote.id, code: saleCode(), title: quote.title, description: quote.scope, amountCents: quote.amountCents, origin: SaleOrigin.QUOTE, status: SaleStatus.CONFIRMED, confirmedAt: new Date() } }),
  ]);

  revalidatePath("/vendas");
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
