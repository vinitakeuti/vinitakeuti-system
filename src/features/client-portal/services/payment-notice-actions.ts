"use server";

import { FinancialEntryStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireManagementUser } from "@/features/auth/services/auth-session";
import { recalculateFinancialEntry } from "@/features/finance/services/finance-ledger";
import { logEvent } from "@/features/system-logs/services/system-log";

/**
 * Avisos de pagamento enviados pelo cliente no portal. REGISTRAR lança o valor e a data informados como recebimento
 * do lançamento; DESCARTAR fecha o aviso sem mexer no Financeiro (pagamento não encontrado, aviso repetido).
 */
async function pendingNotice(formData: FormData) {
  const id = formData.get("noticeId");
  if (typeof id !== "string" || !id || id.length > 40) return null;
  return prisma.paymentNotice.findFirst({ where: { id, status: "PENDING" }, select: { id: true, financialEntryId: true, amountCents: true, paidOn: true, message: true, client: { select: { name: true } } } });
}

export async function registerPaymentNoticeAction(formData: FormData) {
  const user = await requireManagementUser();
  const notice = await pendingNotice(formData);
  if (!notice) redirect("/financeiro");
  const result = await prisma.$transaction(async (tx) => {
    // Só um clique registra: o aviso deixa de estar pendente antes de lançar o valor.
    const { count } = await tx.paymentNotice.updateMany({ where: { id: notice.id, status: "PENDING" }, data: { status: "REGISTERED", resolvedAt: new Date() } });
    if (!count) return "done";
    const entry = await tx.financialEntry.findUnique({ where: { id: notice.financialEntryId }, select: { status: true } });
    if (!entry || entry.status === FinancialEntryStatus.CANCELLED) throw new Error("Lançamento cancelado.");
    await tx.financialPayment.create({ data: { entryId: notice.financialEntryId, amountCents: notice.amountCents, paidAt: notice.paidOn, notes: notice.message ? `Aviso do cliente pelo portal: ${notice.message}`.slice(0, 300) : "Aviso do cliente pelo portal." } });
    await recalculateFinancialEntry(tx, notice.financialEntryId, { syncSale: true });
    return "registered";
  }).catch(() => "cancelled" as const);
  if (result === "cancelled") redirect(`/financeiro/lancamentos/${notice.financialEntryId}?error=${encodeURIComponent("Lançamento cancelado: reabra antes de registrar o aviso.")}`);
  if (result === "registered") await logEvent({ event: "finance.payment_notice.registered", message: `Aviso de pagamento de ${notice.client.name} registrado no Financeiro.`, actorEmail: user.email, metadata: { noticeId: notice.id, entryId: notice.financialEntryId } });
  revalidatePath(`/financeiro/lancamentos/${notice.financialEntryId}`);
  revalidatePath("/financeiro");
  redirect(`/financeiro/lancamentos/${notice.financialEntryId}?notice=notice-registered`);
}

export async function dismissPaymentNoticeAction(formData: FormData) {
  const user = await requireManagementUser();
  const notice = await pendingNotice(formData);
  if (!notice) redirect("/financeiro");
  await prisma.paymentNotice.updateMany({ where: { id: notice.id, status: "PENDING" }, data: { status: "DISMISSED", resolvedAt: new Date() } });
  await logEvent({ event: "finance.payment_notice.dismissed", message: `Aviso de pagamento de ${notice.client.name} descartado.`, actorEmail: user.email, metadata: { noticeId: notice.id, entryId: notice.financialEntryId } });
  revalidatePath(`/financeiro/lancamentos/${notice.financialEntryId}`);
  redirect(`/financeiro/lancamentos/${notice.financialEntryId}?notice=notice-dismissed`);
}
