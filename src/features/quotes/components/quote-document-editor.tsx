"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { InlineRichTextEditor, type RichTextEditorCommand, type RichTextEditorCommandRequest } from "@/features/services/components/service-proposal-editor";
import { QuoteClosingPreview, QuoteCoverPreview, type QuotePreviewData } from "@/features/quotes/components/quote-document-previews";
import { updateQuoteDocumentAction } from "@/features/quotes/services/quote-actions";
import { QUOTE_INTRO_BLOCK_ID, quoteDocumentBlockRole, type QuoteDocumentAlign, type QuoteDocumentBlock, type QuoteDocumentBlockType, type QuoteDocumentContent, type QuoteDocumentFontSize } from "@/features/quotes/types/document-content";
import { parseRichText, RICH_TEXT_BASE_SIZE, RICH_TEXT_SIZES, richTextPlainText, serializeRichText, type RichTextBlock, type RichTextRun } from "@/lib/rich-text";

type ProfessionalProfile = {
  name: string;
  professionalTitle?: string | null;
  email?: string | null;
  phone?: string | null;
  document?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  website?: string | null;
};

type DocumentDisplayBlock = QuoteDocumentBlock & { sourceId?: string; partIndex?: number };
type DocumentPage = { blocks: DocumentDisplayBlock[] };

type Props = {
  quoteId: string;
  quoteCode: string;
  quoteTitle: string;
  backHref: string;
  initialContent: QuoteDocumentContent;
  professional: ProfessionalProfile;
  isCompleted: boolean;
  justSaved?: boolean;
  preview: QuotePreviewData;
  /** Texto padrão em rich text; só entra no documento quando o usuário clica em INSERIR TEXTO PADRÃO. */
  templateText?: string | null;
};

const sizeLabels: Record<QuoteDocumentFontSize, string> = { small: "Pequeno", medium: "Normal", large: "Grande" };
const alignLabels: Record<QuoteDocumentAlign, string> = { left: "À esquerda", center: "Centralizado", right: "À direita", justify: "Justificado" };

function estimatedBlockHeight(block: DocumentDisplayBlock) {
  const source = block.type === "rich-text" ? richTextPlainText(block.text) : block.text;
  if (!source) return 24;
  const role = quoteDocumentBlockRole(block);
  if (role === "section-label") return 58;
  if (role === "service-category") return 26;
  if (role === "service-title") return 54;
  const charactersPerLine = block.fontSize === "large" ? 48 : block.fontSize === "small" ? 100 : 78;
  const lines = Math.max(1, source.split("\n").reduce((total, line) => total + Math.max(1, Math.ceil(line.length / charactersPerLine)), 0));
  return lines * (block.fontSize === "large" ? 32 : block.fontSize === "small" ? 20 : 25) + (block.type === "rich-text" ? 12 : 18);
}

function estimatedRichTextBlockHeight(block: RichTextBlock) {
  if (block.type === "paragraph") {
    const text = block.runs.map((run) => run.text).join("");
    const lines = Math.max(1, text.split("\n").reduce((total, line) => total + Math.max(1, Math.ceil(line.length / 74)), 0));
    return lines * 19 + 8;
  }
  return block.items.reduce((total, item) => {
    const text = item.map((run) => run.text).join("");
    const lines = Math.max(1, text.split("\n").reduce((count, line) => count + Math.max(1, Math.ceil(line.length / 69)), 0));
    return total + lines * 19 + 5;
  }, 8);
}

function splitRunsForPage(runs: RichTextRun[], maxCharacters = 760) {
  const parts: RichTextRun[][] = [];
  let part: RichTextRun[] = [];
  let used = 0;
  for (const run of runs) {
    let remainingText = run.text;
    while (remainingText) {
      const capacity = maxCharacters - used;
      if (capacity <= 0) {
        if (part.length) parts.push(part);
        part = [];
        used = 0;
        continue;
      }
      if (remainingText.length <= capacity) {
        part.push({ ...run, text: remainingText });
        used += remainingText.length;
        remainingText = "";
        continue;
      }
      const preferredBreak = remainingText.lastIndexOf(" ", capacity);
      const cutAt = preferredBreak > Math.floor(capacity * 0.6) ? preferredBreak + 1 : capacity;
      part.push({ ...run, text: remainingText.slice(0, cutAt) });
      parts.push(part);
      part = [];
      used = 0;
      remainingText = remainingText.slice(cutAt);
    }
  }
  if (part.length) parts.push(part);
  return parts;
}

