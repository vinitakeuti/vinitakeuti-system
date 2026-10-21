import { randomBytes } from "node:crypto";
import { ChargeStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret, hashToken } from "@/lib/crypto";
import { AsaasError, createAsaasWebhook, deleteAsaasWebhook, environmentFromKey, getAsaasAccount, getAsaasWebhook, removeAsaasWebhookBackoff, updateAsaasWebhook, type AsaasCredentials, type AsaasWebhook } from "@/lib/integrations/asaas";
import { managementUrl } from "@/features/auth/services/auth-host";
import { sendOwnerEmail } from "@/features/notifications/services/owner-email";
import { logEvent } from "@/features/system-logs/services/system-log";

/**
 * Conexão com o Asaas, feita em Integrações: chave de API (criptografada), conta conectada e o webhook que o VR Gestão
 * cria no Asaas com um token próprio (só o hash fica guardado).
 */
const PROVIDER = "ASAAS";

export function asaasWebhookUrl() {
  return managementUrl("/api/webhooks/asaas");
}

function webhookStatus(webhook: AsaasWebhook | null) {
  if (!webhook) return "MISSING";
  if (!webhook.enabled) return "DISABLED";
  return webhook.interrupted ? "INTERRUPTED" : "ACTIVE";
}

/** Mensagem curta para a tela, sem expor a chave. */
export function asaasErrorMessage(error: unknown) {
  if (error instanceof AsaasError) return [error.message, error.providerMessage].filter(Boolean).join(" ").slice(0, 300);
  if (error instanceof Error && error.message.includes("INTEGRATION_ENCRYPTION_KEY")) return "Falta a variável INTEGRATION_ENCRYPTION_KEY (32+ caracteres) no servidor para guardar a chave com segurança.";
  return "Não foi possível falar com o Asaas.";
}

async function storedIntegration() {
  return prisma.paymentIntegration.findUnique({ where: { provider: PROVIDER }, select: { apiKeyEncrypted: true, environment: true, webhookId: true, webhookStatus: true, accountDocument: true, accountEmail: true } });
}

async function credentialsOf(integration: { apiKeyEncrypted: string | null; environment: string } | null): Promise<AsaasCredentials | null> {
  if (!integration?.apiKeyEncrypted) return null;
  return { apiKey: decryptSecret(integration.apiKeyEncrypted), environment: integration.environment === "production" ? "production" : "sandbox" };
}

/** Cria o webhook, ou atualiza o existente com um token novo (o Asaas só guarda o token; aqui fica o hash). */
async function provisionWebhook(credentials: AsaasCredentials, existingId: string | null, email: string) {
  const authToken = randomBytes(36).toString("base64url");
  const input = { url: asaasWebhookUrl(), email, authToken };
  let webhook: AsaasWebhook | null = null;
  if (existingId) {
    try { webhook = await updateAsaasWebhook(existingId, { ...input, enabled: true, interrupted: false }, credentials); }
    catch (error) { if (!(error instanceof AsaasError && error.status === 404)) throw error; }
  }
  webhook ??= await createAsaasWebhook(input, credentials);
  return { webhook, tokenHash: hashToken(authToken) };
}

async function ownerEmail(accountEmail: string | null) {
  const profile = await prisma.professionalProfile.findUnique({ where: { id: "default" }, select: { email: true } });
  return profile?.email?.trim() || accountEmail || "contato@viniciusriudi.com";
}

/**
 * Salva a chave: confere o formato e o ambiente pelo prefixo, testa na API, cria o webhook e só então grava.
 * Trocar de conta (ou de ambiente) limpa os clientes e as cobranças em aberto da conta anterior.
 */
export async function connectAsaas(rawKey: string, actorEmail: string) {
  const apiKey = rawKey.trim();
  const environment = environmentFromKey(apiKey);
  if (!environment || apiKey.length < 30 || apiKey.length > 300) return { ok: false as const, error: "A chave deve começar com $aact_prod_ (produção) ou $aact_hmlg_ (sandbox). Copie-a inteira no painel do Asaas." };
  const credentials = { apiKey, environment };
  try {
    const account = await getAsaasAccount(credentials);
    const previous = await storedIntegration();
    const sameAccount = Boolean(previous?.apiKeyEncrypted && previous.environment === environment && previous.accountDocument && previous.accountDocument === account.document);
    // Webhook da conta anterior: removido com a chave anterior (melhor esforço).
    if (previous?.webhookId && !sameAccount) {
      const oldCredentials = await credentialsOf(previous).catch(() => null);
      if (oldCredentials) await deleteAsaasWebhook(previous.webhookId, oldCredentials).catch(() => null);
    }
    let webhookError: string | null = null;
    let provisioned: Awaited<ReturnType<typeof provisionWebhook>> | null = null;
    try { provisioned = await provisionWebhook(credentials, sameAccount ? previous?.webhookId ?? null : null, await ownerEmail(account.email)); }
    catch (error) { webhookError = `Conta conectada, mas o webhook não foi criado: ${asaasErrorMessage(error)}`; }

    const data = {
      isActive: true, environment, apiKeyEncrypted: encryptSecret(apiKey), keyHint: apiKey.slice(-4),
      accountName: account.name, accountEmail: account.email, accountDocument: account.document, accountStatus: account.status,
      webhookId: provisioned?.webhook.id ?? null, webhookUrl: provisioned?.webhook.url ?? asaasWebhookUrl(), webhookTokenHash: provisioned?.tokenHash ?? null,
      webhookStatus: webhookStatus(provisioned?.webhook ?? null), webhookPenalized: provisioned?.webhook.penalized ?? null,
      lastCheckedAt: new Date(), lastError: webhookError,
    };
    await prisma.paymentIntegration.upsert({ where: { provider: PROVIDER }, create: { provider: PROVIDER, ...data }, update: data });

    if (previous?.apiKeyEncrypted && !sameAccount) {
      const [customers, charges] = await prisma.$transaction([
        prisma.client.updateMany({ where: { asaasCustomerId: { not: null } }, data: { asaasCustomerId: null } }),
        prisma.charge.updateMany({ where: { asaasPaymentId: { not: null }, status: { in: [ChargeStatus.DRAFT, ChargeStatus.PENDING, ChargeStatus.OVERDUE] } }, data: { status: ChargeStatus.CANCELLED } }),
      ]);
      await logEvent({ level: "warning", event: "asaas.account.changed", message: `Conta do Asaas trocada: ${customers.count} clientes e ${charges.count} cobranças em aberto da conta anterior foram desvinculados.`, actorEmail });
    }
    await logEvent({ event: "asaas.connected", message: `Asaas conectado (${environment === "production" ? "produção" : "sandbox"}): ${account.name ?? account.email ?? "conta"}.`, actorEmail, metadata: { webhook: data.webhookStatus } });
    return { ok: true as const, warning: webhookError };
  } catch (error) {
    await logEvent({ level: "warning", event: "asaas.connect_failed", message: `Falha ao conectar o Asaas: ${asaasErrorMessage(error)}`, actorEmail });
    return { ok: false as const, error: asaasErrorMessage(error) };
  }
}

