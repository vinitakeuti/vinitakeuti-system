"use server";

import { ChargeStatus, FinancialEntryStatus, FinancialEntryType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AsaasError, createAsaasCharge, ensureAsaasCustomer, isAsaasConfigured } from "@/lib/asaas";
import { requireClientUser } from "@/features/auth/services/auth-session";
import { MAX_INSTALLMENTS } from "@/features/finance/services/installments";
import { MAX_FINANCIAL_PAYMENTS } from "@/features/finance/services/finance-ledger";
import { clientOwnsEntry, entrySchedule, portalTodayStart } from "@/features/client-portal/queries/portal-queries";
import { sendOwnerEmail } from "@/features/notifications/services/owner-email";
import { logEvent } from "@/features/system-logs/services/system-log";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const day = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Maceio" });
const MAX_PENDING_NOTICES = 20;

function field(formData: FormData, name: string, maxLength: number) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

/** Parcela em aberto de um lançamento do próprio cliente. `number` vazio: lançamento sem parcelas. */
async function openInstallment(clientId: string, entryId: string, rawNumber: string) {
  const entry = await prisma.financialEntry.findFirst({
    where: { id: entryId.slice(0, 40), type: FinancialEntryType.INCOME, status: FinancialEntryStatus.PENDING },
    select: { id: true, description: true, amountCents: true, paidCents: true, dueDate: true, paymentCondition: true, sourceKey: true, installments: { orderBy: { number: "asc" }, take: MAX_INSTALLMENTS, select: { number: true, dueDate: true, amountCents: true } }, payments: { orderBy: [{ paidAt: "asc" }, { id: "asc" }], take: MAX_FINANCIAL_PAYMENTS, select: { amountCents: true, paidAt: true } } },
  });
  if (!entry || !(await clientOwnsEntry(clientId, entry.sourceKey))) return null;
  const number = rawNumber ? Number(rawNumber) : null;
  const installment = entrySchedule(entry).find((item) => item.number === number && item.remaining > 0);
  return installment ? { entry, installment } : null;
}

function installmentLabel(installment: { number: number | null; total: number; entryDescription: string }) {
  return installment.number ? `Parcela ${installment.number} de ${installment.total} · ${installment.entryDescription}` : installment.entryDescription;
}

/**
 * PAGAR: abre a fatura do Asaas da parcela (Pix, boleto ou cartão, à escolha do cliente). Reaproveita a cobrança já
 * criada para a mesma parcela e valor; o webhook registra o recebimento no Financeiro quando o pagamento cair.
 */
