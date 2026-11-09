"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { richTextToHtml } from "@/features/services/components/service-proposal-editor";
import type { EditorPart } from "@/features/ai/services/document-markdown";

type WriteResult = { parts: EditorPart[]; notes: string[] };
type ImproveResult = { notes: string[]; summary: string; blocks: { id: string; parts: EditorPart[] }[] };
type ModelInfo = { connected: boolean; model: string | null; own: boolean };
/** Bloco do documento como vai para a Eliza: textos editáveis e os componentes que ela só lê. */
export type AssistantSourceBlock = { id: string; tipo: "texto" | "linha" | "destaque" | "quebra" | "imagem" | "fixo"; texto?: string };
type Mode = "write" | "improve";
type Phase =
  | { step: "idle" }
  | { step: "sending" }
  | { step: "working"; jobId: string; mode: Mode }
  | { step: "ready"; mode: "write"; result: WriteResult }
  | { step: "ready"; mode: "improve"; result: ImproveResult }
  | { step: "failed"; error: string; mode: Mode; setup?: boolean }
  | { step: "applied"; message: string; undo: (() => void) | null };

const POLL_MS = 2_500;
const PROMPT_MAX = 20_000;

/**
 * A Eliza no editor de PDF: escreve o documento a partir de um pedido ou analisa e aperfeiçoa o que já foi escrito,
 * usando os recursos do editor (molduras, listas, cores, linhas, quebras de página e componentes).
 * O pedido roda na fila do servidor; o painel acompanha e mostra a prévia com o visual da folha. Nada muda no
 * documento até você aplicar, e o que foi aplicado pode ser desfeito enquanto o editor estiver aberto. O painel
 * continua acompanhando mesmo fechado, para a resposta não se perder.
 */
