import Link from "next/link";
import { ConfirmSubmitButton } from "@/features/finance/components/confirm-submit-button";
import { managementUrl } from "@/features/auth/services/auth-host";
import { AI_PROVIDERS, isAiProviderId } from "@/lib/integrations/ai/providers";
import { providerOptions, type getAiSettingsView } from "@/features/ai/services/ai-settings";
import { getAiUsage, listAiActivity } from "@/features/ai/queries/ai-queries";
import { disableAiAction, revokeExternalTokenAction, saveAiConnectionAction, saveAiRulesAction, testAiConnectionAction } from "@/features/ai/services/ai-actions";
import { AiTokenPanel } from "@/features/ai/components/ai-token-panel";
import { AiModelPicker } from "@/features/ai/components/ai-model-picker";

/** Painéis de Integrações › Inteligência artificial, um por aba: conexão, canais e regras, acesso externo e atividade. */

type AiSettingsView = NonNullable<Awaited<ReturnType<typeof getAiSettingsView>>>;

const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Maceio" });
const number = new Intl.NumberFormat("pt-BR");

export const channelLabel: Record<string, string> = { GESTAO: "Gestão", PORTAL: "Área do cliente", SITE: "Site", WHATSAPP: "WhatsApp", SISTEMA: "MCP" };

const CHANNELS = [
  { id: "GESTAO", label: "Gestão", detail: "Você, no Assistente IA. Consulta e altera o sistema." },
  { id: "PORTAL", label: "Área do cliente", detail: "O cliente pergunta sobre os próprios pagamentos, documentos e serviços. Só leitura." },
  { id: "SITE", label: "Site", detail: "Atendimento dos visitantes de viniciusriudi.com: serviços e contato." },
  { id: "WHATSAPP", label: "WhatsApp", detail: "Seus números (abaixo) conversam com acesso de gestão, pela ponte do WhatsApp." },
] as const;

const runLabel = { PENDING: { text: "NA FILA", tone: "is-warning" }, RUNNING: { text: "RESPONDENDO", tone: "is-warning" }, DONE: { text: "RESPONDIDA", tone: "is-info" }, FAILED: { text: "FALHOU", tone: "is-error" } } as const;
const actionLabel: Record<string, string> = { DONE: "feito", ERROR: "erro", PENDING_CONFIRMATION: "aguardando confirmação", CONFIRMED: "confirmado", CANCELLED: "cancelado", EXPIRED: "expirou" };

const ENDPOINTS = [
  { label: "Site", method: "POST/GET", path: "/api/ia/site", note: "Público, liberado só para viniciusriudi.com. O site envia { sessionId, message } e acompanha a resposta com ?sessionId=…&run=…." },
  { label: "WhatsApp", method: "POST/GET", path: "/api/ia/mensagens", note: "Com o token. A ponte envia { de, texto } e acompanha a resposta com ?de=…&run=…. Só seus números são atendidos." },
  { label: "MCP", method: "POST", path: "/api/ia/mcp", note: "Com o token. Servidor MCP (HTTP) com as ferramentas da gestão, para agentes externos." },
  { label: "Gestão", method: "POST/GET", path: "/api/ia/conversas", note: "Usada pelo Assistente IA, com a sessão da gestão." },
  { label: "Área do cliente", method: "POST/GET", path: "/api/portal/ia", note: "Com a sessão do cliente, no domínio de clientes." },
];

export function aiIsConnected(settings: AiSettingsView | null) {
  return Boolean(settings?.isActive && settings.keyHint && settings.model);
}

export function aiProviderLabel(settings: AiSettingsView | null) {
  return AI_PROVIDERS[settings && isAiProviderId(settings.provider) ? settings.provider : "openrouter"].label;
}

