import Link from "next/link";
import { AppSidebar } from "@/components/app-sidebar";
import { ConfirmSubmitButton } from "@/features/finance/components/confirm-submit-button";
import { IntegrationHeader } from "@/features/integrations/components/integration-header";
import { countOpenAsaasCharges, getAsaasBalanceSafe, getAsaasIntegration, listAsaasEvents } from "@/features/integrations/queries/integration-queries";
import { asaasEventLabel } from "@/features/integrations/services/asaas-events";
import { asaasWebhookUrl } from "@/features/integrations/services/asaas-integration";
import { checkAsaasAction, disconnectAsaasAction, reactivateAsaasWebhookAction, recreateAsaasWebhookAction, saveAsaasKeyAction, saveAutoChargeAction } from "@/features/integrations/services/asaas-actions";

export const dynamic = "force-dynamic";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Maceio" });

const notices: Record<string, string> = {
  conectado: "Asaas conectado. O webhook foi criado, o portal do cliente já oferece PAGAR AGORA e as parcelas passam a ser cobradas e baixadas automaticamente.",
  verificado: "Conexão, webhook e cobranças em aberto conferidos.",
  webhook: "Webhook recriado com um token novo.",
  reativado: "Fila do webhook reativada. O Asaas reenvia os eventos que ficaram pendentes.",
  desconectado: "Asaas desconectado. O portal volta a mostrar só o Pix.",
  automatico: "Cobrança automática atualizada.",
};
const accountStatus: Record<string, string> = { APPROVED: "Aprovada", PENDING: "Em análise", AWAITING_ACTION_AUTHORIZATION: "Aguardando autorização", DENIED: "Recusada" };
const webhookLabel: Record<string, { label: string; tone: string; detail: string }> = {
  ACTIVE: { label: "ATIVO", tone: "is-ok", detail: "Pagamentos chegam na hora." },
  INTERRUPTED: { label: "FILA INTERROMPIDA", tone: "is-warning", detail: "O Asaas parou de enviar depois de falhas seguidas. Reative para receber os eventos pendentes." },
  DISABLED: { label: "DESATIVADO", tone: "is-warning", detail: "O webhook está desativado no Asaas." },
  MISSING: { label: "NÃO CONFIGURADO", tone: "is-warning", detail: "Sem webhook, os pagamentos só são conferidos a cada 30 minutos." },
};

const TABS = [{ id: "conexao", label: "CONEXÃO" }, { id: "eventos", label: "EVENTOS RECEBIDOS" }] as const;

type AsaasPageProps = { searchParams: Promise<{ aba?: string; aviso?: string; erro?: string; cursor?: string }> };

