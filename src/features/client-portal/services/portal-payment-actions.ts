"use server";

import { FinancialEntryStatus, FinancialEntryType } from "@prisma/client";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AsaasError, isAsaasConfigured } from "@/lib/integrations/asaas";
import { requireClientUser } from "@/features/auth/services/auth-session";
import { clientOwnsEntry, entrySchedule, portalEntrySelect } from "@/features/client-portal/queries/portal-queries";
import { chargeRange, ensureInstallmentCharge } from "@/features/integrations/services/asaas-charges";
import { logEvent } from "@/features/system-logs/services/system-log";

function field(formData: FormData, name: string, maxLength: number) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

/**
 * PAGAR AGORA: abre a fatura do Asaas (Pix, boleto ou cartão, à escolha do cliente) das parcelas escolhidas: da próxima
 * em aberto até `through`, já que as parcelas são quitadas em ordem. Elas só aparecem como pagas quando o Asaas
 * confirma o pagamento (webhook ou sincronização); o cliente não consegue marcar nada como pago.
 */
export async function payInstallmentAction(formData: FormData) {
  const user = await requireClientUser();
  const clientId = user.clientId!;
  const entry = await prisma.financialEntry.findFirst({ where: { id: field(formData, "entryId", 40), type: FinancialEntryType.INCOME, status: FinancialEntryStatus.PENDING }, select: portalEntrySelect });
  if (!entry || !(await clientOwnsEntry(clientId, entry.sourceKey))) redirect("/pagamentos?erro=parcela");
  const through = field(formData, "through", 4);
  const installments = chargeRange(entrySchedule(entry), through ? Number(through) : null);
  if (!installments.length) redirect("/pagamentos?erro=parcela");
  if (!(await isAsaasConfigured())) redirect("/pagamentos?erro=online");

  let invoiceUrl: string | null = null;
  try {
    invoiceUrl = (await ensureInstallmentCharge({ clientId, installments, origin: "portal", actorEmail: user.email })).invoiceUrl;
  } catch (error) {
    const missingDocument = error instanceof AsaasError && error.status === 422;
    await logEvent({ level: missingDocument ? "warning" : "error", event: "portal.payment.charge_failed", message: missingDocument ? "Cliente sem CPF ou CNPJ tentou pagar pelo portal." : "Falha ao abrir a cobrança online no portal.", actorEmail: user.email, metadata: { error: error instanceof AsaasError ? `${error.message} ${error.providerMessage ?? ""}`.trim() : String(error) } });
    redirect(`/pagamentos?erro=${missingDocument ? "documento" : "cobranca"}`);
  }
  if (!invoiceUrl) redirect("/pagamentos?erro=cobranca");
  redirect(invoiceUrl);
}