export function DocumentAssistant({ open, onClose, target, kindName, readBlocks, hasText, onWrite, onImprove }: {
  open: boolean;
  onClose: () => void;
  target: { alvo: "proposta" | "documento"; id: string };
  kindName: string;
  readBlocks: () => AssistantSourceBlock[];
  hasText: () => boolean;
  /** Aplica o documento escrito e devolve como desfazer. */
  onWrite: (parts: EditorPart[], placement: "replace" | "append") => () => void;
  /** Aplica os trechos aperfeiçoados e devolve como desfazer. */
  onImprove: (blocks: { id: string; parts: EditorPart[] }[]) => () => void;
}) {
  const [mode, setMode] = useState<Mode>("write");
  const [writePrompt, setWritePrompt] = useState("");
  const [improvePrompt, setImprovePrompt] = useState("");
  const [phase, setPhase] = useState<Phase>({ step: "idle" });
  const [mounted, setMounted] = useState(false);
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const busy = phase.step === "sending" || phase.step === "working";

  useEffect(() => setMounted(true), []);
  // Em telas largas, o documento abre espaço para o painel em vez de ficar por baixo dele.
  useEffect(() => {
    document.body.classList.toggle("doc-ai-open", open);
    return () => document.body.classList.remove("doc-ai-open");
  }, [open]);
  useEffect(() => { if (open) panelRef.current?.querySelector<HTMLElement>("textarea, button")?.focus(); }, [open]);
  useEffect(() => {
    if (!open) return;
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [open, onClose]);

  // Modelo em uso: consultado ao abrir e ao voltar para a aba (ele pode ter sido trocado em Integrações).
  useEffect(() => {
    if (!open) return;
    let active = true;
    const load = () => fetch("/api/ia/documentos", { cache: "no-store" }).then((response) => response.ok ? response.json() as Promise<ModelInfo> : null).then((info) => { if (active && info) setModelInfo(info); }).catch(() => undefined);
    void load();
    window.addEventListener("focus", load);
    return () => { active = false; window.removeEventListener("focus", load); };
  }, [open]);

  // Acompanha o pedido até a resposta (ou a falha).
  useEffect(() => {
    if (phase.step !== "working") return;
    const { jobId, mode: jobMode } = phase;
    let stopped = false;
    const check = async () => {
      try {
        const response = await fetch(`/api/ia/documentos/${jobId}`, { cache: "no-store" });
        const data = await response.json() as { status?: string; result?: unknown; error?: string | null };
        if (stopped) return;
        if (!response.ok) setPhase({ step: "failed", mode: jobMode, error: data.error ?? "Não foi possível acompanhar o pedido." });
        else if (data.status === "READY") setPhase(jobMode === "write" ? { step: "ready", mode: "write", result: data.result as WriteResult } : { step: "ready", mode: "improve", result: data.result as ImproveResult });
        else if (data.status === "FAILED") setPhase({ step: "failed", mode: jobMode, error: data.error ?? "A Eliza não conseguiu concluir." });
      } catch { /* sem conexão: tenta de novo no próximo ciclo */ }
    };
    const timer = setInterval(() => void check(), POLL_MS);
    return () => { stopped = true; clearInterval(timer); };
  }, [phase]);

  async function send(nextMode: Mode) {
    const prompt = nextMode === "write" ? writePrompt.trim() : improvePrompt.trim();
    setPhase({ step: "sending" });
    try {
      const response = await fetch("/api/ia/documentos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...target, modo: nextMode === "write" ? "escrever" : "aperfeicoar", pedido: prompt, trechos: nextMode === "improve" ? readBlocks() : [] }) });
      const data = await response.json().catch(() => ({})) as { jobId?: string; error?: string };
      if (!response.ok || !data.jobId) setPhase({ step: "failed", mode: nextMode, error: data.error ?? "Não foi possível enviar para a Eliza.", setup: response.status === 503 });
      else setPhase({ step: "working", jobId: data.jobId, mode: nextMode });
    } catch {
      setPhase({ step: "failed", mode: nextMode, error: "Sem conexão com o servidor. Tente de novo." });
    }
  }

  function apply(action: () => () => void, message: string) {
    const undo = action();
    setPhase({ step: "applied", message, undo });
  }

  if (!mounted) return null;

  const writeForm = <div className="doc-ai-form">
    <label className="doc-ai-field"><span>O que a Eliza deve escrever</span><textarea value={writePrompt} maxLength={PROMPT_MAX} rows={9} disabled={busy} onChange={(event) => setWritePrompt(event.target.value)} placeholder={`Descreva o ${kindName.toLowerCase()} com o máximo de detalhes: objetivo, partes, escopo, prazos, condições, o que não pode faltar. Pode colar anotações, mensagens do cliente ou um modelo, e pedir a diagramação (etapas em linha do tempo, resumo em moldura, quebra de página antes do cronograma).`} /></label>
    <div className="doc-ai-form-foot"><small>{writePrompt.length.toLocaleString("pt-BR")} de {PROMPT_MAX.toLocaleString("pt-BR")}</small><button type="button" className="primary-action" disabled={busy || writePrompt.trim().length < 10} onClick={() => void send("write")}>Escrever com a Eliza</button></div>
  </div>;

  const improveForm = <div className="doc-ai-form">
    <p className="doc-ai-hint">A Eliza lê o documento inteiro, aponta o que encontrou (erros, trechos confusos, lacunas e riscos) e propõe a versão aperfeiçoada, mantendo a formatação. Você vê a prévia antes de aplicar.</p>
    <label className="doc-ai-field"><span>O que priorizar (opcional)</span><textarea value={improvePrompt} maxLength={2_000} rows={4} disabled={busy} onChange={(event) => setImprovePrompt(event.target.value)} placeholder="Ex.: revisar o português, deixar mais formal, melhorar a diagramação com molduras e listas, conferir a cláusula de rescisão." /></label>
    <div className="doc-ai-form-foot"><small>Imagens e componentes ficam como estão; a Eliza pode acrescentar linhas e quebras de página.</small><button type="button" className="primary-action" disabled={busy} onClick={() => void send("improve")}>Analisar e aperfeiçoar</button></div>
  </div>;

  let body: React.ReactNode;
  if (phase.step === "sending" || phase.step === "working") {
    const writing = phase.step === "working" ? phase.mode === "write" : mode === "write";
    body = <div className="doc-ai-status" aria-live="polite"><span className="doc-ai-working" aria-hidden="true"><i /><i /><i /></span><div><b>{writing ? "A Eliza está escrevendo." : "A Eliza está lendo o seu texto."}</b><p>{writing ? "Documentos longos levam um ou dois minutos." : "Ela analisa trecho por trecho e prepara a versão aperfeiçoada."} Pode continuar no editor; a resposta aparece aqui.</p></div></div>;
  } else if (phase.step === "ready" && phase.mode === "write") {
    const filled = hasText();
    body = <div className="doc-ai-result">
      <p className="doc-ai-label">Documento escrito pela Eliza</p>
      <PartsPreview parts={phase.result.parts} />
      {phase.result.notes.length ? <div className="doc-ai-notes"><b>Para você conferir</b><ul>{phase.result.notes.map((note) => <li key={note}>{note}</li>)}</ul></div> : null}
      <div className="doc-ai-actions">
        <button type="button" className="text-link doc-ai-discard" onClick={() => setPhase({ step: "idle" })}>Descartar</button>
        <span>{filled ? <><button type="button" className="secondary-action" onClick={() => apply(() => onWrite(phase.result.parts, "append"), "Texto inserido no fim do documento.")}>Inserir no fim</button><button type="button" className="primary-action" onClick={() => apply(() => onWrite(phase.result.parts, "replace"), "Texto do documento substituído.")}>Substituir o texto</button></> : <button type="button" className="primary-action" onClick={() => apply(() => onWrite(phase.result.parts, "replace"), "Texto inserido no documento.")}>Inserir no documento</button>}</span>
      </div>
      {filled ? <small className="doc-ai-foot">Substituir troca os textos, as linhas e as quebras de página. Imagens continuam no documento, e os serviços incluídos ficam onde a Eliza indicar ou depois do texto.</small> : null}
    </div>;
  } else if (phase.step === "ready" && phase.mode === "improve") {
    const { notes, summary, blocks } = phase.result;
    body = <div className="doc-ai-result">
      {notes.length ? <div className="doc-ai-notes is-analysis"><b>O que a Eliza encontrou</b><ul>{notes.map((note) => <li key={note}>{note}</li>)}</ul></div> : null}
      {blocks.length ? <>
        {summary ? <p className="doc-ai-summary">{summary}</p> : null}
        <p className="doc-ai-label">Versão aperfeiçoada{blocks.length > 1 ? ` · ${blocks.length} trechos` : ""}</p>
        <PartsPreview parts={blocks.flatMap((block) => block.parts)} />
        <div className="doc-ai-actions"><button type="button" className="text-link doc-ai-discard" onClick={() => setPhase({ step: "idle" })}>Descartar</button><button type="button" className="primary-action" onClick={() => apply(() => onImprove(blocks), "Alterações aplicadas ao documento.")}>Aplicar as alterações</button></div>
      </> : <div className="doc-ai-actions"><p className="doc-ai-summary">A Eliza não propôs alterações no texto.</p><button type="button" className="secondary-action" onClick={() => setPhase({ step: "idle" })}>Fechar análise</button></div>}
    </div>;
  } else if (phase.step === "applied") {
    body = <div className="doc-ai-status is-done" role="status"><div><b>{phase.message}</b><p>O salvamento automático já está gravando. Revise no editor antes de concluir.</p></div><div className="doc-ai-actions">{phase.undo ? <button type="button" className="secondary-action" onClick={() => { phase.undo?.(); setPhase({ step: "applied", message: "Alteração desfeita. O documento voltou ao que era.", undo: null }); }}>Desfazer</button> : <span />}<button type="button" className="primary-action" onClick={() => setPhase({ step: "idle" })}>Novo pedido</button></div></div>;
  } else {
    body = <>
      {phase.step === "failed" ? <div className="doc-ai-error" role="alert"><p>{phase.error}</p>{phase.setup ? <Link className="text-link" href="/integracoes/ia">Conectar a IA</Link> : null}</div> : null}
      {mode === "write" ? writeForm : improveForm}
    </>;
  }

  return createPortal(<aside ref={panelRef} className={`doc-ai-panel${open ? " is-open" : ""}`} aria-label="Eliza no editor" aria-hidden={!open} inert={!open}>
    <header className="doc-ai-head"><div><p className="eyebrow">Eliza</p><h2>{mode === "write" ? `Escrever o ${kindName.toLowerCase()}` : "Analisar e aperfeiçoar"}</h2></div><button type="button" className="doc-ai-close" aria-label="Fechar a Eliza" onClick={onClose}><i /><i /></button></header>
    <nav className="doc-ai-tabs" aria-label="O que pedir"><button type="button" aria-pressed={mode === "write"} disabled={busy || phase.step === "ready"} onClick={() => setMode("write")}>Escrever</button><button type="button" aria-pressed={mode === "improve"} disabled={busy || phase.step === "ready"} onClick={() => setMode("improve")}>Aperfeiçoar</button></nav>
    <div className="doc-ai-body">{body}</div>
    <footer className="doc-ai-model">{modelInfo ? modelInfo.connected ? <><span>Modelo <b>{modelInfo.model}</b>{modelInfo.own ? null : <small> · o mesmo da gestão</small>}</span><a className="text-link" href="/integracoes/ia?tarefa=documentos" target="_blank" rel="noopener">Trocar</a></> : <><span>A IA não está conectada.</span><a className="text-link" href="/integracoes/ia" target="_blank" rel="noopener">Conectar</a></> : <span>Consultando o modelo…</span>}</footer>
  </aside>, document.body);
}

const COMPONENT_LABELS: Record<Exclude<EditorPart["type"], "text" | "divider">, { label: string; detail: string }> = {
  "page-break": { label: "Quebra de página", detail: "O que vem depois começa em nova folha." },
  services: { label: "Serviços incluídos", detail: "Título, categoria e descrição de cada serviço do orçamento." },
  template: { label: "Texto padrão", detail: "O texto padrão salvo para este tipo de documento." },
};

/** Prévia com o visual da folha: textos com a formatação do editor e os componentes no lugar em que entram. */
function PartsPreview({ parts }: { parts: EditorPart[] }) {
  return <div className="doc-ai-preview">{parts.map((part, index) => {
    if (part.type === "text") return <div key={index} className="quote-sheet-text doc-ai-preview-text" dangerouslySetInnerHTML={{ __html: richTextToHtml(part.text) }} />;
    if (part.type === "divider") return <div key={index} className={`doc-ai-preview-divider is-${part.style}`} role="separator" aria-label={part.style === "accent" ? "Linha de destaque" : "Linha divisória"}><i /></div>;
    const component = COMPONENT_LABELS[part.type];
    return <div key={index} className={`doc-ai-preview-component is-${part.type}`}><b>{component.label}</b><small>{component.detail}</small></div>;
  })}</div>;
}
