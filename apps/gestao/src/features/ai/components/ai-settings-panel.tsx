import Link from "next/link";
import { ConfirmSubmitButton } from "@/features/finance/components/confirm-submit-button";
import { managementUrl } from "@/features/auth/services/auth-host";
import { AI_PROVIDERS, isAiProviderId } from "@/lib/integrations/ai/providers";
import { AI_INSTRUCTIONS_MAX, providerOptions, readPrices, type getAiSettingsView } from "@/features/ai/services/ai-settings";
import { promptPreview } from "@/features/ai/services/prompts";
import { CountedTextarea } from "@/features/ai/components/counted-textarea";
import { costFromPrice, formatCost, priceToInput } from "@/features/ai/services/ai-costs";
import { formatPhone } from "@/features/ai/services/site-attendance";
import { CopyField } from "@/features/ai/components/copy-field";
import { getActivitySummary, getAiUsage, listActivitySessions, type ActivityScope } from "@/features/ai/queries/ai-queries";
import { disableAiAction, revokeExternalTokenAction, saveAiConnectionAction, saveAiContextAction, saveAiRulesAction, testAiConnectionAction } from "@/features/ai/services/ai-actions";
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
  { id: "WHATSAPP", label: "WhatsApp", detail: "Pela ponte do WhatsApp. Seus números (abaixo) têm acesso de gestão; os demais, só com o atendimento ligado." },
] as const;

const runLabel = { PENDING: { text: "NA FILA", tone: "is-warning" }, RUNNING: { text: "RESPONDENDO", tone: "is-warning" }, DONE: { text: "RESPONDIDA", tone: "is-info" }, FAILED: { text: "FALHOU", tone: "is-error" } } as const;
const actionLabel: Record<string, string> = { DONE: "feito", ERROR: "erro", PENDING_CONFIRMATION: "aguardando confirmação", CONFIRMED: "confirmado", CANCELLED: "cancelado", EXPIRED: "expirou" };