export function AiConnectionPanel({ settings }: { settings: AiSettingsView | null }) {
  const connected = aiIsConnected(settings);
  const providerId = settings && isAiProviderId(settings.provider) ? settings.provider : "openrouter";
  return <section className="settings-panel" aria-labelledby="ai-connection-title">
    <div className="settings-panel-heading"><div><h2 id="ai-connection-title">Provedor e modelo.</h2><p>Escolha o provedor, cole a chave e selecione o modelo na lista. Dá para trocar a qualquer momento: o restante do sistema não depende do provedor.</p></div></div>
    <div className="settings-panel-body">
      {connected && settings ? <dl className="settings-facts integration-facts">
        <div><dt>PROVEDOR</dt><dd>{aiProviderLabel(settings)}</dd></div>
        <div><dt>MODELO</dt><dd><code>{settings.model}</code></dd></div>
        <div><dt>CHAVE</dt><dd><code>…{settings.keyHint}</code></dd></div>
        <div><dt>ÚLTIMO TESTE</dt><dd>{settings.lastCheckedAt ? `${dateTime.format(settings.lastCheckedAt)} · ${settings.lastError ? "falhou" : "ok"}` : "—"}</dd></div>
      </dl> : <ol className="integration-steps">
        <li>Crie uma chave no provedor (OpenRouter, Anthropic, OpenAI, Google ou outro compatível com a API da OpenAI).</li>
        <li>Cole a chave abaixo: a lista de modelos liberados para ela aparece em seguida. Escolha um e conecte.</li>
        <li>Use TESTAR CONEXÃO. A chave fica criptografada e nunca volta para a tela.</li>
      </ol>}
      {settings?.lastError ? <p className="settings-result is-error">{settings.lastError}</p> : null}
      <form className="settings-form" action={saveAiConnectionAction}>
        <AiModelPicker providers={providerOptions} initial={{ provider: providerId, model: settings?.model ?? "", baseUrl: settings?.baseUrl ?? "", keyHint: settings?.keyHint ?? null, connected }} />
        <div className="settings-form-actions">
          <button className="primary-action" type="submit">{connected ? "SALVAR" : "CONECTAR"}</button>
          {connected ? <button className="secondary-action" type="submit" formAction={testAiConnectionAction} formNoValidate>TESTAR CONEXÃO</button> : null}
          {connected ? <ConfirmSubmitButton formAction={disableAiAction} className="text-link integration-disconnect" message="Desligar a IA? A chave é apagada e nenhum canal responde até você conectar de novo.">DESLIGAR</ConfirmSubmitButton> : null}
        </div>
      </form>
    </div>
  </section>;
}

export function AiRulesPanel({ settings }: { settings: AiSettingsView | null }) {
  const channels = new Set(settings?.channels ?? []);
  return <section className="settings-panel" aria-labelledby="ai-rules-title">
    <div className="settings-panel-heading"><div><h2 id="ai-rules-title">Canais e regras.</h2><p>Onde a IA atende, quem fala com ela pelo WhatsApp, quanto pode responder por dia e como ela deve se comportar.</p></div></div>
    <div className="settings-panel-body">
      <form className="settings-form" action={saveAiRulesAction}>
        <fieldset className="settings-form-wide ai-channels">
          <legend>CANAIS LIBERADOS</legend>
          {CHANNELS.map((channel) => <label key={channel.id} className="ai-check"><input type="checkbox" name="channels" value={channel.id} defaultChecked={channels.has(channel.id)} /><span><b>{channel.label}</b><small>{channel.detail}</small></span></label>)}
        </fieldset>
        <label>SEUS NÚMEROS DE WHATSAPP<input name="ownerPhones" maxLength={300} defaultValue={settings?.ownerPhones.join(", ") ?? ""} placeholder="5582999990000 (DDI + DDD + número)" inputMode="tel" /></label>
        <label>LIMITE DE RESPOSTAS POR DIA<input name="dailyRunLimit" type="number" min={1} max={100000} defaultValue={settings ? settings.dailyRunLimit ?? "" : 300} placeholder="Sem limite" /></label>
        <label className="settings-form-wide ai-check"><input type="checkbox" name="requireConfirmation" defaultChecked={settings?.requireConfirmation ?? true} /><span><b>Pedir confirmação antes de alterar dados.</b><small>Lançar gasto, registrar recebimento, confirmar venda ou cadastrar serviço no catálogo só acontecem depois de você responder “sim” na conversa. Clientes e rascunhos de orçamento e documento não pedem confirmação.</small></span></label>
        <label className="settings-form-wide">INSTRUÇÕES EXTRAS<textarea name="instructions" rows={5} maxLength={4000} defaultValue={settings?.instructions ?? ""} placeholder="Tom de voz, regras do negócio, o que a IA do site deve ou não falar…" /></label>
        <div className="settings-form-actions"><button className="primary-action" type="submit">SALVAR</button></div>
      </form>
    </div>
  </section>;
}

