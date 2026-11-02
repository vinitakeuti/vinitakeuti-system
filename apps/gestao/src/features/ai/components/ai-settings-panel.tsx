import Link from "next/link";
import { ConfirmSubmitButton } from "@/features/finance/components/confirm-submit-button";
import { managementUrl } from "@/features/auth/services/auth-host";
import { AI_PROVIDERS, isAiProviderId } from "@/lib/integrations/ai/providers";
import { getAiSettingsView, providerOptions } from "@/features/ai/services/ai-settings";
import { getAiUsage, listAiActivity } from "@/features/ai/queries/ai-queries";
import { disableAiAction, revokeExternalTokenAction, saveAiSettingsAction, testAiConnectionAction } from "@/features/ai/services/ai-actions";
import { AiTokenPanel } from "@/features/ai/components/ai-token-panel";

const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Maceio" });
const number = new Intl.NumberFormat("pt-BR");

const CHANNELS = [
  { id: "GESTAO", label: "Gestão", detail: "Você, aqui na gestão. Consulta e altera o sistema." },
  { id: "PORTAL", label: "Área do cliente", detail: "O cliente pergunta sobre os próprios pagamentos, documentos e serviços. Só leitura." },
  { id: "SITE", label: "Site", detail: "Atendimento dos visitantes de viniciusriudi.com: serviços e contato." },
  { id: "WHATSAPP", label: "WhatsApp", detail: "Seus números (abaixo) conversam com acesso de gestão, pela ponte do WhatsApp." },
] as const;

const channelLabel: Record<string, string> = { GESTAO: "Gestão", PORTAL: "Área do cliente", SITE: "Site", WHATSAPP: "WhatsApp", SISTEMA: "MCP" };
const runLabel = { PENDING: { text: "NA FILA", tone: "is-warning" }, RUNNING: { text: "RESPONDENDO", tone: "is-warning" }, DONE: { text: "RESPONDIDA", tone: "is-info" }, FAILED: { text: "FALHOU", tone: "is-error" } } as const;
const actionLabel: Record<string, string> = { DONE: "feito", ERROR: "erro", PENDING_CONFIRMATION: "aguardando confirmação", CONFIRMED: "confirmado", CANCELLED: "cancelado", EXPIRED: "expirou" };

const ENDPOINTS = [
  { label: "Gestão", method: "POST/GET", path: "/api/ia/conversas", note: "sessão da gestão" },
  { label: "Área do cliente", method: "POST/GET", path: "/api/portal/ia", note: "sessão do cliente, no domínio de clientes" },
  { label: "Site", method: "POST/GET", path: "/api/ia/site", note: "público, liberado para viniciusriudi.com" },
  { label: "WhatsApp", method: "POST/GET", path: "/api/ia/mensagens", note: "token de acesso externo" },
  { label: "MCP", method: "POST", path: "/api/ia/mcp", note: "token de acesso externo" },
];