const ENDPOINTS = [
  { label: "Site", method: "POST/GET", path: "/api/ia/site", note: "Usada pelo widget. Público, liberado para viniciusriudi.com (e para os domínios em AI_SITE_ORIGINS). O atendimento começa em /api/ia/site/inicio, com nome, telefone e e-mail." },
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

/** Modelo escolhido para cada tarefa (vazio = o da gestão). */
function taskModels(settings: AiSettingsView | null) {
  return { gestao: settings?.model ?? "", attendance: settings?.attendanceModel ?? "", document: settings?.documentModel ?? "", quote: settings?.quoteModel ?? "" };
}

/** Preço do modelo de cada tarefa, para os campos (em dólar por milhão de tokens). */
function taskPrices(settings: AiSettingsView | null) {
  const prices = readPrices(settings?.modelPrices);
  const models = taskModels(settings);
  const priceOf = (model: string) => {
    const price = prices[model] ?? (model === settings?.model && settings?.inputPriceMicros !== null && settings?.outputPriceMicros !== null && settings ? { input: settings.inputPriceMicros!, output: settings.outputPriceMicros! } : null);
    return { input: priceToInput(price?.input), output: priceToInput(price?.output) };
  };
  return { gestao: priceOf(models.gestao), attendance: priceOf(models.attendance || models.gestao), document: priceOf(models.document || models.gestao), quote: priceOf(models.quote || models.gestao) };
}

export function AiConnectionPanel({ settings }: { settings: AiSettingsView | null }) {
  const connected = aiIsConnected(settings);
  const providerId = settings && isAiProviderId(settings.provider) ? settings.provider : "openrouter";
  return <section className="settings-panel" aria-labelledby="ai-connection-title">
    <div className="settings-panel-heading"><div><h2 id="ai-connection-title">Provedor e modelo.</h2><p>Escolha o provedor, cole a chave e defina o modelo de cada tarefa: um modelo barato para o atendimento e um mais forte para contratos e orçamentos, por exemplo. Dá para trocar a qualquer momento.</p></div></div>
    <div className="settings-panel-body">
      {connected && settings ? <dl className="settings-facts integration-facts">
        <div><dt>PROVEDOR</dt><dd>{aiProviderLabel(settings)}</dd></div>
        <div><dt>GESTÃO</dt><dd><code>{settings.model}</code></dd></div>
        <div><dt>ATENDIMENTO</dt><dd><code>{settings.attendanceModel ?? settings.model}</code></dd></div>
        <div><dt>DOCUMENTOS</dt><dd><code>{settings.documentModel ?? settings.model}</code></dd></div>
        <div><dt>ORÇAMENTOS</dt><dd><code>{settings.quoteModel ?? settings.model}</code></dd></div>
        <div><dt>CHAVE</dt><dd><code>…{settings.keyHint}</code></dd></div>
        <div><dt>ÚLTIMO TESTE</dt><dd>{settings.lastCheckedAt ? `${dateTime.format(settings.lastCheckedAt)} · ${settings.lastError ? "falhou" : "ok"}` : "—"}</dd></div>
      </dl> : <ol className="integration-steps">
        <li>Crie uma chave no provedor (OpenRouter, Anthropic, OpenAI, Google ou outro compatível com a API da OpenAI).</li>
        <li>Cole a chave abaixo: a lista de modelos liberados para ela aparece em seguida. Escolha um e conecte.</li>
        <li>Use TESTAR CONEXÃO. A chave fica criptografada e nunca volta para a tela.</li>
      </ol>}
      {settings?.lastError ? <p className="settings-result is-error">{settings.lastError}</p> : null}
      <form className="settings-form" action={saveAiConnectionAction}>
        <AiModelPicker providers={providerOptions} initial={{ provider: providerId, baseUrl: settings?.baseUrl ?? "", keyHint: settings?.keyHint ?? null, connected, usdBrl: settings?.usdBrlCents ? (settings.usdBrlCents / 100).toFixed(2).replace(".", ",") : "", models: taskModels(settings), prices: taskPrices(settings) }} />
        <div className="settings-form-actions">
          <button className="primary-action" type="submit">{connected ? "SALVAR" : "CONECTAR"}</button>
          {connected ? <button className="secondary-action" type="submit" formAction={testAiConnectionAction} formNoValidate>TESTAR CONEXÃO</button> : null}
          {connected ? <ConfirmSubmitButton formAction={disableAiAction} className="text-link integration-disconnect" message="Desligar a IA? A chave é apagada e nenhum canal responde até você conectar de novo.">DESLIGAR</ConfirmSubmitButton> : null}
        </div>
      </form>
    </div>
  </section>;
}

const GENERAL_PLACEHOLDER = `Exemplos do que escrever:
- Quem é você e como trabalha (sozinho, com parceiros, remoto, cidade).
- Tom de voz: formal ou próximo, como tratar as pessoas, palavras a evitar.
- Regras do negócio: forma de pagamento padrão, prazo de validade das propostas, o que sempre conferir.
- O que nunca fazer ou prometer.`;

const SERVICE_PLACEHOLDER = `Exemplos do que escrever:
- Como receber a pessoa e o que perguntar primeiro (nome, empresa, o que precisa).
- Serviços em destaque e para quem cada um serve.
- Perguntas frequentes e as respostas (prazos médios, suporte, hospedagem, manutenção).
- Como funciona um orçamento e quais informações pedir.
- Horário de atendimento e quando passar a conversa para você (e como).`;

/** Contexto: instruções gerais e de atendimento, com a prévia do que a IA recebe em cada situação. */
export function AiContextPanel({ settings }: { settings: AiSettingsView | null }) {
  const general = settings?.instructions ?? "";
  const service = settings?.serviceInstructions ?? "";
  const previews = [
    { id: "gestao", label: "Gestão e seu WhatsApp", detail: "Você conversando com a IA: só as instruções gerais.", prompt: promptPreview({ scope: "owner", channel: "GESTAO", assistantName: settings?.assistantName, generalInstructions: general, serviceInstructions: service }) },
    { id: "site", label: "Site", detail: "Visitantes de viniciusriudi.com: gerais e de atendimento.", prompt: promptPreview({ scope: "public", channel: "SITE", assistantName: settings?.assistantName, generalInstructions: general, serviceInstructions: service }) },
    { id: "whatsapp", label: "WhatsApp (atendimento)", detail: "Clientes e interessados pelo WhatsApp: gerais e de atendimento.", prompt: promptPreview({ scope: "public", channel: "WHATSAPP", assistantName: settings?.assistantName, generalInstructions: general, serviceInstructions: service }) },
    { id: "portal", label: "Área do cliente", detail: "Clientes logados no portal: gerais e de atendimento.", prompt: promptPreview({ scope: "client", channel: "PORTAL", clientName: "Nome do cliente", assistantName: settings?.assistantName, generalInstructions: general, serviceInstructions: service }) },
  ];
  return <section className="settings-panel" aria-labelledby="ai-context-title">
    <div className="settings-panel-heading"><div><h2 id="ai-context-title">Contexto.</h2><p>O que a IA precisa saber sobre você e o seu trabalho. As instruções gerais valem em todas as conversas; as de atendimento, só quando ela fala com clientes e visitantes. As regras de segurança (o que cada canal pode ver e alterar) continuam valendo acima destas instruções.</p></div></div>
    <div className="settings-panel-body">
      <form className="settings-form" action={saveAiContextAction}>
        <label>NOME DA ASSISTENTE<input name="assistantName" maxLength={40} defaultValue={settings?.assistantName ?? ""} placeholder="Ex.: Eliza" autoComplete="off" /><small className="ai-field-hint">Usado na apresentação, na saudação do site e no cabeçalho do atendimento.</small></label>
        <CountedTextarea name="generalInstructions" label="INSTRUÇÕES GERAIS · TODAS AS CONVERSAS" defaultValue={general} max={AI_INSTRUCTIONS_MAX} rows={9} placeholder={GENERAL_PLACEHOLDER} />
        <CountedTextarea name="serviceInstructions" label="INSTRUÇÕES DE ATENDIMENTO · SITE, WHATSAPP E ÁREA DO CLIENTE" defaultValue={service} max={AI_INSTRUCTIONS_MAX} rows={11} placeholder={SERVICE_PLACEHOLDER} />
        <div className="settings-form-actions"><button className="primary-action" type="submit">SALVAR</button><small>Vale a partir da próxima mensagem. Instruções longas aumentam o custo de cada resposta.</small></div>
      </form>
      <div className="ai-previews">
        <p className="ai-previews-title">COMO A IA RECEBE</p>
        {previews.map((preview) => <details key={preview.id}><summary><b>{preview.label}</b><small>{preview.detail}</small></summary><pre>{preview.prompt}</pre></details>)}
      </div>
    </div>
  </section>;
}

export function AiRulesPanel({ settings }: { settings: AiSettingsView | null }) {
  const channels = new Set(settings?.channels ?? []);
  return <section className="settings-panel" aria-labelledby="ai-rules-title">
    <div className="settings-panel-heading"><div><h2 id="ai-rules-title">Canais e regras.</h2><p>Onde a IA atende, quem fala com ela pelo WhatsApp, quanto pode responder por dia e o que precisa da sua confirmação.</p></div></div>
    <div className="settings-panel-body">
      <form className="settings-form" action={saveAiRulesAction}>
        <fieldset className="settings-form-wide ai-channels">
          <legend>CANAIS LIBERADOS</legend>
          {CHANNELS.map((channel) => <label key={channel.id} className="ai-check"><input type="checkbox" name="channels" value={channel.id} defaultChecked={channels.has(channel.id)} /><span><b>{channel.label}</b><small>{channel.detail}</small></span></label>)}
        </fieldset>
        <label>SEUS NÚMEROS DE WHATSAPP<input name="ownerPhones" maxLength={300} defaultValue={settings?.ownerPhones.join(", ") ?? ""} placeholder="5582999990000 (DDI + DDD + número)" inputMode="tel" /></label>
        <label className="ai-check ai-check-inline"><input type="checkbox" name="whatsappAttendance" defaultChecked={settings?.whatsappAttendance ?? false} /><span><b>Atender outros números no WhatsApp.</b><small>Clientes e interessados conversam em modo atendimento: serviços e contato, com as instruções de atendimento e no máximo 15 mensagens a cada 10 minutos por número.</small></span></label>
        <label>LIMITE DE RESPOSTAS POR DIA<input name="dailyRunLimit" type="number" min={1} max={100000} defaultValue={settings ? settings.dailyRunLimit ?? "" : 300} placeholder="Sem limite" /></label>
        <label className="settings-form-wide ai-check"><input type="checkbox" name="requireConfirmation" defaultChecked={settings?.requireConfirmation ?? true} /><span><b>Pedir confirmação antes de alterar dados.</b><small>Lançar gasto, registrar recebimento, confirmar venda ou cadastrar serviço no catálogo só acontecem depois de você responder “sim” na conversa. Clientes e rascunhos de orçamento e documento não pedem confirmação.</small></span></label>
        <div className="settings-form-actions"><button className="primary-action" type="submit">SALVAR</button></div>
      </form>
    </div>
  </section>;
}

export function AiAccessPanel({ settings }: { settings: AiSettingsView | null }) {
  return <section className="settings-panel" aria-labelledby="ai-access-title">
    <div className="settings-panel-heading"><div><h2 id="ai-access-title">Acesso externo.</h2><p>Como o site, a ponte do WhatsApp e agentes externos (MCP) falam com a IA da gestão. Cada canal precisa estar liberado em Canais e regras.</p></div></div>
    <div className="settings-panel-body">
      <div className="ai-embed">
        <div><b>Atendimento no site.</b><p>Cole esta linha no site, antes de fechar o &lt;/body&gt;. Aparece um botão flutuante de atendimento; para conversar, o visitante informa nome, telefone e e-mail, e você recebe um e-mail com o contato. O botão só aparece com o canal Site liberado em Canais e regras{settings?.channels.includes("SITE") ? " (liberado)" : " (hoje está desligado)"}.</p></div>
        <CopyField value={`<script src="${managementUrl("/widget/atendimento.js")}" defer></script>`} label="Código do widget" />
      </div>
      <AiTokenPanel hint={settings?.externalTokenHint ?? null} />
      {settings?.externalTokenHint ? <form className="ai-token-revoke"><ConfirmSubmitButton formAction={revokeExternalTokenAction} className="text-link integration-disconnect" message="Revogar o token? O MCP e a ponte do WhatsApp deixam de funcionar até um novo token ser configurado neles.">REVOGAR TOKEN</ConfirmSubmitButton></form> : null}
      <dl className="ai-endpoints">
        {ENDPOINTS.map((endpoint) => <div key={endpoint.path}><dt>{endpoint.label}</dt><dd><code>{endpoint.method} {managementUrl(endpoint.path)}</code><small>{endpoint.note}</small></dd></div>)}
      </dl>
    </div>
  </section>;
}

const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const timeOnly = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Maceio" });

function phoneLabel(digits: string | null) {
  if (!digits) return "número desconhecido";
  const match = digits.match(/^(\d{2})(\d{2})(\d{4,5})(\d{4})$/);
  return match ? `+${match[1]} ${match[2]} ${match[3]}-${match[4]}` : `+${digits}`;
}

function sessionLabel(session: { channel: string; externalKey: string | null; contactName: string | null; client: { name: string } | null }) {
  if (session.channel === "WHATSAPP") return `WhatsApp · ${phoneLabel(session.externalKey)}`;
  if (session.channel === "PORTAL") return `Área do cliente${session.client ? ` · ${session.client.name}` : ""}`;
  if (session.channel === "SITE") return `Site · ${session.contactName ?? "visitante"}`;
  if (session.channel === "SISTEMA") return "MCP · agente externo";
  return "Assistente";
}

function CostValue({ micros, rate, estimated }: { micros: number | null; rate: number | null; estimated?: boolean }) {
  const cost = formatCost(micros, rate);
  return <>{estimated ? "≈ " : ""}{cost.usd}{cost.brl ? <small> · {cost.brl}</small> : null}</>;
}

const SCOPES = [
  { id: "gestao", label: "GESTÃO", detail: "Assistente, seu WhatsApp e MCP." },
  { id: "atendimento", label: "ATENDIMENTO", detail: "Site, área do cliente e outros números do WhatsApp." },
] as const;

/**
 * Atividade: uma sessão por conversa, separada em Gestão e Atendimento, com respostas, tokens e custo. Abrir a sessão
 * mostra cada resposta com as ferramentas usadas.
 */
export async function AiActivityPanel({ settings, scope, cursor }: { settings: AiSettingsView | null; scope: ActivityScope; cursor?: string }) {
  const ownerPhones = settings?.ownerPhones ?? [];
  const price = { inputPriceMicros: settings?.inputPriceMicros ?? null, outputPriceMicros: settings?.outputPriceMicros ?? null };
  const rate = settings?.usdBrlCents ?? null;
  const [summary, sessions, usage] = await Promise.all([getActivitySummary(scope, ownerPhones, price), listActivitySessions(scope, ownerPhones, cursor), getAiUsage()]);
  const current = SCOPES.find((item) => item.id === scope)!;
  return <section className="settings-panel" aria-labelledby="ai-activity-title">
    <div className="settings-panel-heading"><div><h2 id="ai-activity-title">Atividade.</h2><p>Cada conversa é uma sessão, com as respostas, os tokens e o custo. Abra uma sessão para ver as respostas e as ferramentas que a IA usou em cada uma.</p></div></div>
    <div className="settings-panel-body">
      <nav className="ai-scope-switch" aria-label="Lado da atividade">{SCOPES.map((item) => <Link key={item.id} href={`/integracoes/ia?aba=atividade${item.id === "gestao" ? "" : `&escopo=${item.id}`}`} aria-current={item.id === scope ? "page" : undefined}><b>{item.label}</b><small>{item.detail}</small></Link>)}</nav>
      <dl className="settings-facts integration-facts">
        <div><dt>SESSÕES · 30 DIAS</dt><dd>{number.format(summary.sessions)}</dd></div>
        <div><dt>RESPOSTAS · 30 DIAS</dt><dd>{number.format(summary.runs)} <small className="ai-fact-note">{summary.today} hoje</small></dd></div>
        <div><dt>TOKENS · 30 DIAS</dt><dd>{number.format(summary.inputTokens)} entrada · {number.format(summary.outputTokens)} saída</dd></div>
        <div><dt>CUSTO · 30 DIAS</dt><dd><CostValue micros={summary.costMicros} rate={rate} estimated={summary.estimated} />{summary.unpricedRuns ? <small className="ai-fact-note"> · {summary.unpricedRuns} sem preço</small> : null}{summary.costMicros !== null && summary.sessions ? <small className="ai-fact-note ai-fact-line">≈ {formatCost(Math.round(summary.costMicros / summary.sessions), rate).usd} por {scope === "atendimento" ? "atendimento" : "sessão"}</small> : null}</dd></div>
      </dl>
      <p className="ai-activity-note">Respostas hoje, todas as origens: {usage.today}{settings?.dailyRunLimit ? ` de ${settings.dailyRunLimit}` : ""}.{usage.pendingConfirmations ? ` ${usage.pendingConfirmations} ${usage.pendingConfirmations === 1 ? "alteração aguarda" : "alterações aguardam"} confirmação.` : ""}{summary.estimated ? " ≈ inclui respostas antigas estimadas pelo preço atual do modelo." : ""}{!price.inputPriceMicros && settings?.provider !== "openrouter" ? " Para ver o custo, informe o preço do modelo em Conexão." : ""}</p>
    </div>
    {sessions.data.length ? <ul className="ai-sessions">{sessions.data.map((session) => {
      const status = session.lastStatus === "PENDING" || session.lastStatus === "RUNNING" ? { text: "RESPONDENDO", tone: "is-warning" } : session.failedRuns ? { text: `${session.failedRuns} ${session.failedRuns === 1 ? "FALHA" : "FALHAS"}`, tone: "is-error" } : null;
      return <li key={session.id}><details>
        <summary>
          <span className="ai-session-main"><b>{sessionLabel(session)}</b><small>{session.title ?? "Sem título"}</small></span>
          <span className="ai-session-when"><time>{dateTime.format(session.lastMessageAt)}</time>{status ? <span className={`settings-level ${status.tone}`}>{status.text}</span> : null}</span>
          <span className="ai-session-metrics"><span><b>{session.runCount}</b> {session.runCount === 1 ? "resposta" : "respostas"}</span><span><b>{compact.format(session.inputTokens + session.outputTokens)}</b> tokens</span><span className="ai-session-cost"><CostValue micros={session.costMicros ?? (session.unpricedRuns ? costFromPrice(session.inputTokens, session.outputTokens, price) : null)} rate={rate} estimated={session.costMicros === null && session.unpricedRuns > 0} /></span></span>
        </summary>
        <div className="ai-session-detail">
          {session.summary ? <div className="ai-session-summary"><span>RESUMO DO ATENDIMENTO{session.summaryUpdatedAt ? ` · ${dateTime.format(session.summaryUpdatedAt)}` : ""}</span><p>{session.summary}</p></div> : null}
          {session.contactName ? <dl className="ai-session-contact"><div><dt>NOME</dt><dd>{session.contactName}</dd></div>{session.contactPhone ? <div><dt>TELEFONE</dt><dd><a href={`https://wa.me/${session.contactPhone}`} target="_blank" rel="noreferrer noopener">{formatPhone(session.contactPhone)}</a></dd></div> : null}{session.contactEmail ? <div><dt>E-MAIL</dt><dd><a href={`mailto:${session.contactEmail}`}>{session.contactEmail}</a></dd></div> : null}</dl> : null}
          <div className="ai-session-head"><span>Início {dateTime.format(session.createdAt)} · última mensagem {dateTime.format(session.lastMessageAt)}</span>{session.channel === "GESTAO" ? <Link className="text-link" href={`/assistente?c=${session.id}`}>ABRIR CONVERSA</Link> : null}</div>
          <ol className="ai-session-runs">{session.runs.map((run) => <li key={run.id}>
            <time>{timeOnly.format(run.createdAt)}</time>
            <span className={`settings-level ${runLabel[run.status].tone}`}>{runLabel[run.status].text}</span>
            <span className="ai-run-usage">{number.format(run.inputTokens)} + {number.format(run.outputTokens)} tokens · <CostValue micros={run.costMicros ?? costFromPrice(run.inputTokens, run.outputTokens, price)} rate={rate} estimated={run.costMicros === null} />{run.model ? <code>{run.model}</code> : null}</span>
            {run.actions.length ? <span className="ai-run-tools">{run.actions.map((action, index) => <span key={index} className={action.mutates ? "is-change" : undefined}>{action.tool}{action.status !== "DONE" ? ` · ${actionLabel[action.status] ?? action.status}` : ""}</span>)}</span> : null}
            {run.error ? <code className="ai-run-error">{run.error}</code> : null}
          </li>)}</ol>
          {session.runCount > session.runs.length ? <p className="ai-activity-note">Mostrando as {session.runs.length} respostas mais recentes de {session.runCount}.</p> : null}
        </div>
      </details></li>;
    })}</ul> : <p className="settings-empty">Nenhuma conversa em {current.label === "GESTÃO" ? "Gestão" : "Atendimento"} ainda.</p>}
    {sessions.nextCursor ? <div className="table-footer"><Link className="text-link" href={`/integracoes/ia?aba=atividade${scope === "gestao" ? "" : `&escopo=${scope}`}&cursor=${sessions.nextCursor}`}>CARREGAR MAIS</Link></div> : null}
  </section>;
}