export function AiAccessPanel({ settings }: { settings: AiSettingsView | null }) {
  return <section className="settings-panel" aria-labelledby="ai-access-title">
    <div className="settings-panel-heading"><div><h2 id="ai-access-title">Acesso externo.</h2><p>Como o site, a ponte do WhatsApp e agentes externos (MCP) falam com a IA da gestão. Cada canal precisa estar liberado em Canais e regras.</p></div></div>
    <div className="settings-panel-body">
      <AiTokenPanel hint={settings?.externalTokenHint ?? null} />
      {settings?.externalTokenHint ? <form className="ai-token-revoke"><ConfirmSubmitButton formAction={revokeExternalTokenAction} className="text-link integration-disconnect" message="Revogar o token? O MCP e a ponte do WhatsApp deixam de funcionar até um novo token ser configurado neles.">REVOGAR TOKEN</ConfirmSubmitButton></form> : null}
      <dl className="ai-endpoints">
        {ENDPOINTS.map((endpoint) => <div key={endpoint.path}><dt>{endpoint.label}</dt><dd><code>{endpoint.method} {managementUrl(endpoint.path)}</code><small>{endpoint.note}</small></dd></div>)}
      </dl>
    </div>
  </section>;
}

export async function AiActivityPanel({ settings, cursor }: { settings: AiSettingsView | null; cursor?: string }) {
  const [usage, activity] = await Promise.all([getAiUsage(), listAiActivity(cursor)]);
  return <section className="settings-panel" aria-labelledby="ai-activity-title">
    <div className="settings-panel-heading"><div><h2 id="ai-activity-title">Atividade.</h2><p>Cada resposta, por canal, com as ferramentas que a IA usou e o consumo. Alterações ficam registradas com quem pediu.</p></div></div>
    <div className="settings-panel-body">
      <dl className="settings-facts integration-facts">
        <div><dt>RESPOSTAS HOJE</dt><dd>{usage.today}{settings?.dailyRunLimit ? ` de ${settings.dailyRunLimit}` : ""}</dd></div>
        <div><dt>RESPOSTAS EM 30 DIAS</dt><dd>{number.format(usage.runs30d)}</dd></div>
        <div><dt>TOKENS EM 30 DIAS</dt><dd>{number.format(usage.inputTokens30d)} entrada · {number.format(usage.outputTokens30d)} saída</dd></div>
        <div><dt>AGUARDANDO CONFIRMAÇÃO</dt><dd>{usage.pendingConfirmations}</dd></div>
      </dl>
    </div>
    {activity.data.length ? <ul className="settings-log-list">{activity.data.map((run) => <li key={run.id}><details>
      <summary><time>{dateTime.format(run.createdAt)}</time><span className={`settings-level ${runLabel[run.status].tone}`}>{runLabel[run.status].text}</span><b>{channelLabel[run.conversation.channel] ?? run.conversation.channel}{run.conversation.client ? ` · ${run.conversation.client.name}` : ""}</b><small>{run.conversation.title ?? "Sem título"}</small></summary>
      <dl className="settings-log-detail">
        <div><dt>Modelo</dt><dd><code>{run.model ?? "—"}</code></dd></div>
        <div><dt>Etapas e tokens</dt><dd>{run.steps} {run.steps === 1 ? "etapa" : "etapas"} · {number.format(run.inputTokens)} entrada · {number.format(run.outputTokens)} saída</dd></div>
        {run.actions.length ? <div><dt>Ferramentas</dt><dd>{run.actions.map((action, index) => <span key={index} className="ai-action">{action.tool}{action.mutates ? " (alteração)" : ""} · {actionLabel[action.status] ?? action.status}</span>)}</dd></div> : null}
        {run.error ? <div><dt>Erro</dt><dd><code>{run.error}</code></dd></div> : null}
      </dl>
    </details></li>)}</ul> : <p className="settings-empty">Nenhuma conversa com a IA ainda.</p>}
    {activity.nextCursor ? <div className="table-footer"><Link className="text-link" href={`/integracoes/ia?aba=atividade&cursor=${activity.nextCursor}`}>CARREGAR MAIS</Link></div> : null}
  </section>;
}