function richTextParts(block: QuoteDocumentBlock): DocumentDisplayBlock[] {
  const document = parseRichText(block.text);
  if (!document.blocks.length || !richTextPlainText(block.text).trim()) {
    // O bloco de apresentação continua visível mesmo vazio, para que sempre exista onde escrever antes dos serviços.
    return block.id === QUOTE_INTRO_BLOCK_ID ? [{ ...block, id: `${block.id}-part-0`, text: "", sourceId: block.id, partIndex: 0 }] : [];
  }
  const atomicBlocks = document.blocks.flatMap((item): RichTextBlock[] => {
    if (item.type === "paragraph") return splitRunsForPage(item.runs).map((runs) => ({ type: "paragraph", runs }));
    return item.items.flatMap((listItem) => splitRunsForPage(listItem).map((runs) => ({ type: item.type, items: [runs] })));
  });
  const chunks: RichTextBlock[][] = [];
  let chunk: RichTextBlock[] = [];
  let chunkHeight = 0;
  for (const item of atomicBlocks) {
    const height = estimatedRichTextBlockHeight(item);
    if (chunk.length && chunkHeight + height > 220) {
      chunks.push(chunk);
      chunk = [];
      chunkHeight = 0;
    }
    chunk.push(item);
    chunkHeight += height;
  }
  if (chunk.length) chunks.push(chunk);
  return chunks.map((items, index) => ({ ...block, id: `${block.id}-part-${index}`, text: serializeRichText({ version: 1, blocks: items }) ?? "", sourceId: block.id, partIndex: index }));
}

function expandedBlocks(blocks: QuoteDocumentBlock[]) {
  return blocks.flatMap((block): DocumentDisplayBlock[] => block.type === "rich-text" ? richTextParts(block) : [block]);
}

function serviceGroup(blocks: DocumentDisplayBlock[], start: number) {
  const group = [blocks[start]];
  const suffix = blocks[start].id.slice("service-title-".length);
  let index = start + 1;
  while (index < blocks.length && (blocks[index].id === `service-category-${suffix}` || blocks[index].id === `service-description-${suffix}-part-0`)) {
    group.push(blocks[index]);
    index += 1;
  }
  return { group, nextIndex: index };
}

function paginationGroups(blocks: DocumentDisplayBlock[]) {
  const groups: DocumentDisplayBlock[][] = [];
  let index = 0;
  while (index < blocks.length) {
    const block = blocks[index];
    if (block.id === "services-label" && blocks[index + 1]?.id.startsWith("service-title-")) {
      const service = serviceGroup(blocks, index + 1);
      groups.push([block, ...service.group]);
      index = service.nextIndex;
      continue;
    }
    if (block.id.startsWith("service-title-")) {
      const service = serviceGroup(blocks, index);
      groups.push(service.group);
      index = service.nextIndex;
      continue;
    }
    groups.push([block]);
    index += 1;
  }
  return groups;
}

type PageLayout = { heights: Record<string, number>; capacity: number };

/** Assinatura curta do texto: blocos ricos são editores não controlados e precisam ser recriados quando o conteúdo é redistribuído. */
function textSignature(text: string) {
  let hash = 5381;
  for (let index = 0; index < text.length; index += 1) hash = ((hash << 5) + hash + text.charCodeAt(index)) | 0;
  return `${text.length}-${(hash >>> 0).toString(36)}`;
}

/**
 * Distribui os blocos pelas folhas usando a altura medida na tela (ou uma estimativa antes da primeira medição).
 * O grupo que contém o bloco em edição nunca é empurrado para a folha seguinte, para o cursor não sair do lugar;
 * o que vem depois dele é que avança quando a folha enche.
 */
