"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireManagementUser } from "@/features/auth/services/auth-session";
import { syncOpenAsaasCharges } from "@/features/integrations/services/asaas-events";
import { asaasErrorMessage, connectAsaas, disconnectAsaas, reactivateAsaasWebhook, recreateAsaasWebhook, refreshAsaasStatus } from "@/features/integrations/services/asaas-integration";
import { prisma } from "@/lib/prisma";
import { logEvent } from "@/features/system-logs/services/system-log";
import { FinancialEntryStatus } from "@prisma/client";
import { AsaasError } from "@/lib/integrations/asaas";
import { entrySchedule, portalEntrySelect } from "@/features/client-portal/queries/portal-queries";
import { ensureInstallmentCharge, nextChargeableInstallment, runInstallmentCharges } from "@/features/integrations/services/asaas-charges";

function done(params: Record<string, string>) {
  revalidatePath("/integracoes");
  redirect(`/integracoes?${new URLSearchParams(params)}`);
}

/** Salva a chave de API: testa, cria o webhook e só então grava. */
export async function saveAsaasKeyAction(formData: FormData) {
  const user = await requireManagementUser();
  const key = formData.get("apiKey");
  const result = await connectAsaas(typeof key === "string" ? key : "", user.email);
  if (!result.ok) done({ erro: result.error });
  done(result.ok && result.warning ? { erro: result.warning } : { aviso: "conectado" });
}

/** VERIFICAR AGORA: conta, webhook, cobranças em aberto e cobranças das parcelas (o mesmo que o ciclo de 30 minutos). */
export async function checkAsaasAction() {
  await requireManagementUser();
  let error: string | null = null;
  try {
    await refreshAsaasStatus();
    await syncOpenAsaasCharges(10);
    const integration = await prisma.paymentIntegration.update({ where: { provider: "ASAAS" }, data: { lastSyncAt: new Date() }, select: { autoChargeDays: true } });
    await runInstallmentCharges(integration.autoChargeDays);
  } catch (cause) { error = asaasErrorMessage(cause); }
  done(error ? { erro: error } : { aviso: "verificado" });
}

export async function recreateAsaasWebhookAction() {
  await requireManagementUser();
  let error: string | null = null;
  try { await recreateAsaasWebhook(); } catch (cause) { error = asaasErrorMessage(cause); }
  done(error ? { erro: error } : { aviso: "webhook" });
}

export async function reactivateAsaasWebhookAction() {
  await requireManagementUser();
  let error: string | null = null;
  try { await reactivateAsaasWebhook(); } catch (cause) { error = asaasErrorMessage(cause); }
  done(error ? { erro: error } : { aviso: "reativado" });
}

export async function disconnectAsaasAction() {
  const user = await requireManagementUser();
  await disconnectAsaas(user.email);
  done({ aviso: "desconectado" });
}

/** Financeiro: gera agora a cobrança da próxima parcela (sem esperar a cobrança automática) e a envia ao cliente. */
export async function chargeNextInstallmentAction(formData: FormData) {
  const user = await requireManagementUser();
  const entryId = String(formData.get("entryId") ?? "").slice(0, 40);
  const back = (query: string) => redirect(`/financeiro/lancamentos/${entryId}?${query}`);
  const entry = await prisma.financialEntry.findFirst({ where: { id: entryId, status: FinancialEntryStatus.PENDING, sourceKey: { startsWith: "quote:" } }, select: portalEntrySelect });
  const quote = entry ? await prisma.quote.findUnique({ where: { id: entry.sourceKey!.slice("quote:".length) }, select: { clientId: true } }) : null;
  const next = entry ? nextChargeableInstallment(entrySchedule(entry)) : null;
  if (!entry || !quote || !next) back(`error=${encodeURIComponent("Não há parcela em aberto para cobrar.")}`);
  let error: string | null = null;
  try { await ensureInstallmentCharge({ clientId: quote!.clientId, installment: next!, origin: "gestao", actorEmail: user.email }); }
  catch (cause) { error = cause instanceof AsaasError && cause.status === 422 ? cause.message : asaasErrorMessage(cause); }
  revalidatePath(`/financeiro/lancamentos/${entryId}`);
  back(error ? `error=${encodeURIComponent(error)}` : "notice=charge-created");
}

const AUTO_CHARGE_OPTIONS = new Set([3, 5, 7, 10, 15]);

/** Cobrança automática: quantos dias antes do vencimento a cobrança da próxima parcela é gerada (ou desligada). */
export async function saveAutoChargeAction(formData: FormData) {
  const user = await requireManagementUser();
  const raw = String(formData.get("autoChargeDays") ?? "");
  const days = raw === "off" ? null : Number(raw);
  if (days !== null && !AUTO_CHARGE_OPTIONS.has(days)) done({ erro: "Escolha uma das opções de antecedência." });
  await prisma.paymentIntegration.updateMany({ where: { provider: "ASAAS" }, data: { autoChargeDays: days } });
  await logEvent({ event: "asaas.auto_charge", message: days === null ? "Cobrança automática das parcelas desligada." : `Cobrança automática das parcelas: ${days} dias antes do vencimento.`, actorEmail: user.email });
  done({ aviso: "automatico" });
}
