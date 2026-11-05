"use server";

import { DocumentStatus, SaleOrigin, SaleStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireManagementUser } from "@/features/auth/services/auth-session";
import { changeSaleStatus, confirmQuoteSale, markQuoteLost, reopenLostQuote, saleCode } from "@/features/sales/services/sale-service";

function text(formData: FormData, name: string, max: number) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function amountToCents(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}


export async function confirmQuoteSaleAction(formData: FormData) {
  await requireManagementUser();
  const quoteId = text(formData, "quoteId", 50);
  if (!quoteId) redirect("/vendas");
  const result = await confirmQuoteSale(quoteId);
  if (!result.ok) redirect("/vendas");

  revalidatePath("/vendas");
  revalidatePath("/financeiro");
  revalidatePath("/orcamentos/pendentes");
  revalidatePath(`/orcamentos/${result.quoteId}`);
  revalidatePath(`/clientes/${result.clientId}`);
  redirect("/vendas?confirmed=1");
}

export async function markQuoteLostAction(formData: FormData) {
  await requireManagementUser();
  const result = await markQuoteLost(text(formData, "quoteId", 50));
  if (!result.ok) redirect("/vendas");
  revalidatePath("/vendas");
  revalidatePath(`/clientes/${result.clientId}`);
  redirect("/vendas?quoteLost=1");
}

export async function reopenLostQuoteAction(formData: FormData) {
  await requireManagementUser();
  const result = await reopenLostQuote(text(formData, "quoteId", 50));
  if (!result.ok) redirect("/vendas");
  revalidatePath("/vendas");
  revalidatePath(`/clientes/${result.clientId}`);
  redirect("/vendas?quoteReopened=1");
}

export async function createDirectSaleAction(formData: FormData) {
  await requireManagementUser();
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
  await requireManagementUser();
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
  await requireManagementUser();
  const saleId = text(formData, "saleId", 50);
  const nextStatusValue = text(formData, "status", 20);
  const nextStatus = Object.values(SaleStatus).includes(nextStatusValue as SaleStatus) ? nextStatusValue as SaleStatus : null;
  if (!saleId || !nextStatus) redirect("/vendas");
  const result = await changeSaleStatus(saleId, nextStatus);
  if (!result.ok) redirect("/vendas");

  revalidatePath("/vendas");
  revalidatePath("/financeiro");
  if (result.quoteId) revalidatePath(`/orcamentos/${result.quoteId}`);
  revalidatePath(`/clientes/${result.clientId}`);
  redirect("/vendas?saleUpdated=1");
}

export async function deleteSaleAction(formData: FormData) {
  await requireManagementUser();
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
