import { prisma } from "@/lib/prisma";
import { isAsaasConfigured } from "@/lib/integrations/asaas";
import { retryPendingAsaasEvents, syncOpenAsaasCharges } from "@/features/integrations/services/asaas-events";
import { asaasErrorMessage, refreshAsaasStatus } from "@/features/integrations/services/asaas-integration";
import { runInstallmentCharges } from "@/features/integrations/services/asaas-charges";
import { logEvent } from "@/features/system-logs/services/system-log";

const SYNC_EVERY_MS = 30 * 60 * 1000;
const SYNC_KEY = "asaas-sync";

/** Reserva a sincronização: só uma instância a executa a cada 30 minutos. */
async function claimSync(now: Date) {
  const threshold = new Date(now.getTime() - SYNC_EVERY_MS).toISOString();
  const updated = await prisma.schedulerState.updateMany({ where: { key: SYNC_KEY, value: { lt: threshold } }, data: { value: now.toISOString() } });
  if (updated.count) return true;
  try { await prisma.schedulerState.create({ data: { key: SYNC_KEY, value: now.toISOString() } }); return true; } catch { return false; }
}

/**
 * Tarefas do Asaas no ciclo do agendador (a cada minuto): eventos do webhook que falharam e, a cada 30 minutos,
 * a conferência da conta, do webhook e das cobranças em aberto (cobre eventos que não chegaram), seguida das
 * cobranças das parcelas (canceladas quando deixam de valer e geradas automaticamente antes do vencimento).
 */
export async function runAsaasCycle(now = new Date()) {
  if (!(await isAsaasConfigured())) return;
  await retryPendingAsaasEvents(now);
  if (!(await claimSync(now))) return;
  try { await refreshAsaasStatus(); }
  catch (error) { await logEvent({ source: "sistema", level: "warning", event: "asaas.check.failed", message: `Não foi possível conferir a conexão com o Asaas: ${asaasErrorMessage(error)}` }); }
  try {
    const { checked, changed } = await syncOpenAsaasCharges();
    await prisma.paymentIntegration.update({ where: { provider: "ASAAS" }, data: { lastSyncAt: now } });
    if (changed) await logEvent({ source: "sistema", event: "asaas.sync", message: `Sincronização com o Asaas: ${changed} de ${checked} cobranças em aberto atualizadas.` });
  } catch (error) {
    await logEvent({ source: "sistema", level: "error", event: "asaas.sync.failed", message: `Falha na sincronização com o Asaas: ${asaasErrorMessage(error)}` });
  }
  try {
    const integration = await prisma.paymentIntegration.findUnique({ where: { provider: "ASAAS" }, select: { autoChargeDays: true } });
    const { created, cancelled } = await runInstallmentCharges(integration?.autoChargeDays ?? null, now);
    if (created || cancelled) await logEvent({ source: "sistema", event: "asaas.charges", message: `Cobranças das parcelas: ${created} geradas e ${cancelled} canceladas no Asaas.` });
  } catch (error) {
    await logEvent({ source: "sistema", level: "error", event: "asaas.charges.failed", message: `Falha nas cobranças automáticas: ${asaasErrorMessage(error)}` });
  }
}