/** Asaas: conexão da conta (chave, webhook e cobrança automática) e, em outra aba, os eventos recebidos. */
export default async function AsaasPage({ searchParams }: AsaasPageProps) {
  const params = await searchParams;
  const tab = params.aba === "eventos" ? "eventos" : "conexao";
  const integration = await getAsaasIntegration();
  const connected = Boolean(integration?.isActive && integration.keyHint);
  const production = integration?.environment === "production";
  const [balance, events, openCharges] = await Promise.all([
    connected && tab === "conexao" ? getAsaasBalanceSafe() : null,
    tab === "eventos" ? listAsaasEvents(params.cursor) : null,
    tab === "conexao" ? countOpenAsaasCharges() : 0,
  ]);
  const webhook = webhookLabel[integration?.webhookStatus ?? "MISSING"] ?? webhookLabel.MISSING;

  return <main className="app-shell"><AppSidebar current="integrations" /><div className="workspace"><section className="directory-page settings-page">
    <IntegrationHeader crumb="ASAAS" title="Asaas." description="Pagamentos online: o cliente paga as parcelas pelo portal (Pix, boleto ou cartão) e o recebimento entra sozinho no Financeiro." badge={{ label: connected ? (production ? "CONECTADO · PRODUÇÃO" : "CONECTADO · SANDBOX") : "NÃO CONECTADO", tone: connected && production ? "is-ok" : "is-warning" }} tabs={TABS} current={tab} basePath="/integracoes/asaas" />
    {params.aviso && notices[params.aviso] ? <p className="form-success" role="status">{notices[params.aviso]}</p> : null}
    {params.erro ? <p className="form-error" role="alert">{params.erro.slice(0, 300)}</p> : null}

    {tab === "conexao" ? <>
    <section className="settings-panel" aria-labelledby="asaas-title">
        <div className="settings-panel-heading"><div><h2 id="asaas-title">Conta e webhook.</h2><p>Chave de API, situação da conta e o webhook que avisa a gestão de cada pagamento.</p></div></div>
        <div className="settings-panel-body">
          {connected && integration ? <>
            <dl className="settings-facts integration-facts">
              <div><dt>CONTA</dt><dd>{integration.accountName ?? "—"}</dd></div>
              <div><dt>E-MAIL</dt><dd>{integration.accountEmail ?? "—"}</dd></div>
              <div><dt>CPF / CNPJ</dt><dd>{integration.accountDocument ?? "—"}</dd></div>
              <div><dt>SITUAÇÃO DA CONTA</dt><dd>{accountStatus[integration.accountStatus ?? ""] ?? integration.accountStatus ?? "—"}</dd></div>
              <div><dt>CHAVE</dt><dd><code>…{integration.keyHint}</code></dd></div>
              <div><dt>SALDO</dt><dd>{balance !== null ? money.format(balance / 100) : "—"}</dd></div>
              <div><dt>COBRANÇAS EM ABERTO</dt><dd>{openCharges}</dd></div>
              <div><dt>ÚLTIMA CONFERÊNCIA</dt><dd>{integration.lastSyncAt ? dateTime.format(integration.lastSyncAt) : integration.lastCheckedAt ? dateTime.format(integration.lastCheckedAt) : "—"}</dd></div>
            </dl>
            {!production ? <p className="settings-note">Ambiente de testes (sandbox): as cobranças não são reais. Para receber de verdade, salve uma chave de produção (começa com <code>$aact_prod_</code>).</p> : null}
            {integration.lastError ? <p className="settings-result is-error">{integration.lastError}</p> : null}
            <div className="integration-webhook">
              <div><span className={`settings-badge ${webhook.tone}`}>WEBHOOK · {webhook.label}</span><p>{webhook.detail}{integration.webhookPenalized ? ` ${integration.webhookPenalized} envios penalizados.` : ""}</p><code>{integration.webhookUrl ?? asaasWebhookUrl()}</code></div>
              <form className="integration-actions">
                <button className="secondary-action" type="submit" formAction={checkAsaasAction}>VERIFICAR AGORA</button>
                {integration.webhookStatus === "INTERRUPTED" || integration.webhookStatus === "DISABLED" ? <button className="primary-action" type="submit" formAction={reactivateAsaasWebhookAction}>REATIVAR</button> : null}
                <button className="secondary-action" type="submit" formAction={recreateAsaasWebhookAction}>RECRIAR WEBHOOK</button>
              </form>
            </div>
            <form className="integration-auto" action={saveAutoChargeAction}>
              <div><b>Cobrança automática das parcelas.</b><p>A cobrança da próxima parcela de cada venda é gerada no Asaas, que a envia ao cliente por e-mail. Quando o pagamento cai, a parcela é baixada sozinha no Financeiro. Cobranças que deixam de valer (parcela paga por fora, valor alterado, venda cancelada) são canceladas. Conferência a cada 30 minutos.</p></div>
              <label>GERAR A COBRANÇA<select name="autoChargeDays" defaultValue={integration.autoChargeDays === null ? "off" : String(integration.autoChargeDays)}><option value="off">Desligada (só pelo PAGAR AGORA)</option>{[3, 5, 7, 10, 15].map((days) => <option key={days} value={days}>{days} dias antes do vencimento</option>)}</select></label>
              <button className="secondary-action" type="submit">SALVAR</button>
            </form>
          </> : <ol className="integration-steps">
            <li>No Asaas, abra <b>Integrações &gt; Chaves de API</b> e gere uma chave (produção ou sandbox).</li>
            <li>Cole a chave abaixo. O ambiente é identificado pelo começo da chave e a conexão é testada antes de salvar.</li>
            <li>O VR Gestão cria sozinho o webhook no Asaas, com um token próprio. Nada precisa ser configurado no Easypanel.</li>
          </ol>}
          <form className="settings-form" action={saveAsaasKeyAction}>
            <label className="settings-form-wide">{connected ? "TROCAR CHAVE DE API" : "CHAVE DE API"}<input name="apiKey" type="password" autoComplete="off" spellCheck={false} required minLength={30} maxLength={300} placeholder="$aact_prod_… ou $aact_hmlg_…" /></label>
            <div className="settings-form-actions"><button className="primary-action" type="submit">{connected ? "SALVAR NOVA CHAVE" : "CONECTAR"}</button><small>Trocar para outra conta ou ambiente desvincula os clientes e as cobranças em aberto da conta anterior.</small>{connected ? <ConfirmSubmitButton formAction={disconnectAsaasAction} className="text-link integration-disconnect" message="Desconectar o Asaas? O webhook é removido e o portal deixa de oferecer pagamento online.">DESCONECTAR</ConfirmSubmitButton> : null}</div>
          </form>
        </div>
      </section>

    </> : events ? <>
    <section className="settings-panel" aria-labelledby="asaas-events-title">
        <div className="settings-panel-heading"><div><h2 id="asaas-events-title">Eventos recebidos.</h2><p>Avisos do Asaas sobre as cobranças. Os que falham são processados de novo automaticamente (até 5 vezes).</p></div></div>
        {events.data.length ? <ul className="settings-log-list">{events.data.map((event) => <li key={event.id}><details>
          <summary><time>{dateTime.format(event.receivedAt)}</time><span className={`settings-level ${event.processedAt ? "is-info" : event.error ? "is-error" : "is-warning"}`}>{event.processedAt ? "PROCESSADO" : event.error ? "FALHOU" : "NA FILA"}</span><b>{asaasEventLabel[event.eventName] ?? event.eventName}{event.amountCents !== null ? ` · ${money.format(event.amountCents / 100)}` : ""}</b><small>{event.charge ? `${event.charge.client.name} · ${event.charge.description}` : "Cobrança criada fora do VR Gestão"}</small></summary>
          <dl className="settings-log-detail">
            <div><dt>Evento</dt><dd><code>{event.eventName}</code></dd></div>
            {event.providerPaymentId ? <div><dt>Cobrança no Asaas</dt><dd><code>{event.providerPaymentId}</code></dd></div> : null}
            <div><dt>Tentativas</dt><dd>{event.attempts}</dd></div>
            {event.error ? <div><dt>Erro</dt><dd><code>{event.error}</code></dd></div> : null}
          </dl>
        </details></li>)}</ul> : <p className="settings-empty">Nenhum evento recebido ainda.</p>}
        {events.nextCursor ? <div className="table-footer"><Link className="text-link" href={`/integracoes/asaas?aba=eventos&cursor=${events.nextCursor}`}>CARREGAR MAIS</Link></div> : null}
      </section>

    </> : null}
  </section></div></main>;
}
