"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { ConversationItem, ConversationView } from "@/features/ai/services/conversations";
import { AssistantMarkdown } from "@/features/ai/components/assistant-markdown";
import { deleteAssistantConversationAction } from "@/features/ai/services/ai-actions";

/**
 * Tela do assistente: histórico de conversas, a conversa com as etapas que a IA executa (ferramentas) e a caixa de
 * mensagem. A resposta é gerada na fila do servidor; a tela acompanha pela API até ela ficar pronta.
 */

type ConversationSummary = { id: string; title: string; lastMessageAt: string };
type Status = { ready: true; model: string } | { ready: false; reason: string };

const POLL_MS = 1_000;
const MAX_POLL_MS = 4 * 60_000;

const TOOL_LABELS: Record<string, string> = {
  clientes_buscar: "Procurou o cliente",
  clientes_detalhes: "Consultou a ficha do cliente",
  clientes_criar: "Cadastro do cliente",
  clientes_atualizar: "Atualização do cadastro do cliente",
  servicos_listar: "Consultou o catálogo de serviços",
  servicos_criar: "Novo serviço no catálogo",
  orcamentos_criar: "Criação do orçamento",
  orcamentos_alterar_servicos: "Alteração dos serviços do orçamento",
  orcamentos_detalhes: "Consultou o orçamento",
  orcamentos_listar: "Listou os orçamentos",
  financeiro_resumo: "Consultou o resumo do Financeiro",
  financeiro_listar_lancamentos: "Consultou os lançamentos",
  financeiro_adicionar_lancamento: "Lançamento no Financeiro",
  financeiro_registrar_recebimento: "Registro de recebimento",
  financeiro_baixar_proxima_parcela: "Baixa da próxima parcela",
  vendas_listar: "Consultou as vendas",
  vendas_propostas_em_aberto: "Consultou as propostas em aberto",
  vendas_confirmar_proposta: "Confirmação da venda",
  vendas_alterar_situacao: "Mudança na situação da venda",
  documentos_listar: "Consultou os documentos",
  documentos_ler: "Leu o documento",
  documentos_criar: "Redação do documento",
  documentos_reescrever: "Revisão do documento",
  sistemas_listar: "Consultou os sistemas",
  sistemas_detalhes: "Consultou o sistema",
  sistemas_verificar_agora: "Verificou o sistema agora",
  sistemas_verificar_atualizacoes: "Conferiu as atualizações da stack",
  confirmar_acao: "Execução da alteração confirmada",
  cancelar_acao: "Cancelamento da alteração",
};

const STATUS_LABEL = { done: "", error: "não concluído", pending: "aguardando sua confirmação", cancelled: "não executado" } as const;

const SUGGESTIONS = [
  { label: "CLIENTE E ORÇAMENTO", text: "Crie um cliente chamado Construtora Virtus, para fazermos um orçamento de um site com integração com gateway de pagamento." },
  { label: "FINANCEIRO", text: "Quanto entrou e quanto saiu este mês? Tem alguma cobrança atrasada?" },
  { label: "SISTEMAS", text: "Algum sistema está fora do ar ou com atualização importante pendente?" },
  { label: "DOCUMENTOS", text: "Liste os documentos em rascunho que ainda preciso concluir." },
];

const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Maceio" });
const dayLabel = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Maceio" });

function relativeDay(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return sameDay ? time.format(date) : dayLabel.format(date).replace(".", "");
}

function ToolSteps({ item, live }: { item: Extract<ConversationItem, { kind: "tools" }>; live: boolean }) {
  return <ol className="assistant-steps" aria-label="Etapas executadas">
    {item.tools.map((tool, index) => <li key={index} className={`is-${tool.status === "pending" && live ? "running" : tool.status}`}>
      <span className="assistant-step-mark" aria-hidden="true" />
      <span>{TOOL_LABELS[tool.name] ?? tool.name.replace(/_/g, " ")}</span>
      {STATUS_LABEL[tool.status] && !(tool.status === "pending" && live) ? <small>{STATUS_LABEL[tool.status]}</small> : null}
    </li>)}
  </ol>;
}