export async function payInstallmentAction(formData: FormData) {
  const user = await requireClientUser();
  const clientId = user.clientId!;
  const found = await openInstallment(clientId, field(formData, "entryId", 40), field(formData, "number", 4));
  if (!found) redirect("/pagamentos?erro=parcela");
  if (!(await isAsaasConfigured())) redirect("/pagamentos?erro=online");
  const { installment } = found;

  const existing = await prisma.charge.findFirst({
    where: { clientId, financialEntryId: installment.entryId, installmentNumber: installment.number ?? 0, amountCents: installment.remaining, status: { in: [ChargeStatus.PENDING, ChargeStatus.OVERDUE] }, invoiceUrl: { not: null } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { invoiceUrl: true },
  });
  if (existing?.invoiceUrl) redirect(existing.invoiceUrl);

  let invoiceUrl: string | null = null;
  try {
    const client = await prisma.client.findUniqueOrThrow({ where: { id: clientId }, select: { id: true, name: true, email: true, document: true, phone: true } });
    const customer = await ensureAsaasCustomer({ clientId, name: client.name, email: client.email, document: client.document, phone: client.phone });
    const description = installmentLabel(installment).slice(0, 300);
    // O Asaas não aceita vencimento no passado: parcela atrasada vence hoje.
    const today = portalTodayStart();
    const dueDate = installment.dueDate < today ? today : installment.dueDate;
    const charge = await prisma.charge.create({ data: { clientId, description, amountCents: installment.remaining, dueDate, status: ChargeStatus.DRAFT, paymentMethod: "UNDEFINED", financialEntryId: installment.entryId, installmentNumber: installment.number ?? 0 }, select: { id: true } });
    const remote = await createAsaasCharge({ customerId: customer.id, amountCents: installment.remaining, description, dueDate, billingType: "UNDEFINED", externalReference: charge.id });
    await prisma.charge.update({ where: { id: charge.id }, data: { asaasPaymentId: remote.id, status: ChargeStatus.PENDING, invoiceUrl: remote.invoiceUrl } });
    invoiceUrl = remote.invoiceUrl;
    await logEvent({ event: "portal.payment.charge_created", message: `Cobrança online criada no portal: ${description} (${money.format(installment.remaining / 100)}).`, actorEmail: user.email, metadata: { chargeId: charge.id, entryId: installment.entryId, installment: installment.number } });
  } catch (error) {
    await logEvent({ level: "error", event: "portal.payment.charge_failed", message: "Falha ao criar a cobrança online no portal.", actorEmail: user.email, metadata: { error: error instanceof AsaasError ? `${error.message} ${error.providerMessage ?? ""}`.trim() : String(error) } });
    redirect("/pagamentos?erro=cobranca");
  }
  if (!invoiceUrl) redirect("/pagamentos?erro=cobranca");
  redirect(invoiceUrl);
}

/** JÁ PAGUEI: o cliente avisa um pagamento feito por Pix ou transferência. Você confere e registra no Financeiro. */
export async function notifyPaymentAction(formData: FormData) {
  const user = await requireClientUser();
  const clientId = user.clientId!;
  const found = await openInstallment(clientId, field(formData, "entryId", 40), field(formData, "number", 4));
  if (!found) redirect("/pagamentos?erro=parcela");
  const { installment } = found;

  // Campo numérico (1500.5) ou digitado no formato brasileiro (1.500,50).
  const rawAmount = field(formData, "amount", 20);
  const amountCents = Math.round(Number(rawAmount.includes(",") ? rawAmount.replace(/\./g, "").replace(",", ".") : rawAmount) * 100);
  const paidOnRaw = field(formData, "paidOn", 10);
  const paidOn = /^\d{4}-\d{2}-\d{2}$/.test(paidOnRaw) ? new Date(`${paidOnRaw}T12:00:00.000-03:00`) : null;
  const message = field(formData, "message", 500) || null;
  const tomorrow = new Date(portalTodayStart().getTime() + 24 * 60 * 60 * 1000);
  if (!Number.isFinite(amountCents) || amountCents <= 0 || amountCents > installment.remaining) redirect("/pagamentos?erro=valor");
  if (!paidOn || paidOn >= tomorrow) redirect("/pagamentos?erro=data");
  if ((await prisma.paymentNotice.count({ where: { clientId, status: "PENDING" } })) >= MAX_PENDING_NOTICES) redirect("/pagamentos?erro=avisos");

  const notice = await prisma.paymentNotice.create({ data: { clientId, financialEntryId: installment.entryId, installmentNumber: installment.number, amountCents, paidOn, message }, select: { id: true, client: { select: { name: true } } } });
  const label = installmentLabel(installment);
  await logEvent({ event: "portal.payment.notice", message: `${notice.client.name} avisou um pagamento de ${money.format(amountCents / 100)} (${label}).`, actorEmail: user.email, metadata: { noticeId: notice.id, entryId: installment.entryId } });
  await sendOwnerEmail({ kind: "portal", footer: "Portal do cliente", subject: `Aviso de pagamento: ${notice.client.name} · ${money.format(amountCents / 100)}`, title: "Um cliente avisou que pagou.", lines: [`Cliente: ${notice.client.name}`, `Valor: ${money.format(amountCents / 100)} em ${day.format(paidOn)}`, label, ...(message ? [`Mensagem: ${message}`] : []), "Confira o recebimento e registre no lançamento."], path: `/financeiro/lancamentos/${installment.entryId}` });
  revalidatePath("/portal/pagamentos");
  redirect("/pagamentos?aviso=enviado");
}