function paginateDocument(blocks: QuoteDocumentBlock[], layout: PageLayout | null, pinnedBlockId: string | null) {
  const displayBlocks = expandedBlocks(blocks);
  const pages: DocumentPage[] = [{ blocks: [] }];
  const capacity = layout?.capacity ?? 790;
  let usedHeight = 0;
  for (const group of paginationGroups(displayBlocks)) {
    const height = group.reduce((total, block) => total + (layout?.heights[block.id] ?? estimatedBlockHeight(block)), 0);
    const page = pages.at(-1)!;
    const isPinned = pinnedBlockId !== null && group.some((block) => block.id === pinnedBlockId);
    if (page.blocks.length && usedHeight + height > capacity && !isPinned) {
      pages.push({ blocks: [] });
      usedHeight = 0;
    }
    pages.at(-1)!.blocks.push(...group);
    usedHeight += height;
  }
  return pages;
}

/** Tamanho do texto: diminuir, escolher na lista ou aumentar. Os botões não tiram o foco do texto em edição. */
function FontSizeControl({ size, onStep, onSelect }: { size: number; onStep: (direction: 1 | -1) => void; onSelect: (size: number) => void }) {
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuPosition) return;
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent && event.key !== "Escape") return;
      if (event.type === "pointerdown" && (event.target as Element | null)?.closest(".quote-docs-size-menu, .quote-docs-size-current")) return;
      setMenuPosition(null);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [menuPosition]);

  function toggleMenu() {
    if (menuPosition) {
      setMenuPosition(null);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setMenuPosition({ top: rect.bottom + 4, left: Math.max(8, Math.min(rect.left, window.innerWidth - 136)) });
  }

  return <div className="quote-docs-size" role="group" aria-label="Tamanho da fonte">
    <button type="button" className="quote-docs-size-step" aria-label="Diminuir fonte" title="Diminuir fonte" disabled={size <= RICH_TEXT_SIZES[0]} onMouseDown={(event) => event.preventDefault()} onClick={() => onStep(-1)}>A<small>-</small></button>
    <button type="button" ref={triggerRef} className="quote-docs-size-current" aria-haspopup="listbox" aria-expanded={menuPosition !== null} aria-label={`Tamanho da fonte: ${size} pontos`} onMouseDown={(event) => event.preventDefault()} onClick={toggleMenu}>{size}<small>PT</small></button>
    <button type="button" className="quote-docs-size-step is-increase" aria-label="Aumentar fonte" title="Aumentar fonte" disabled={size >= RICH_TEXT_SIZES.at(-1)!} onMouseDown={(event) => event.preventDefault()} onClick={() => onStep(1)}>A<small>+</small></button>
    {menuPosition ? <div className="quote-docs-size-menu" role="listbox" aria-label="Tamanhos disponíveis" style={{ top: menuPosition.top, left: menuPosition.left }}>
      {RICH_TEXT_SIZES.map((option) => <button type="button" role="option" aria-selected={option === size} key={option} className={option === size ? "is-active" : ""} onMouseDown={(event) => event.preventDefault()} onClick={() => { onSelect(option); setMenuPosition(null); }}><span style={{ fontSize: `${Math.min(option, 20) / RICH_TEXT_BASE_SIZE * 0.8}rem` }}>{option}</span>{option === RICH_TEXT_BASE_SIZE ? <small>NORMAL</small> : null}</button>)}
    </div> : null}
  </div>;
}

