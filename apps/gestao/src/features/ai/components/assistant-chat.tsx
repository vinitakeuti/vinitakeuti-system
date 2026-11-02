"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import type { ConversationItem, ConversationView, ToolStepStatus } from "@/features/ai/services/conversations";
import { AssistantMarkdown } from "@/features/ai/components/assistant-markdown";
import { toolLabel } from "@/features/ai/types/tool-labels";
import { deleteAssistantConversationAction } from "@/features/ai/services/ai-actions";

/**
 * Tela do assistente, em tela cheia: histórico agrupado por data, a conversa em coluna central e a caixa de mensagem.
 * Cada resposta da IA vira um bloco só (avatar, etapas executadas e texto). A resposta é gerada na fila do servidor;
 * a tela acompanha pela API até ela ficar pronta.
 */

type ConversationSummary = { id: string; title: string; lastMessageAt: string };
type Status = { ready: true; model: string; assistantName: string } | { ready: false; reason: string; assistantName: string };
type ToolStep = { name: string; status: ToolStepStatus };
type Part = { kind: "steps"; id: string; tools: ToolStep[] } | { kind: "text"; id: string; text: string };
type Turn = { kind: "user"; id: string; text: string; at: string } | { kind: "assistant"; id: string; at: string; parts: Part[] };

const POLL_MS = 1_000;
const MAX_POLL_MS = 4 * 60_000;
const MAX_CHARS = 4_000;
const ZONE = "America/Maceio";

const SUGGESTIONS = [
  { mark: "square", label: "CLIENTE E ORÇAMENTO", text: "Crie um cliente chamado Construtora Virtus, para fazermos um orçamento de um site com integração com gateway de pagamento." },
  { mark: "circle", label: "FINANCEIRO", text: "Quanto entrou e quanto saiu este mês? Tem alguma cobrança atrasada?" },
  { mark: "diamond", label: "AGENDA", text: "O que tenho na agenda esta semana? Tem algum horário livre amanhã à tarde?" },
  { mark: "bar", label: "DOCUMENTOS", text: "Liste os documentos em rascunho que ainda preciso concluir." },
];

const timeFormat = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: ZONE });
const shortDay = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: ZONE });
const longDay = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: ZONE });
const keyFormat = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: ZONE });

const dayKeyOf = (iso: string | number) => keyFormat.format(new Date(iso));
const daysAgo = (iso: string) => Math.round((Date.parse(dayKeyOf(Date.now())) - Date.parse(dayKeyOf(iso))) / 86_400_000);

function dividerLabel(iso: string) {
  const ago = daysAgo(iso);
  return ago === 0 ? "Hoje" : ago === 1 ? "Ontem" : longDay.format(new Date(iso));
}

const historyTime = (iso: string) => daysAgo(iso) === 0 ? timeFormat.format(new Date(iso)) : shortDay.format(new Date(iso)).replace(".", "");

const HISTORY_GROUPS = [
  { label: "Hoje", test: (ago: number) => ago <= 0 },
  { label: "Ontem", test: (ago: number) => ago === 1 },
  { label: "Últimos 7 dias", test: (ago: number) => ago < 7 },
  { label: "Últimos 30 dias", test: (ago: number) => ago < 30 },
  { label: "Mais antigas", test: () => true },
];

/** Mensagens da conversa em blocos: cada pedido da pessoa e a resposta inteira da IA (etapas e textos). */
function toTurns(items: ConversationItem[]): Turn[] {
  const turns: Turn[] = [];
  for (const item of items) {
    if (item.kind === "user") { turns.push({ kind: "user", id: item.id, text: item.text, at: item.at }); continue; }
    let turn = turns.at(-1);
    if (!turn || turn.kind !== "assistant") { turn = { kind: "assistant", id: item.id, at: item.at, parts: [] }; turns.push(turn); }
    const last = turn.parts.at(-1);
    if (item.kind === "tools") {
      if (last?.kind === "steps") last.tools = [...last.tools, ...item.tools];
      else turn.parts.push({ kind: "steps", id: item.id, tools: item.tools });
    } else if (item.text.trim()) turn.parts.push({ kind: "text", id: item.id, text: item.text });
  }
  return turns;
}

const shortModel = (model: string) => model.split("/").at(-1) ?? model;