/** Painel "Inteligência artificial" de Integrações: provedor, canais, confirmação, token externo e atividade. */
export async function AiSettingsPanel({ cursor }: { cursor?: string }) {
  const [settings, usage, activity] = await Promise.all([getAiSettingsView(), getAiUsage(), listAiActivity(cursor)]);
  const connected = Boolean(settings?.isActive && settings.keyHint && settings.model);
  const providerId = settings && isAiProviderId(settings.provider) ? settings.provider : "openrouter";
  const provider = AI_PROVIDERS[providerId];
  const channels = new Set(settings?.channels ?? []);

  return <>
    <section className="settings-panel" id="ia" aria-labelledby="ai-title">
      <div className="settings-panel-heading"><div><h2 id="ai-title">Inteligência artificial.</h2><p>A IA conversa pela gestão, pela área do cliente, pelo site e pelo WhatsApp, usando as mesmas regras do sistema (Financeiro, vendas, documentos, sistemas). O provedor e o modelo podem ser trocados a qualquer momento.</p></div><span className={`settings-badge ${connected ? "is-ok" : "is-warning"}`}>{connected ? `CONECTADA · ${provider.label.toUpperCase()}` : "NÃO CONECTADA"}</span></div>
      <div className="settings-panel-body">
        {connected && settings ? <dl className="settings-facts integration-facts">
          <div><dt>PROVEDOR</dt><dd>{provider.label}</dd></div>
          <div><dt>MODELO</dt><dd><code>{settings.model}</code></dd></div>
          <div><dt>CHAVE</dt><dd><code>…{settings.keyHint}</code></dd></div>
          <div><dt>CANAIS</dt><dd>{settings.channels.length ? settings.channels.map((channel) => channelLabel[channel] ?? channel).join(", ") : "Nenhum liberado"}</dd></div>
          <div><dt>RESPOSTAS HOJE</dt><dd>{usage.today}{settings.dailyRunLimit ? ` de ${settings.dailyRunLimit}` : ""}</dd></div>
          <div><dt>TOKENS EM 30 DIAS</dt><dd>{number.format(usage.inputTokens30d)} entrada · {number.format(usage.outputTokens30d)} saída</dd></div>
          <div><dt>CONFIRMAÇÃO</dt><dd>{settings.requireConfirmation ? "Pede antes de alterar" : "Altera direto"}</dd></div>
          <div><dt>ÚLTIMO TESTE</dt><dd>{settings.lastCheckedAt ? `${dateTime.format(settings.lastCheckedAt)} · ${settings.lastError ? "falhou" : "ok"}` : "—"}</dd></div>
        </dl> : <ol className="integration-steps">
          <li>Crie uma chave no provedor escolhido (OpenRouter, Anthropic, OpenAI, Google ou outro compatível com a API da OpenAI).</li>
          <li>Escolha o modelo, cole a chave e libere os canais em que a IA vai atender.</li>
          <li>Use TESTAR CONEXÃO. A chave fica criptografada e nunca volta para a tela.</li>
        </ol>}
        {settings?.lastError ? <p className="settings-result is-error">{settings.lastError}</p> : null}

        <form className="settings-form" action={saveAiSettingsAction}>
          <label>PROVEDOR<select name="provider" defaultValue={providerId} className="ai-select">{providerOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
          <label>MODELO<input name="model" required maxLength={120} defaultValue={settings?.model ?? ""} placeholder={provider.modelHint} spellCheck={false} autoComplete="off" /></label>
          <label className="settings-form-wide">{connected ? "TROCAR CHAVE DE API" : "CHAVE DE API"}<input name="apiKey" type="password" autoComplete="off" spellCheck={false} maxLength={400} placeholder={connected ? `…${settings?.keyHint} (em branco mantém a atual)` : provider.keyHint} /></label>
          <label className="settings-form-wide">ENDEREÇO DA API<input name="baseUrl" type="url" maxLength={300} defaultValue={settings?.baseUrl ?? ""} placeholder="Em branco usa o padrão do provedor. Obrigatório em “Outro compatível” (ex.: http://localhost:11434/v1)" spellCheck={false} /></label>
          <fieldset className="settings-form-wide ai-channels">
            <legend>CANAIS LIBERADOS</legend>
            {CHANNELS.map((channel) => <label key={channel.id} className="ai-check"><input type="checkbox" name="channels" value={channel.id} defaultChecked={channels.has(channel.id)} /><span><b>{channel.label}</b><small>{channel.detail}</small></span></label>)}
          </fieldset>
          <label>SEUS NÚMEROS DE WHATSAPP<input name="ownerPhones" maxLength={300} defaultValue={settings?.ownerPhones.join(", ") ?? ""} placeholder="5582999990000 (DDI + DDD + número)" inputMode="tel" /></label>
          <label>LIMITE DE RESPOSTAS POR DIA<input name="dailyRunLimit" type="number" min={1} max={100000} defaultValue={settings ? settings.dailyRunLimit ?? "" : 300} placeholder="Sem limite" /></label>
          <label className="settings-form-wide ai-check"><input type="checkbox" name="requireConfirmation" defaultChecked={settings?.requireConfirmation ?? true} /><span><b>Pedir confirmação antes de alterar dados.</b><small>Lançar gasto, registrar recebimento ou confirmar venda só acontecem depois de você responder “sim” na conversa. Criar e revisar rascunhos de documentos não pede confirmação.</small></span></label>
          <label className="settings-form-wide">INSTRUÇÕES EXTRAS<textarea name="instructions" rows={4} maxLength={4000} defaultValue={settings?.instructions ?? ""} placeholder="Tom de voz, regras do negócio, o que a IA do site deve ou não falar…" /></label>
          <div className="settings-form-actions">
            <button className="primary-action" type="submit">{connected ? "SALVAR" : "CONECTAR"}</button>
            {connected ? <button className="secondary-action" type="submit" formAction={testAiConnectionAction} formNoValidate>TESTAR CONEXÃO</button> : null}
            {connected ? <ConfirmSubmitButton formAction={disableAiAction} className="text-link integration-disconnect" message="Desligar a IA? A chave é apagada e nenhum canal responde até você conectar de novo.">DESLIGAR</ConfirmSubmitButton> : null}
          </div>
        </form>

        <AiTokenPanel hint={settings?.externalTokenHint ?? null} />
        {settings?.externalTokenHint ? <form className="ai-token-revoke"><ConfirmSubmitButton formAction={revokeExternalTokenAction} className="text-link integration-disconnect" message="Revogar o token? O MCP e a ponte do WhatsApp deixam de funcionar até um novo token ser configurado neles.">REVOGAR TOKEN</ConfirmSubmitButton></form> : null}

        <dl className="ai-endpoints">
          {ENDPOINTS.map((endpoint) => <div key={endpoint.path}><dt>{endpoint.label}</dt><dd><code>{endpoint.method} {managementUrl(endpoint.path)}</code><small>{endpoint.note}</small></dd></div>)}
        </dl>
      </div>
    </section>

    <section className="settings-panel" aria-labelledby="ai-activity-title">
      <div className="settings-panel-heading"><div><h2 id="ai-activity-title">Atividade da IA.</h2><p>Cada resposta, por canal, com as ferramentas que a IA usou e o consumo. Alterações ficam registradas com quem pediu.{usage.pendingConfirmations ? ` ${usage.pendingConfirmations} ${usage.pendingConfirmations === 1 ? "alteração aguarda" : "alterações aguardam"} confirmação.` : ""}</p></div></div>
      {activity.data.length ? <ul className="settings-log-list">{activity.data.map((run) => <li key={run.id}><details>
        <summary><time>{dateTime.format(run.createdAt)}</time><span className={`settings-level ${runLabel[run.status].tone}`}>{runLabel[run.status].text}</span><b>{channelLabel[run.conversation.channel] ?? run.conversation.channel}{run.conversation.client ? ` · ${run.conversation.client.name}` : ""}</b><small>{run.conversation.title ?? "Sem título"}</small></summary>
        <dl className="settings-log-detail">
          <div><dt>Modelo</dt><dd><code>{run.model ?? "—"}</code></dd></div>
          <div><dt>Etapas e tokens</dt><dd>{run.steps} {run.steps === 1 ? "etapa" : "etapas"} · {number.format(run.inputTokens)} entrada · {number.format(run.outputTokens)} saída</dd></div>
          {run.actions.length ? <div><dt>Ferramentas</dt><dd>{run.actions.map((action, index) => <span key={index} className="ai-action">{action.tool}{action.mutates ? " (alteração)" : ""} · {actionLabel[action.status] ?? action.status}</span>)}</dd></div> : null}
          {run.error ? <div><dt>Erro</dt><dd><code>{run.error}</code></dd></div> : null}
        </dl>
      </details></li>)}</ul> : <p className="settings-empty">Nenhuma conversa com a IA ainda.</p>}
      {activity.nextCursor ? <div className="table-footer"><Link className="text-link" href={`/integracoes?ia_cursor=${activity.nextCursor}#ia`}>CARREGAR MAIS</Link></div> : null}
    </section>
  </>;
}