function EditableBlock({ block, onActivate, onInput, onCommit, onRemove, command, onSelectionSize }: { block: DocumentDisplayBlock; onActivate: () => void; onInput: (text: string) => void; onCommit: () => void; onRemove: () => void; command?: RichTextEditorCommandRequest | null; onSelectionSize?: (size: number) => void }) {
  if (block.type === "rich-text") return <div className="quote-editor-document-block quote-editor-document-rich-text" data-block-id={block.id}><InlineRichTextEditor initialValue={block.text} onSelectionSize={onSelectionSize} ariaLabel={block.sourceId === QUOTE_INTRO_BLOCK_ID ? "Apresentação da proposta" : "Texto da proposta"} placeholder={block.sourceId === QUOTE_INTRO_BLOCK_ID ? "Escreva aqui a apresentação da proposta, o contexto do projeto ou qualquer texto que deve vir antes dos serviços." : undefined} className="quote-editor-document-rich-content" onFocus={onActivate} onBlur={onCommit} onChange={(value) => onInput(value ?? "")} command={command} /></div>;
  const role = quoteDocumentBlockRole(block);
  return <div data-block-id={block.id} className={`quote-editor-document-block quote-editor-document-${block.type} quote-editor-document-${block.fontSize}${role ? ` quote-editor-document-role-${role}` : ""}${block.text ? "" : " is-empty"}`}>
    <div className="quote-editor-document-content" role="textbox" aria-multiline="true" aria-label={block.type === "heading" ? "Título do documento" : "Texto do documento"} contentEditable suppressContentEditableWarning onFocus={onActivate} onBlur={onCommit} onKeyDown={(event) => { if ((event.key === "Backspace" || event.key === "Delete") && !event.currentTarget.innerText.trim()) { event.preventDefault(); onRemove(); } }} onInput={(event) => onInput(event.currentTarget.innerText.slice(0, 4_000))} style={{ textAlign: block.align, fontWeight: block.bold ? 700 : 400, fontStyle: block.italic ? "italic" : "normal", textDecoration: block.underline ? "underline" : "none" }}>{block.text}</div>
  </div>;
}