export function AssistantChat({ status, conversations: initialConversations, initial }: { status: Status; conversations: ConversationSummary[]; initial: ConversationView | null }) {
  const [conversations, setConversations] = useState(initialConversations);
  const [conversationId, setConversationId] = useState(initial?.conversationId ?? null);
  const [items, setItems] = useState<ConversationItem[]>(initial?.items ?? []);
  const [pendingConfirmation, setPendingConfirmation] = useState(initial?.pendingConfirmation ?? false);
  const [running, setRunning] = useState(initial?.run?.status === "PENDING" || initial?.run?.status === "RUNNING");
  const [error, setError] = useState<string | null>(initial?.run?.status === "FAILED" ? initial.run.error : null);
  const [draft, setDraft] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: "smooth" }));
  }, []);

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
    scrollToEnd();
    if (conversationId && running) poll(conversationId);
    return () => { if (pollRef.current) clearTimeout(pollRef.current); };
    // Só na abertura: os envios seguintes iniciam o próprio acompanhamento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = useCallback(async (text: string) => {
    const message = text.trim();
    if (!message || running || !status.ready) return;
    setDraft("");
    setError(null);
    setPendingConfirmation(false);
    setItems((current) => [...current, { kind: "user", id: `local-${Date.now()}`, text: message, at: new Date().toISOString() }]);
    setRunning(true);
    scrollToEnd();
    try {
      const response = await fetch("/api/ia/conversas", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ conversationId, message }) });
      const body = await response.json() as { conversationId?: string; error?: string };
      if (!response.ok || !body.conversationId) throw new Error(body.error ?? "Não foi possível enviar.");
      if (!conversationId) {
        setConversationId(body.conversationId);
        window.history.replaceState(null, "", `/assistente?c=${body.conversationId}`);
        setConversations((current) => [{ id: body.conversationId!, title: message.replace(/\s+/g, " ").slice(0, 80), lastMessageAt: new Date().toISOString() }, ...current]);
      } else {
        setConversations((current) => [...current.filter((item) => item.id === conversationId).map((item) => ({ ...item, lastMessageAt: new Date().toISOString() })), ...current.filter((item) => item.id !== conversationId)]);
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
    input.style.height = `${Math.min(input.scrollHeight, 220)}px`;
  }, [draft]);

  const lastItem = items.at(-1);
  const empty = items.length === 0;

  return <div className={`assistant ${historyOpen ? "is-history-open" : ""}`}>
    <aside className="assistant-history" aria-label="Conversas">
      <div className="assistant-history-head">
        <Link className="assistant-new" href="/assistente" onClick={() => setHistoryOpen(false)}>+ NOVA CONVERSA</Link>
        <button className="assistant-history-close" type="button" onClick={() => setHistoryOpen(false)}>FECHAR</button>
      </div>
      {conversations.length ? <ul>{conversations.map((conversation) => <li key={conversation.id} className={conversation.id === conversationId ? "is-active" : ""}>
        <Link href={`/assistente?c=${conversation.id}`} aria-current={conversation.id === conversationId ? "page" : undefined}><b>{conversation.title}</b><small>{relativeDay(conversation.lastMessageAt)}</small></Link>
        <form action={deleteAssistantConversationAction}><input type="hidden" name="conversationId" value={conversation.id} /><button type="submit" aria-label={`Excluir a conversa ${conversation.title}`} title="Excluir conversa" onClick={(event) => { if (!window.confirm("Excluir esta conversa?")) event.preventDefault(); }}>EXCLUIR</button></form>
      </li>)}</ul> : <p className="assistant-history-empty">As conversas aparecem aqui.</p>}
    </aside>

    <section className="assistant-main" aria-label="Conversa">
      <div className="assistant-bar">
        <button className="assistant-history-toggle" type="button" onClick={() => setHistoryOpen(true)}>CONVERSAS</button>
        <span className="assistant-bar-title">{conversations.find((item) => item.id === conversationId)?.title ?? "Nova conversa"}</span>
        <span className={`assistant-model ${status.ready ? "" : "is-off"}`}>{status.ready ? status.model : "DESCONECTADA"}</span>
      </div>

      <div className="assistant-thread" ref={threadRef} aria-live="polite">
        {empty ? <div className="assistant-welcome">
          <span className="assistant-welcome-mark" aria-hidden="true" />
          <h2>Como posso ajudar?</h2>
          <p>Cadastre clientes, monte orçamentos com seus serviços, lance gastos e recebimentos, escreva documentos ou confira os sistemas. Alterações no Financeiro e nas vendas esperam o seu “sim”.</p>
          {status.ready ? <div className="assistant-suggestions">{SUGGESTIONS.map((suggestion) => <button key={suggestion.label} type="button" onClick={() => void send(suggestion.text)}><small>{suggestion.label}</small><span>{suggestion.text}</span></button>)}</div>
            : <p className="assistant-offline">{status.reason} <Link href="/integracoes/ia">Abrir Integrações</Link></p>}
        </div> : <div className="assistant-messages">
          {items.map((item) => {
            if (item.kind === "user") return <div key={item.id} className="assistant-message is-user"><div className="assistant-bubble">{item.text}</div><time>{time.format(new Date(item.at))}</time></div>;
            if (item.kind === "tools") return <ToolSteps key={item.id} item={item} live={running && item === lastItem} />;
            return <div key={item.id} className="assistant-message is-assistant"><span className="assistant-avatar" aria-hidden="true">VR</span><div className="assistant-text"><AssistantMarkdown text={item.text} /><time>{time.format(new Date(item.at))}</time></div></div>;
          })}
          {running ? <div className="assistant-thinking" role="status"><span className="assistant-avatar" aria-hidden="true">VR</span><span className="assistant-dots" aria-hidden="true"><i /><i /><i /></span><span>{lastItem?.kind === "tools" ? "Trabalhando nisso" : "Pensando"}</span></div> : null}
          {error ? <p className="assistant-error" role="alert">{error}</p> : null}
        </div>}
      </div>

      <form className="assistant-composer" onSubmit={submit}>
        {pendingConfirmation && !running ? <div className="assistant-confirm">
          <span>A IA aguarda sua confirmação para alterar os dados.</span>
          <button type="button" className="primary-action" onClick={() => void send("Sim, pode fazer.")}>SIM, PODE FAZER</button>
          <button type="button" className="secondary-action" onClick={() => void send("Não, cancele.")}>NÃO</button>
        </div> : null}
        <div className="assistant-input">
          <textarea ref={inputRef} rows={1} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={onKeyDown} placeholder={status.ready ? "Peça algo para a IA…" : "A IA está desconectada."} disabled={!status.ready} maxLength={4000} aria-label="Mensagem para a IA" />
          <button type="submit" className="primary-action" disabled={!status.ready || running || !draft.trim()}>{running ? "AGUARDE" : "ENVIAR"}</button>
        </div>
        <small className="assistant-hint">Enter envia · Shift + Enter quebra a linha · confira os dados antes de concluir documentos.</small>
      </form>
    </section>
  </div>;
}