/* Ícones de traço fino, todos em 16px e na cor do texto. */
const ICONS = {
  plus: "M8 3v10M3 8h10",
  send: "M8 13V3M3.5 7.5 8 3l4.5 4.5",
  search: "M7 12A5 5 0 1 0 7 2a5 5 0 0 0 0 10ZM10.6 10.6 14 14",
  copy: "M5.5 5.5h7v7h-7zM10.5 5.5v-2h-7v7h2",
  check: "M3 8.5 6.5 12 13 4.5",
  trash: "M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5",
  chevron: "M6 4l4 4-4 4",
  down: "M8 3v10M3.5 8.5 8 13l4.5-4.5",
  history: "M8 14A6 6 0 1 0 8 2a6 6 0 0 0 0 12ZM8 5v3.2l2.2 1.6",
  close: "M4 4l8 8M12 4l-8 8",
} as const;

function Icon({ name }: { name: keyof typeof ICONS }) {
  return <svg className="chat-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><path d={ICONS[name]} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" /></svg>;
}

/** Marca VR (a mesma da navegação), em branco sobre preto. */
function Mark() {
  return <svg viewBox="296 192 880 657" aria-hidden="true" focusable="false"><g fill="currentColor"><path d="M316 233H451L817 678L659 829L316 415Z" /><path d="M595 212L1021 213L1151 357V617L928 361H716Z" /><path d="M804 428H899L1156 738V825H994L735 499Z" /></g></svg>;
}

/** Etapas executadas numa resposta: recolhidas num resumo; abertas enquanto a IA trabalha. */
function Steps({ tools, live }: { tools: ToolStep[]; live: boolean }) {
  const [open, setOpen] = useState(false);
  const expanded = open || live;
  const errors = tools.filter((tool) => tool.status === "error").length;
  const waiting = !live && tools.some((tool) => tool.status === "pending");
  const count = `${tools.length} ${tools.length === 1 ? "etapa" : "etapas"}`;
  const summary = live ? `Trabalhando · ${count}` : `${count} ${tools.length === 1 ? "executada" : "executadas"}`;
  return <div className={`chat-steps${expanded ? " is-open" : ""}`}>
    <button type="button" className="chat-steps-toggle" onClick={() => setOpen((value) => !value)} aria-expanded={expanded} disabled={live}>
      <span className={`chat-steps-mark${live ? " is-live" : ""}`} aria-hidden="true" />
      <span>{summary}</span>
      {errors ? <em className="is-error">{errors === 1 ? "1 não concluída" : `${errors} não concluídas`}</em> : null}
      {waiting ? <em>aguardando confirmação</em> : null}
      {live ? null : <Icon name="chevron" />}
    </button>
    {expanded ? <ol>{tools.map((tool, index) => {
      const state = tool.status === "pending" && live ? "running" : tool.status;
      return <li key={index} className={`is-${state}`}>
        <span className="chat-step-dot" aria-hidden="true" />
        <span>{toolLabel(tool.name)}</span>
        {state === "error" ? <small>não concluída</small> : state === "pending" ? <small>aguardando sua confirmação</small> : state === "cancelled" ? <small>não executada</small> : state === "running" ? <small>em andamento</small> : null}
      </li>;
    })}</ol> : null}
  </div>;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1_600); } catch { /* sem permissão de cópia */ }
  };
  return <button type="button" className="chat-tool-button" onClick={() => void copy()} aria-label={copied ? "Resposta copiada" : "Copiar resposta"}><Icon name={copied ? "check" : "copy"} /><span>{copied ? "COPIADO" : "COPIAR"}</span></button>;
}