export function QuoteDocumentEditor({ quoteId, quoteCode, quoteTitle, backHref, initialContent, professional, isCompleted, justSaved = false, preview, templateText }: Props) {
  const [content, setContent] = useState<QuoteDocumentContent>(initialContent);
  const contentRef = useRef<QuoteDocumentContent>(initialContent);
  const documentContentFieldRef = useRef<HTMLInputElement>(null);
  const [activeBlockId, setActiveBlockId] = useState(initialContent.blocks.find((block) => block.id !== "intro-title")?.id ?? "");
  const [richTextCommand, setRichTextCommand] = useState<RichTextEditorCommandRequest | null>(null);
  const [richTextSize, setRichTextSize] = useState(RICH_TEXT_BASE_SIZE);
  const blocks = content.blocks;
  const editableBlocks = blocks.filter((block) => block.id !== "intro-title");
  const activeBlock = editableBlocks.find((block) => block.id === activeBlockId) ?? (activeBlockId.includes("-part-") ? { id: activeBlockId, type: "rich-text" as const, text: "", fontSize: "medium" as const, bold: false, italic: false, underline: false, align: "left" as const } : editableBlocks[0]);
  const canvasRef = useRef<HTMLElement>(null);
  const measureFrameRef = useRef(0);
  const [pageLayout, setPageLayout] = useState<PageLayout | null>(null);
  const [pinnedBlockId, setPinnedBlockId] = useState<string | null>(null);
  const pages = paginateDocument(editableBlocks, pageLayout, pinnedBlockId);

  /** Mede a área útil de uma folha e a altura real de cada bloco; só atualiza o estado quando algo mudou de fato. */
  const measureLayout = useCallback(() => {
    const root = canvasRef.current;
    const page = root?.querySelector<HTMLElement>(".quote-docs-editable-page");
    const body = page?.querySelector<HTMLElement>(".quote-docs-page-content");
    if (!root || !page || !body) return;
    const pageStyle = getComputedStyle(page);
    const bodyStyle = getComputedStyle(body);
    const header = page.querySelector<HTMLElement>(":scope > header")?.offsetHeight ?? 0;
    const footer = page.querySelector<HTMLElement>(":scope > footer")?.offsetHeight ?? 0;
    const capacity = Math.floor(parseFloat(pageStyle.minHeight) - parseFloat(pageStyle.paddingTop) - parseFloat(pageStyle.paddingBottom) - header - footer - parseFloat(bodyStyle.paddingTop) - parseFloat(bodyStyle.paddingBottom));
    if (!Number.isFinite(capacity) || capacity < 200) return;
    const heights: Record<string, number> = {};
    root.querySelectorAll<HTMLElement>("[data-block-id]").forEach((element) => {
      const style = getComputedStyle(element);
      heights[element.dataset.blockId!] = Math.ceil(element.offsetHeight + parseFloat(style.marginTop) + parseFloat(style.marginBottom));
    });
    setPageLayout((current) => {
      if (current && Math.abs(current.capacity - capacity) < 2 && Object.keys(heights).every((id) => Math.abs((current.heights[id] ?? -100) - heights[id]) < 2)) return current;
      return { capacity, heights: { ...current?.heights, ...heights } };
    });
  }, []);

  const scheduleMeasure = useCallback(() => {
    cancelAnimationFrame(measureFrameRef.current);
    measureFrameRef.current = requestAnimationFrame(measureLayout);
  }, [measureLayout]);

  useLayoutEffect(() => { measureLayout(); });
  useEffect(() => {
    window.addEventListener("resize", scheduleMeasure);
    return () => { window.removeEventListener("resize", scheduleMeasure); cancelAnimationFrame(measureFrameRef.current); };
  }, [scheduleMeasure]);
  const totalPages = pages.length + 2;
  const pageHeader = <header className="quote-docs-page-header">
    <div className="quote-docs-page-header-top">
      <div className="quote-docs-page-brand">
        <span className="quote-docs-page-logo"><img src="/assets/images/logo-vr.svg" alt="" /></span>
        <div className="quote-docs-page-professional">
          <span>PROPOSTA COMERCIAL</span>
          <strong>{professional.name}</strong>
          {professional.professionalTitle ? <small>{professional.professionalTitle}</small> : null}
        </div>
      </div>
      <div className="quote-docs-page-client"><span>CLIENTE</span><strong>{preview.client.name}</strong>{[preview.client.company, preview.client.document].filter(Boolean).map((detail) => <small key={detail}>{detail}</small>)}</div>
    </div>
  </header>;

  function updateBlock(id: string, patch: Partial<QuoteDocumentBlock>) {
    const next = { ...contentRef.current, blocks: contentRef.current.blocks.map((block) => block.id === id ? { ...block, ...patch } : block) };
    contentRef.current = next;
    if (documentContentFieldRef.current) documentContentFieldRef.current.value = JSON.stringify(next);
    setContent(next);
  }

  function updateBlockText(id: string, text: string) {
    const next = { ...contentRef.current, blocks: contentRef.current.blocks.map((block) => block.id === id ? { ...block, text } : block) };
    contentRef.current = next;
    if (documentContentFieldRef.current) documentContentFieldRef.current.value = JSON.stringify(next);
  }

  function updateDisplayBlockText(block: DocumentDisplayBlock, text: string) {
    if (!block.sourceId || block.partIndex === undefined) {
      updateBlockText(block.id, text);
      return;
    }
    // As partes exibidas vêm do estado confirmado (não do texto em digitação): a parte em edição substitui
    // exatamente o trecho que ela mostra, sem duplicar o que foi redistribuído para as partes seguintes.
    const displayedSource = content.blocks.find((item) => item.id === block.sourceId);
    if (!displayedSource) return;
    const parts = richTextParts(displayedSource);
    const mergedBlocks = parts.flatMap((part) => parseRichText(part.partIndex === block.partIndex ? text : part.text).blocks);
    updateBlockText(displayedSource.id, serializeRichText({ version: 1, blocks: mergedBlocks }, 16_000) ?? "");
  }

  function commitDocument() {
    setContent(contentRef.current);
  }

  function removeBlock(id: string) {
    if (contentRef.current.blocks.length <= 1) return;
    const next = { ...contentRef.current, blocks: contentRef.current.blocks.filter((block) => block.id !== id) };
    contentRef.current = next;
    if (documentContentFieldRef.current) documentContentFieldRef.current.value = JSON.stringify(next);
    setContent(next);
  }

  function commitBlock(block: DocumentDisplayBlock) {
    setPinnedBlockId(null);
    const sourceId = block.sourceId ?? block.id;
    const source = contentRef.current.blocks.find((item) => item.id === sourceId);
    if (source && source.type !== "rich-text" && !source.text.trim() && contentRef.current.blocks.length > 1) {
      removeBlock(source.id);
      return;
    }
    commitDocument();
  }

  /** Acrescenta o texto padrão ao fim da apresentação (antes dos serviços). */
  function insertTemplateText() {
    if (!templateText) return;
    const current = contentRef.current;
    const merge = (existing: string) => serializeRichText({ version: 1, blocks: [...parseRichText(existing).blocks, ...parseRichText(templateText).blocks] }, 16_000) ?? "";
    const intro = current.blocks.find((block) => block.id === QUOTE_INTRO_BLOCK_ID);
    const blocks: QuoteDocumentBlock[] = intro
      ? current.blocks.map((block) => block.id === intro.id ? { ...block, text: merge(block.text) } : block)
      : [{ id: QUOTE_INTRO_BLOCK_ID, type: "rich-text", text: merge(""), fontSize: "medium", bold: false, italic: false, underline: false, align: "left" }, ...current.blocks];
    const next = { ...current, blocks };
    contentRef.current = next;
    if (documentContentFieldRef.current) documentContentFieldRef.current.value = JSON.stringify(next);
    setPinnedBlockId(null);
    setContent(next);
  }

  function applyRichTextCommand(value: RichTextEditorCommand, size?: number) {
    setRichTextCommand((current) => ({ id: (current?.id ?? 0) + 1, value, size }));
  }

  return <form className="quote-document-editor quote-docs-editor" action={updateQuoteDocumentAction}>
    <input type="hidden" name="quoteId" value={quoteId} />
    <input ref={documentContentFieldRef} type="hidden" name="documentContent" defaultValue={JSON.stringify(content)} />
    <section className="quote-docs-toolbar" aria-label="Ferramentas do editor">
      <div className="quote-docs-toolbar-meta"><div className="quote-docs-toolbar-title"><span>{quoteCode} · {isCompleted ? "CONCLUÍDO" : "PENDENTE DE CONCLUSÃO"}</span><strong>{quoteTitle}</strong>{justSaved ? <small className="quote-docs-saved" role="status">Alterações salvas. Conclua quando o documento estiver pronto.</small> : null}</div><div className="quote-docs-toolbar-actions"><SidebarToggle location="header" hideWhenOpen /><button className="quote-docs-back-link quote-docs-template-link" type="submit" name="intent" value="template" title="Salva este PDF e abre o texto padrão">TEXTO PADRÃO</button><Link className="quote-docs-back-link" href={backHref}>VOLTAR</Link><button className="secondary-action quote-docs-save-draft" type="submit" name="intent" value="save">SALVAR</button><button className="primary-action quote-docs-save" type="submit" name="intent" value="complete">{isCompleted ? "SALVAR E SAIR" : "CONCLUIR"}</button></div></div>
      <div className="quote-docs-toolbar-tools">
        {activeBlock?.type === "rich-text" ? <>
          <span className="quote-docs-tool-context">FORMATAÇÃO DO TEXTO</span>
          <button type="button" aria-label="Negrito" onMouseDown={(event) => event.preventDefault()} onClick={() => applyRichTextCommand("bold")}><strong>N</strong></button>
          <button type="button" aria-label="Itálico" className="quote-docs-italic" onMouseDown={(event) => event.preventDefault()} onClick={() => applyRichTextCommand("italic")}><em>I</em></button>
          <button type="button" aria-label="Sublinhado" className="quote-docs-underline" onMouseDown={(event) => event.preventDefault()} onClick={() => applyRichTextCommand("underline")}><u>S</u></button>
          <span className="quote-docs-divider" />
          <FontSizeControl size={richTextSize} onStep={(direction) => applyRichTextCommand(direction > 0 ? "increaseFontSize" : "decreaseFontSize")} onSelect={(size) => applyRichTextCommand("fontSize", size)} />
          <span className="quote-docs-divider" />
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => applyRichTextCommand("insertUnorderedList")}>LISTA</button>
          <button type="button" aria-label="Lista numerada" onMouseDown={(event) => event.preventDefault()} onClick={() => applyRichTextCommand("insertOrderedList")}>1.</button>
          <span className="quote-docs-divider" />
          <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => applyRichTextCommand("removeFormat")}>LIMPAR FORMATAÇÃO</button>
        </> : <>
        <select aria-label="Tipo de conteúdo" disabled={!activeBlock} value={activeBlock?.type ?? "paragraph"} onChange={(event) => activeBlock && updateBlock(activeBlock.id, { type: event.target.value as QuoteDocumentBlockType })}><option value="heading">Título</option><option value="paragraph">Texto</option></select>
        <select aria-label="Tamanho do texto" disabled={!activeBlock} value={activeBlock?.fontSize ?? "medium"} onChange={(event) => activeBlock && updateBlock(activeBlock.id, { fontSize: event.target.value as QuoteDocumentFontSize })}>{Object.entries(sizeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <span className="quote-docs-divider" />
        <button type="button" aria-label="Negrito" disabled={!activeBlock} className={activeBlock?.bold ? "is-active" : ""} aria-pressed={activeBlock?.bold ?? false} onClick={() => activeBlock && updateBlock(activeBlock.id, { bold: !activeBlock.bold })}>N</button>
        <button type="button" aria-label="Itálico" disabled={!activeBlock} className={activeBlock?.italic ? "is-active quote-docs-italic" : "quote-docs-italic"} aria-pressed={activeBlock?.italic ?? false} onClick={() => activeBlock && updateBlock(activeBlock.id, { italic: !activeBlock.italic })}>I</button>
        <button type="button" aria-label="Sublinhado" disabled={!activeBlock} className={activeBlock?.underline ? "is-active quote-docs-underline" : "quote-docs-underline"} aria-pressed={activeBlock?.underline ?? false} onClick={() => activeBlock && updateBlock(activeBlock.id, { underline: !activeBlock.underline })}>S</button>
        <select aria-label="Alinhamento" disabled={!activeBlock} value={activeBlock?.align ?? "left"} onChange={(event) => activeBlock && updateBlock(activeBlock.id, { align: event.target.value as QuoteDocumentAlign })}>{Object.entries(alignLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <span className="quote-docs-divider" />
        <button type="button" disabled={!activeBlock} onClick={() => activeBlock && updateBlock(activeBlock.id, { bold: false, italic: false, underline: false, fontSize: activeBlock.type === "heading" ? "large" : "medium", align: "left" })}>LIMPAR FORMATAÇÃO</button>
        </>}
        {templateText ? <>
          <span className="quote-docs-divider" />
          <button type="button" title="Acrescenta o texto padrão à apresentação, antes dos serviços" onMouseDown={(event) => event.preventDefault()} onClick={insertTemplateText}>INSERIR TEXTO PADRÃO</button>
        </> : null}
      </div>
    </section>
    <section className="quote-docs-canvas" aria-label="Documento editável" ref={canvasRef}>
      <div className="quote-docs-pages">
        <QuoteCoverPreview quote={preview} professional={professional} />
        {pages.map((page, pageIndex) => <article className="quote-docs-page quote-docs-editable-page" key={`page-${pageIndex}`}>
          {pageHeader}
          <div className="quote-docs-page-content">
            {page.blocks.map((block) => <EditableBlock key={block.type === "rich-text" ? `${block.id}:${textSignature(block.text)}` : block.id} block={block} onActivate={() => { setActiveBlockId(block.id); setPinnedBlockId(block.id); }} onInput={(text) => { updateDisplayBlockText(block, text); scheduleMeasure(); }} onCommit={() => commitBlock(block)} onRemove={() => removeBlock(block.sourceId ?? block.id)} command={activeBlockId === block.id && block.type === "rich-text" ? richTextCommand : null} onSelectionSize={setRichTextSize} />)}
          </div>
          <footer><span />{pageIndex + 2} / {totalPages}</footer>
        </article>)}
        <QuoteClosingPreview quote={preview} professional={professional} pageNumber={totalPages} />
      </div>
    </section>
  </form>;
}