/** Confere a conta e o webhook no Asaas. Avisa por e-mail quando a fila do webhook é interrompida. */
export async function refreshAsaasStatus() {
  const previous = await storedIntegration();
  const credentials = await credentialsOf(previous);
  if (!previous || !credentials) return null;
  try {
    const account = await getAsaasAccount(credentials);
    const webhook = previous.webhookId ? await getAsaasWebhook(previous.webhookId) : null;
    const status = webhookStatus(webhook);
    await prisma.paymentIntegration.update({ where: { provider: PROVIDER }, data: { accountName: account.name, accountEmail: account.email, accountStatus: account.status, webhookStatus: status, webhookPenalized: webhook?.penalized ?? null, webhookUrl: webhook?.url ?? undefined, lastCheckedAt: new Date(), lastError: null } });
    if (status !== "ACTIVE" && previous.webhookStatus === "ACTIVE") {
      const reason = status === "INTERRUPTED" ? "a fila de envios foi interrompida (falhas seguidas ao entregar eventos)" : status === "DISABLED" ? "o webhook foi desativado" : "o webhook foi removido no painel do Asaas";
      await sendOwnerEmail({ kind: "payments", footer: "Pagamentos", critical: true, subject: "Asaas: webhook parado", title: "Os pagamentos online pararam de chegar ao VR Gestão.", lines: [`No Asaas, ${reason}.`, "Os pagamentos continuam sendo conferidos a cada 30 minutos pela sincronização, mas com atraso.", "Em Integrações, use REATIVAR ou RECRIAR WEBHOOK."], path: "/integracoes" });
    }
    return status;
  } catch (error) {
    await prisma.paymentIntegration.update({ where: { provider: PROVIDER }, data: { lastCheckedAt: new Date(), lastError: asaasErrorMessage(error) } });
    throw error;
  }
}

/** Novo token e webhook (re)criado; serve também quando o webhook foi apagado no painel do Asaas. */
export async function recreateAsaasWebhook() {
  const previous = await storedIntegration();
  const credentials = await credentialsOf(previous);
  if (!previous || !credentials) throw new AsaasError("Asaas não conectado.", 503);
  const { webhook, tokenHash } = await provisionWebhook(credentials, previous.webhookId, await ownerEmail(previous.accountEmail));
  await prisma.paymentIntegration.update({ where: { provider: PROVIDER }, data: { webhookId: webhook.id, webhookUrl: webhook.url, webhookTokenHash: tokenHash, webhookStatus: webhookStatus(webhook), webhookPenalized: webhook.penalized, lastCheckedAt: new Date(), lastError: null } });
}

/** Reativa a fila interrompida (o Asaas reenvia os eventos pendentes) e tira a penalização. */
export async function reactivateAsaasWebhook() {
  const previous = await storedIntegration();
  const credentials = await credentialsOf(previous);
  if (!previous?.webhookId || !credentials) throw new AsaasError("Webhook não configurado.", 503);
  const webhook = await updateAsaasWebhook(previous.webhookId, { enabled: true, interrupted: false }, credentials);
  await removeAsaasWebhookBackoff(previous.webhookId).catch(() => null);
  await prisma.paymentIntegration.update({ where: { provider: PROVIDER }, data: { webhookStatus: webhookStatus(webhook), webhookPenalized: 0, lastCheckedAt: new Date(), lastError: null } });
}

/** Desconecta: remove o webhook no Asaas (melhor esforço) e apaga a chave. O histórico de cobranças continua. */
export async function disconnectAsaas(actorEmail: string) {
  const previous = await storedIntegration();
  const credentials = await credentialsOf(previous).catch(() => null);
  if (previous?.webhookId && credentials) await deleteAsaasWebhook(previous.webhookId, credentials).catch(() => null);
  await prisma.paymentIntegration.updateMany({ where: { provider: PROVIDER }, data: { isActive: false, apiKeyEncrypted: null, keyHint: null, webhookId: null, webhookTokenHash: null, webhookStatus: null, webhookPenalized: null, lastError: null } });
  await logEvent({ level: "warning", event: "asaas.disconnected", message: "Asaas desconectado: pagamentos online desativados no portal do cliente.", actorEmail });
}