export function AssistantChat({ status, conversations: initialConversations, initial, greeting, menu }: { status: Status; conversations: ConversationSummary[]; initial: ConversationView | null; greeting: string; menu?: ReactNode }) {
  const [conversations, setConversations] = useState(initialConversations);
  const [conversationId, setConversationId] = useState(initial?.conversationId ?? null);
  const [items, setItems] = useState<ConversationItem[]>(initial?.items ?? []);
  const [pendingConfirmation, setPendingConfirmation] = useState(initial?.pendingConfirmation ?? false);
  const [running, setRunning] = useState(initial?.run?.status === "PENDING" || initial?.run?.status === "RUNNING");
  const [error, setError] = useState<string | null>(initial?.run?.status === "FAILED" ? initial.run.error : null);
  const [draft, setDraft] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [atBottom, setAtBottom] = useState(true);
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const followRef = useRef(true);

  const name = status.assistantName;
  const hasName = name !== "Assistente";

  /** Desce até o fim; sem `force`, só se a pessoa já estava no fim (não puxa a tela de quem está lendo acima). */
  const scrollToEnd = useCallback((force = false) => {
    if (!force && !followRef.current) return;
    requestAnimationFrame(() => {
      const thread = threadRef.current;
      if (thread) thread.scrollTo({ top: thread.scrollHeight, behavior: force ? "auto" : "smooth" });
    });
  }, []);

  const onScroll = () => {
    const thread = threadRef.current;
    if (!thread) return;
    const near = thread.scrollHeight - thread.scrollTop - thread.clientHeight < 96;
    followRef.current = near;
    setAtBottom(near);
  };

  const applyView = useCallback((view: ConversationView) => {
    setItems(view.items);
    setPendingConfirmation(view.pendingConfirmation);
    const active = view.run?.status === "PENDING" || view.run?.status === "RUNNING";
    setRunning(active);
    setError(view.run?.status === "FAILED" ? view.run.error ?? "A IA não conseguiu responder." : null);
    return active;
  }, []);

  const poll = useCallback((id: string, startedAt = Date.now()) => {
    if (pollRef.current) clearTimeout(pollRef.current);
    pollRef.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/ia/conversas?conversationId=${encodeURIComponent(id)}`, { cache: "no-store" });
        if (!response.ok) throw new Error();
        const active = applyView(await response.json() as ConversationView);
        scrollToEnd();
        if (active && Date.now() - startedAt < MAX_POLL_MS) poll(id, startedAt);
        else if (active) { setRunning(false); setError("A resposta está demorando. Atualize a página em instantes."); }
      } catch {
        if (Date.now() - startedAt < MAX_POLL_MS) poll(id, startedAt);
      }
    }, POLL_MS);
  }, [applyView, scrollToEnd]);

  useEffect(() => {
    if (items.length) scrollToEnd(true);
    if (conversationId && running) poll(conversationId);
    return () => { if (pollRef.current) clearTimeout(pollRef.current); };
    // Só na abertura: os envios seguintes iniciam o próprio acompanhamento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!historyOpen) return;
    const close = (event: globalThis.KeyboardEvent) => { if (event.key === "Escape") setHistoryOpen(false); };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [historyOpen]);

  const send = useCallback(async (text: string) => {
    const message = text.trim();
    if (!message || running || !status.ready) return;
    setDraft("");
    setError(null);
    setPendingConfirmation(false);
    setItems((current) => [...current, { kind: "user", id: `local-${Date.now()}`, text: message, at: new Date().toISOString() }]);
    setRunning(true);
    followRef.current = true;
    scrollToEnd(true);
    try {
      const response = await fetch("/api/ia/conversas", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ conversationId, message }) });
      const body = await response.json() as { conversationId?: string; error?: string };
      if (!response.ok || !body.conversationId) throw new Error(body.error ?? "Não foi possível enviar.");
      const now = new Date().toISOString();
      if (!conversationId) {
        setConversationId(body.conversationId);
        window.history.replaceState(null, "", `/assistente?c=${body.conversationId}`);
        setConversations((current) => [{ id: body.conversationId!, title: message.replace(/\s+/g, " ").slice(0, 80), lastMessageAt: now }, ...current]);
      } else {
        setConversations((current) => [...current.filter((item) => item.id === conversationId).map((item) => ({ ...item, lastMessageAt: now })), ...current.filter((item) => item.id !== conversationId)]);
      }
      poll(body.conversationId);
    } catch (cause) {
      setRunning(false);
      setError(cause instanceof Error ? cause.message : "Não foi possível enviar.");
    }
  }, [conversationId, poll, running, scrollToEnd, status.ready]);

  const submit = (event: FormEvent) => { event.preventDefault(); void send(draft); };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(draft); }
  };

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 240)}px`;
  }, [draft]);

  const turns = useMemo(() => toTurns(items), [items]);
  const empty = turns.length === 0;

  // A caixa de mensagem muda de lugar (centro → rodapé) ao começar a conversa: devolve o foco no computador.
  useEffect(() => {
    if (!empty && window.matchMedia("(hover: hover)").matches) inputRef.current?.focus();
  }, [empty]);

  const groups = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const visible = terms.length ? conversations.filter((item) => terms.every((term) => item.title.toLowerCase().includes(term))) : conversations;
    const buckets = HISTORY_GROUPS.map((group) => ({ label: group.label, items: [] as ConversationSummary[] }));
    for (const item of visible) buckets[HISTORY_GROUPS.findIndex((group) => group.test(daysAgo(item.lastMessageAt)))].items.push(item);
    return buckets.filter((bucket) => bucket.items.length);
  }, [conversations, query]);

  const title = conversations.find((item) => item.id === conversationId)?.title ?? "Nova conversa";
  const lastTurn = turns.at(-1);
  const lastPart = lastTurn?.kind === "assistant" ? lastTurn.parts.at(-1) : undefined;

  /* Fim da conversa: indicador de trabalho, pedido de confirmação ou erro. */
  const tail = running
    ? <div className="chat-thinking" role="status"><span className="chat-dots" aria-hidden="true"><i /><i /><i /></span><span>{lastPart?.kind === "steps" ? "Trabalhando nisso" : "Pensando"}</span></div>
    : pendingConfirmation
      ? <div className="chat-confirm" role="group" aria-label="Confirmação">
        <div><b>Posso executar?</b><span>Nada foi alterado ainda. Confira o resumo acima antes de responder.</span></div>
        <div className="chat-confirm-actions">
          <button type="button" className="chat-button is-primary" onClick={() => void send("Sim, pode fazer.")}>SIM, PODE FAZER</button>
          <button type="button" className="chat-button" onClick={() => void send("Não, cancele.")}>NÃO</button>
        </div>
      </div>
      : error ? <p className="chat-error" role="alert">{error}</p> : null;

  const assistantHead = (at: string | null) => <div className="chat-turn-head">
    <span className="chat-avatar"><Mark /></span>
    <b>{hasName ? name : "Assistente"}</b>
    {at ? <time dateTime={at}>{timeFormat.format(new Date(at))}</time> : null}
  </div>;

  const composer = <form className={`chat-composer${empty ? " is-centered" : ""}`} onSubmit={submit}>
    <div className={`chat-input${status.ready ? "" : " is-disabled"}`}>
      <textarea ref={inputRef} rows={empty ? 2 : 1} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={onKeyDown} placeholder={status.ready ? (empty ? "Peça qualquer coisa: um orçamento, um lançamento, um documento…" : `Responder ${hasName ? `à ${name}` : "à assistente"}…`) : "A IA está desconectada."} disabled={!status.ready} maxLength={MAX_CHARS} aria-label="Mensagem para a assistente" />
      <div className="chat-input-foot">
        <span className="chat-input-hint"><kbd>Enter</kbd> envia <span aria-hidden="true">·</span> <kbd>Shift</kbd> + <kbd>Enter</kbd> quebra a linha</span>
        {draft.length > MAX_CHARS - 500 ? <span className="chat-count">{draft.length} / {MAX_CHARS}</span> : null}
        <button type="submit" className="chat-send" disabled={!status.ready || running || !draft.trim()} aria-label={running ? "Aguardando a resposta" : "Enviar mensagem"}>{running ? <span className="chat-send-wait" aria-hidden="true" /> : <Icon name="send" />}</button>
      </div>
    </div>
    <p className="chat-disclaimer">{hasName ? name : "A assistente"} pode errar. Confira valores, datas e documentos antes de concluir.</p>
  </form>;

  return <div className={`chat${historyOpen ? " is-history-open" : ""}`}>
    <aside className="chat-history" aria-label="Conversas">
      <div className="chat-history-head">
        <div className="chat-history-title"><span>CONVERSAS</span>{conversations.length ? <small>{conversations.length}</small> : null}
          <button className="chat-icon-button chat-history-close" type="button" onClick={() => setHistoryOpen(false)} aria-label="Fechar conversas"><Icon name="close" /></button>
        </div>
        <Link className="chat-new" href="/assistente" onClick={() => setHistoryOpen(false)}><Icon name="plus" /><span>Nova conversa</span></Link>
        {conversations.length > 6 ? <label className="chat-search"><Icon name="search" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar conversa" aria-label="Buscar conversa" /></label> : null}
      </div>
      <nav className="chat-history-list">
        {groups.length ? groups.map((group) => <section key={group.label}>
          <h2>{group.label}</h2>
          <ul>{group.items.map((conversation) => <li key={conversation.id} className={conversation.id === conversationId ? "is-active" : undefined}>
            <Link href={`/assistente?c=${conversation.id}`} aria-current={conversation.id === conversationId ? "page" : undefined} onClick={() => setHistoryOpen(false)}><span>{conversation.title}</span><time dateTime={conversation.lastMessageAt}>{historyTime(conversation.lastMessageAt)}</time></Link>
          </li>)}</ul>
        </section>) : <p className="chat-history-empty">{query ? `Nenhuma conversa com “${query}”.` : "Suas conversas aparecem aqui."}</p>}
      </nav>
      <div className={`chat-history-status${status.ready ? "" : " is-off"}`}>
        <span className="chat-status-dot" aria-hidden="true" />
        {status.ready ? <span><b>Conectada</b><small title={status.model}>{shortModel(status.model)}</small></span> : <span><b>Desconectada</b><Link href="/integracoes/ia">Configurar</Link></span>}
      </div>
    </aside>
    <button type="button" className="chat-scrim" aria-label="Fechar conversas" tabIndex={-1} onClick={() => setHistoryOpen(false)} />

    <section className="chat-main" aria-label="Conversa">
      <header className="chat-bar">
        <div className="chat-bar-start">
          {menu}
          <button className="chat-icon-button chat-history-toggle" type="button" onClick={() => setHistoryOpen(true)} aria-label="Abrir conversas" aria-expanded={historyOpen}><Icon name="history" /></button>
        </div>
        <div className="chat-bar-title">
          <h1>{empty ? (hasName ? name : "Assistente") : title}</h1>
          <small>{empty ? "ASSISTENTE IA" : `${hasName ? name.toUpperCase() : "ASSISTENTE"}`}{status.ready ? ` · ${shortModel(status.model).toUpperCase()}` : " · DESCONECTADA"}</small>
        </div>
        <div className="chat-bar-actions">
          <Link className="chat-icon-button chat-bar-new" href="/assistente" aria-label="Nova conversa" title="Nova conversa"><Icon name="plus" /></Link>
          {conversationId ? <form action={deleteAssistantConversationAction}><input type="hidden" name="conversationId" value={conversationId} /><button type="submit" className="chat-icon-button is-danger" aria-label="Excluir esta conversa" title="Excluir esta conversa" onClick={(event) => { if (!window.confirm("Excluir esta conversa? As mensagens não podem ser recuperadas.")) event.preventDefault(); }}><Icon name="trash" /></button></form> : null}
        </div>
      </header>

      <div className="chat-thread" ref={threadRef} onScroll={onScroll} aria-live="polite">
        {empty ? <div className="chat-welcome">
          <span className="chat-welcome-mark"><Mark /></span>
          <h2>{greeting}</h2>
          <p>{hasName ? `Sou a ${name}. ` : ""}Posso cadastrar clientes, montar orçamentos com seus serviços, cuidar do Financeiro, da agenda e dos documentos. Alterações esperam o seu “sim”.</p>
          {composer}
          {status.ready ? <div className="chat-suggestions">{SUGGESTIONS.map((suggestion) => <button key={suggestion.label} type="button" onClick={() => void send(suggestion.text)}>
            <span className={`chat-suggestion-mark is-${suggestion.mark}`} aria-hidden="true" />
            <small>{suggestion.label}</small>
            <span>{suggestion.text}</span>
          </button>)}</div> : <p className="chat-offline">{status.reason} <Link href="/integracoes/ia">Abrir Integrações</Link></p>}
        </div> : <div className="chat-column">
          {turns.map((turn, index) => {
            const previous = turns[index - 1];
            const divider = !previous || dayKeyOf(previous.at) !== dayKeyOf(turn.at) ? <div className="chat-divider" role="separator"><span>{dividerLabel(turn.at)}</span></div> : null;
            const isLast = index === turns.length - 1;
            if (turn.kind === "user") return <div key={turn.id} className="chat-turn-wrap">{divider}<div className="chat-turn is-user">
              <div className="chat-bubble">{turn.text}</div>
              <time dateTime={turn.at}>{timeFormat.format(new Date(turn.at))}</time>
            </div></div>;
            const texts = turn.parts.filter((part): part is Extract<Part, { kind: "text" }> => part.kind === "text");
            return <div key={turn.id} className="chat-turn-wrap">{divider}<article className="chat-turn is-assistant">
              {assistantHead(turn.at)}
              <div className="chat-turn-body">
                {turn.parts.map((part, partIndex) => part.kind === "steps"
                  ? <Steps key={part.id} tools={part.tools} live={running && isLast && partIndex === turn.parts.length - 1} />
                  : <div key={part.id} className="chat-text"><AssistantMarkdown text={part.text} /></div>)}
                {texts.length && !(running && isLast) ? <div className="chat-turn-actions"><CopyButton text={texts.map((part) => part.text).join("\n\n")} /></div> : null}
                {isLast ? tail : null}
              </div>
            </article></div>;
          })}
          {tail && lastTurn?.kind !== "assistant" ? <article className="chat-turn is-assistant">{assistantHead(null)}<div className="chat-turn-body">{tail}</div></article> : null}
        </div>}
      </div>

      {empty ? null : <div className="chat-dock">
        {atBottom ? null : <button type="button" className="chat-jump" onClick={() => { followRef.current = true; setAtBottom(true); scrollToEnd(true); }} aria-label="Ir para a última mensagem"><Icon name="down" /></button>}
        {composer}
      </div>}
    </section>
  </div>;
}
