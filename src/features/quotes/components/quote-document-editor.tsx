"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { InlineRichTextEditor, type RichTextEditorCommand, type RichTextEditorCommandRequest } from "@/features/services/components/service-proposal-editor";
import { QuoteClosingPreview, QuoteCoverPreview, type QuotePreviewData } from "@/features/quotes/components/quote-document-previews";
import { updateQuoteDocumentAction } from "@/features/quotes/services/quote-actions";
import { QUOTE_INTRO_BLOCK_ID, quoteDocumentBlockRole, type QuoteDocumentAlign, type QuoteDocumentBlock, type QuoteDocumentBlockType, type QuoteDocumentContent, type QuoteDocumentFontSize } from "@/features/quotes/types/document-content";
import { isBlankRichTextRuns, mergeAdjacentRichTextLists, parseRichText, RICH_TEXT_BASE_SIZE, RICH_TEXT_SIZES, richTextLineHeight, richTextPlainText, serializeRichText, type RichTextBlock, type RichTextParagraphStyle, type RichTextRun } from "@/lib/rich-text";

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

/** Parte de um texto rico exibida numa folha: os itens [atomStart, atomStart + atomCount) do texto de origem. */
type DocumentDisplayBlock = QuoteDocumentBlock & { sourceId?: string; partIndex?: number; atomStart?: number; atomCount?: number; atomTotal?: number };
type DocumentPage = { blocks: DocumentDisplayBlock[] };
/** Parte em edição: fica como está enquanto o usuário digita, para o editor não ser recriado sob o cursor. */
type PinnedPart = { id: string; sourceId: string; atomStart: number; atomCount: number; pageIndex: number };
type FocusRequest = { sourceId: string; atomIndex: number; offset: number };

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

/** Itens indivisíveis do texto rico: cada parágrafo e cada item de lista. */
function richTextAtoms(text: string): RichTextBlock[] {
  return parseRichText(text).blocks.flatMap((item): RichTextBlock[] => item.type === "paragraph" ? [item] : item.items.map((runs) => ({ type: item.type, items: [runs] })));
}

function serializeAtoms(atoms: RichTextBlock[]) {
  return serializeRichText({ version: 1, blocks: mergeAdjacentRichTextLists(atoms) }, 16_000) ?? "";
}

function atomRuns(atom: RichTextBlock) {
  return atom.type === "paragraph" ? atom.runs : atom.items[0] ?? [];
}

function withAtomRuns(atom: RichTextBlock, runs: RichTextRun[]): RichTextBlock {
  return atom.type === "paragraph" ? { ...atom, runs } : { type: atom.type, items: [runs] };
}

function atomTextLength(atom: RichTextBlock) {
  return isBlankRichTextRuns(atomRuns(atom)) ? 0 : atomRuns(atom).reduce((total, run) => total + run.text.length, 0);
}

/** Une dois itens vizinhos (Backspace no início ou Delete no fim de uma parte). Devolve o item e onde fica o cursor. */
function joinAtoms(first: RichTextBlock, second: RichTextBlock): { atom: RichTextBlock; caret: number } {
  if (isBlankRichTextRuns(atomRuns(second))) return { atom: first, caret: atomTextLength(first) };
  if (isBlankRichTextRuns(atomRuns(first))) return { atom: second, caret: 0 };
  return { atom: withAtomRuns(first, [...atomRuns(first), ...atomRuns(second)]), caret: atomTextLength(first) };
}

const PARAGRAPH_STYLE_SIZES: Record<RichTextParagraphStyle, number> = { title: 18, subtitle: 13, section: 10 };

function estimatedAtomHeight(atom: RichTextBlock) {
  const runs = atomRuns(atom);
  if (atom.type === "paragraph" && atom.style === "section") return 46;
  const baseSize = atom.type === "paragraph" && atom.style ? PARAGRAPH_STYLE_SIZES[atom.style] : RICH_TEXT_BASE_SIZE;
  const size = Math.max(baseSize, ...runs.map((run) => run.size ?? baseSize));
  const scale = size / RICH_TEXT_BASE_SIZE;
  const text = runs.map((run) => run.text).join("");
  const charactersPerLine = (atom.type === "paragraph" ? 74 : 69) / scale;
  const lines = Math.max(1, text.split("\n").reduce((total, line) => total + Math.max(1, Math.ceil(line.length / charactersPerLine)), 0));
  return Math.ceil(lines * 25 * scale * (richTextLineHeight(size) / 1.65)) + (atom.type === "paragraph" ? 8 : 3);
}

/** Unidade de paginação: um bloco comum, um item de texto rico ou a parte inteira que está sendo editada. */
type PaginationUnit = { block: QuoteDocumentBlock; atoms?: { start: number; items: RichTextBlock[]; total: number; pinnedId?: string } };

function paginationUnits(blocks: QuoteDocumentBlock[], pinned: PinnedPart | null) {
  return blocks.flatMap((block): PaginationUnit[] => {
    if (block.type !== "rich-text") return [{ block }];
    const atoms = richTextAtoms(block.text);
    const total = atoms.length;
    if (!richTextPlainText(block.text).trim()) {
      // A apresentação continua visível mesmo vazia, para que sempre exista onde escrever antes dos serviços.
      return block.id === QUOTE_INTRO_BLOCK_ID ? [{ block, atoms: { start: 0, items: atoms, total, pinnedId: pinned?.sourceId === block.id ? pinned.id : undefined } }] : [];
    }
    const pin = pinned?.sourceId === block.id && pinned.atomStart >= 0 && pinned.atomStart + pinned.atomCount <= total ? pinned : null;
    const units: PaginationUnit[] = [];
    for (let index = 0; index < total; index += 1) {
      if (pin && index === pin.atomStart) {
        units.push({ block, atoms: { start: index, items: atoms.slice(index, index + pin.atomCount), total, pinnedId: pin.id } });
        index += Math.max(0, pin.atomCount - 1);
        continue;
      }
      units.push({ block, atoms: { start: index, items: [atoms[index]], total } });
    }
    return units;
  });
}

/** Mantém título do serviço, categoria e o início da descrição juntos; o rótulo de seção acompanha o primeiro serviço. */
function paginationGroups(units: PaginationUnit[]) {
  const groups: PaginationUnit[][] = [];
  let index = 0;
  const serviceGroup = (start: number) => {
    const group = [units[start]];
    const suffix = units[start].block.id.slice("service-title-".length);
    let next = start + 1;
    if (units[next]?.block.id === `service-category-${suffix}`) group.push(units[next++]);
    if (units[next]?.block.id === `service-description-${suffix}`) group.push(units[next++]);
    return { group, next };
  };
  while (index < units.length) {
    const unit = units[index];
    if (unit.block.id === "services-label" && units[index + 1]?.block.id.startsWith("service-title-")) {
      const service = serviceGroup(index + 1);
      groups.push([unit, ...service.group]);
      index = service.next;
      continue;
    }
    if (unit.block.id.startsWith("service-title-")) {
      const service = serviceGroup(index);
      groups.push(service.group);
      index = service.next;
      continue;
    }
    groups.push([unit]);
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

function continuesPart(previous: PaginationUnit | undefined, unit: PaginationUnit) {
  return Boolean(previous?.atoms && unit.atoms && !previous.atoms.pinnedId && !unit.atoms.pinnedId && previous.block.id === unit.block.id && previous.atoms.start + previous.atoms.items.length === unit.atoms.start);
}

function unitHeight(unit: PaginationUnit, previous: PaginationUnit | undefined, layout: PageLayout | null) {
  if (!unit.atoms) return layout?.heights[unit.block.id] ?? estimatedBlockHeight(unit.block);
  const overhead = layout?.heights[`${unit.block.id}#overhead`] ?? 24;
  if (unit.atoms.pinnedId) return layout?.heights[unit.atoms.pinnedId] ?? unit.atoms.items.reduce((total, atom) => total + estimatedAtomHeight(atom), overhead);
  // A apresentação vazia é exibida sem itens: ocupa uma linha para o texto de orientação.
  const atomHeight = unit.atoms.items.length ? layout?.heights[`${unit.block.id}#${unit.atoms.start}`] ?? estimatedAtomHeight(unit.atoms.items[0]) : 26;
  return atomHeight + (continuesPart(previous, unit) ? 0 : overhead);
}

/**
 * Distribui o documento pelas folhas usando a altura medida na tela (ou uma estimativa antes da primeira medição).
 * O texto rico é paginado parágrafo a parágrafo e, em cada folha, os parágrafos de um mesmo texto formam um único
 * editor: dentro da folha é possível apagar, selecionar e formatar livremente. A parte em edição nunca é empurrada
 * para a folha seguinte, para o cursor não sair do lugar; o que vem depois dela é que avança quando a folha enche.
 */
function paginateDocument(blocks: QuoteDocumentBlock[], layout: PageLayout | null, pinned: PinnedPart | null) {
  const capacity = layout?.capacity ?? 790;
  const unitPages: PaginationUnit[][] = [[]];
  let usedHeight = 0;
  for (const group of paginationGroups(paginationUnits(blocks, pinned))) {
    const heightOn = (previous: PaginationUnit | undefined) => group.reduce((total, unit, index) => total + unitHeight(unit, index ? group[index - 1] : previous, layout), 0);
    const isPinned = group.some((unit) => unit.atoms ? Boolean(unit.atoms.pinnedId) : pinned?.id === unit.block.id);
    // A parte em edição fica na folha em que estava: não avança nem volta para a folha anterior.
    while (isPinned && pinned && unitPages.length - 1 < pinned.pageIndex) {
      unitPages.push([]);
      usedHeight = 0;
    }
    let height = heightOn(unitPages.at(-1)!.at(-1));
    if (unitPages.at(-1)!.length && usedHeight + height > capacity && !isPinned) {
      unitPages.push([]);
      usedHeight = 0;
      height = heightOn(undefined);
    }
    unitPages.at(-1)!.push(...group);
    usedHeight += height;
  }

  const partCounters: Record<string, number> = {};
  return unitPages.map((units): DocumentPage => {
    const pageBlocks: DocumentDisplayBlock[] = [];
    const pageItems: RichTextBlock[][] = [];
    units.forEach((unit, index) => {
      if (!unit.atoms) {
        pageBlocks.push(unit.block);
        pageItems.push([]);
        return;
      }
      if (continuesPart(units[index - 1], unit)) {
        pageBlocks.at(-1)!.atomCount! += unit.atoms.items.length;
        pageItems.at(-1)!.push(...unit.atoms.items);
        return;
      }
      const partIndex = partCounters[unit.block.id] ?? 0;
      partCounters[unit.block.id] = partIndex + 1;
      let id = unit.atoms.pinnedId ?? `${unit.block.id}-part-${partIndex}`;
      if (!unit.atoms.pinnedId && pinned && id === pinned.id) id = `${id}-next`;
      pageBlocks.push({ ...unit.block, id, sourceId: unit.block.id, partIndex, atomStart: unit.atoms.start, atomCount: unit.atoms.items.length, atomTotal: unit.atoms.total });
      pageItems.push([...unit.atoms.items]);
    });
    return { blocks: pageBlocks.map((block, index) => block.sourceId ? { ...block, text: serializeAtoms(pageItems[index]) } : block) };
  });
}

/** Elementos que correspondem, em ordem, aos itens de uma parte: parágrafos e itens de lista. */
function atomElements(editor: Element) {
  return Array.from(editor.children).flatMap((child) => child.tagName === "UL" || child.tagName === "OL" ? Array.from(child.children).filter((item) => item.tagName === "LI") : [child]) as HTMLElement[];
}

/** O cursor está no início (ou no fim) do editor, sem texto nem outra linha antes (ou depois) dele. */
function caretAtEdge(editor: HTMLElement, edge: "start" | "end") {
  const selection = window.getSelection();
  if (!selection?.rangeCount || !selection.isCollapsed) return false;
  const range = selection.getRangeAt(0);
  if (!editor.contains(range.startContainer)) return false;
  const probe = document.createRange();
  probe.selectNodeContents(editor);
  if (edge === "start") probe.setEnd(range.startContainer, range.startOffset);
  else probe.setStart(range.endContainer, range.endOffset);
  if (probe.toString().length) return false;
  const fragment = probe.cloneContents();
  return fragment.querySelectorAll("p, div, li").length <= 1 && fragment.querySelectorAll("br").length <= (edge === "end" ? 1 : 0);
}

/** Coloca o cursor no caractere `offset` de um elemento (Infinity = fim). */
function placeCaret(element: HTMLElement, offset: number) {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let remaining = offset;
  let node = walker.nextNode() as Text | null;
  let last: Text | null = null;
  while (node) {
    if (remaining <= node.data.length) {
      range.setStart(node, remaining);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      return;
    }
    remaining -= node.data.length;
    last = node;
    node = walker.nextNode() as Text | null;
  }
  if (last) range.setStart(last, last.data.length);
  else range.setStart(element, 0);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

/** Menu suspenso da barra: posição fixa (a barra rola na horizontal) e fecha com Esc, clique fora, rolagem ou redimensionamento. */
function useToolbarMenu(menuClass: string) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!position) return;
    const close = (event: Event) => {
      if (event instanceof globalThis.KeyboardEvent && event.key !== "Escape") return;
      if (event.type === "pointerdown" && ((event.target as Element | null)?.closest(`.${menuClass}`) || triggerRef.current?.contains(event.target as Node))) return;
      setPosition(null);
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
  }, [position, menuClass]);

  function toggle(width: number) {
    if (position) {
      setPosition(null);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setPosition({ top: rect.bottom + 4, left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)) });
  }

  return { position, triggerRef, toggle, close: () => setPosition(null) };
}

/** Tamanho do texto: diminuir, escolher na lista ou aumentar. Os botões não tiram o foco do texto em edição. */
function FontSizeControl({ size, onStep, onSelect }: { size: number; onStep: (direction: 1 | -1) => void; onSelect: (size: number) => void }) {
  const menu = useToolbarMenu("quote-docs-size-menu");
  return <div className="quote-docs-size" role="group" aria-label="Tamanho da fonte">
    <button type="button" className="quote-docs-size-step" aria-label="Diminuir fonte" title="Diminuir fonte" disabled={size <= RICH_TEXT_SIZES[0]} onMouseDown={(event) => event.preventDefault()} onClick={() => onStep(-1)}>A<small>-</small></button>
    <button type="button" ref={menu.triggerRef} className="quote-docs-size-current" aria-haspopup="listbox" aria-expanded={menu.position !== null} aria-label={`Tamanho da fonte: ${size} pontos`} onMouseDown={(event) => event.preventDefault()} onClick={() => menu.toggle(128)}>{size}<small>PT</small></button>
    <button type="button" className="quote-docs-size-step is-increase" aria-label="Aumentar fonte" title="Aumentar fonte" disabled={size >= RICH_TEXT_SIZES.at(-1)!} onMouseDown={(event) => event.preventDefault()} onClick={() => onStep(1)}>A<small>+</small></button>
    {menu.position ? <div className="quote-docs-size-menu" role="listbox" aria-label="Tamanhos disponíveis" style={{ top: menu.position.top, left: menu.position.left }}>
      {RICH_TEXT_SIZES.map((option) => <button type="button" role="option" aria-selected={option === size} key={option} className={option === size ? "is-active" : ""} onMouseDown={(event) => event.preventDefault()} onClick={() => { onSelect(option); menu.close(); }}><span style={{ fontSize: `${Math.min(option, 20) / RICH_TEXT_BASE_SIZE * 0.8}rem` }}>{option}</span>{option === RICH_TEXT_BASE_SIZE ? <small>NORMAL</small> : null}</button>)}
    </div> : null}
  </div>;
}

const paragraphStyleOptions: Array<{ value: RichTextParagraphStyle | null; label: string }> = [
  { value: null, label: "Texto" },
  { value: "title", label: "Título" },
  { value: "subtitle", label: "Subtítulo" },
  { value: "section", label: "Seção" },
];

/** Estilo da linha: texto, título, subtítulo ou rótulo de seção (o mesmo visual de SERVIÇOS INCLUÍDOS). */
function ParagraphStyleControl({ style, onSelect }: { style: RichTextParagraphStyle | null; onSelect: (style: RichTextParagraphStyle | null) => void }) {
  const menu = useToolbarMenu("quote-docs-style-menu");
  const current = paragraphStyleOptions.find((option) => option.value === style) ?? paragraphStyleOptions[0];
  return <>
    <button type="button" ref={menu.triggerRef} className="quote-docs-style-current" aria-haspopup="listbox" aria-expanded={menu.position !== null} aria-label={`Estilo da linha: ${current.label}`} title="Estilo da linha" onMouseDown={(event) => event.preventDefault()} onClick={() => menu.toggle(220)}>{current.label.toUpperCase()}</button>
    {menu.position ? <div className="quote-docs-style-menu" role="listbox" aria-label="Estilos de linha" style={{ top: menu.position.top, left: menu.position.left }}>
      {paragraphStyleOptions.map((option) => <button type="button" role="option" aria-selected={option.value === style} key={option.label} className={`quote-docs-style-option is-${option.value ?? "text"}${option.value === style ? " is-active" : ""}`} onMouseDown={(event) => event.preventDefault()} onClick={() => { onSelect(option.value); menu.close(); }}><span>{option.label}</span></button>)}
    </div> : null}
  </>;
}

type PartBoundaryAction = "merge-backward" | "merge-forward" | "focus-previous" | "focus-next";

/** Backspace/Delete e setas na borda de uma parte continuam no texto da folha vizinha. */
function partBoundaryAction(event: KeyboardEvent<HTMLDivElement>, block: DocumentDisplayBlock): PartBoundaryAction | null {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || block.atomStart === undefined || block.atomCount === undefined || block.atomTotal === undefined) return null;
  const hasPrevious = block.atomStart > 0;
  const hasNext = block.atomStart + block.atomCount < block.atomTotal;
  const editor = event.currentTarget;
  if ((event.key === "Backspace" || event.key === "ArrowLeft" || event.key === "ArrowUp") && hasPrevious && caretAtEdge(editor, "start")) return event.key === "Backspace" ? "merge-backward" : "focus-previous";
  if ((event.key === "Delete" || event.key === "ArrowRight" || event.key === "ArrowDown") && hasNext && caretAtEdge(editor, "end")) return event.key === "Delete" ? "merge-forward" : "focus-next";
  return null;
}

/** Blocos gerados a partir do orçamento: podem ter o texto ajustado, mas nunca são apagados. */
function isProtectedBlock(block: QuoteDocumentBlock) {
  const role = quoteDocumentBlockRole(block);
  return role === "section-label" || role === "service-title" || role === "service-category";
}

function caretAtTextStart(element: HTMLElement) {
  const selection = window.getSelection();
  if (!selection?.rangeCount || !selection.isCollapsed) return false;
  const probe = document.createRange();
  probe.selectNodeContents(element);
  probe.setEnd(selection.getRangeAt(0).startContainer, selection.getRangeAt(0).startOffset);
  return probe.toString().length === 0;
}

function EditableBlock({ block, onActivate, onInput, onCommit, onRemove, onBoundary, onPullUp, command, onSelectionSize, onSelectionStyle }: { block: DocumentDisplayBlock; onActivate: () => void; onInput: (text: string) => void; onCommit: () => void; onRemove: () => void; onBoundary: (action: PartBoundaryAction) => void; onPullUp: () => void; command?: RichTextEditorCommandRequest | null; onSelectionSize?: (size: number) => void; onSelectionStyle?: (style: RichTextParagraphStyle | null) => void }) {
  if (block.type === "rich-text") return <div className="quote-editor-document-block quote-editor-document-rich-text" data-block-id={block.id} data-source-id={block.sourceId} data-atom-start={block.atomStart} data-atom-count={block.atomCount}><InlineRichTextEditor initialValue={block.text} onSelectionSize={onSelectionSize} onSelectionStyle={onSelectionStyle} onKeyDown={(event) => { const action = partBoundaryAction(event, block); if (!action) return; event.preventDefault(); onBoundary(action); }} ariaLabel={block.sourceId === QUOTE_INTRO_BLOCK_ID ? "Apresentação da proposta" : "Texto da proposta"} placeholder={block.sourceId === QUOTE_INTRO_BLOCK_ID ? "Escreva aqui a apresentação da proposta, o contexto do projeto ou qualquer texto que deve vir antes dos serviços." : undefined} className="quote-editor-document-rich-content" onFocus={onActivate} onBlur={onCommit} onChange={(value) => onInput(value ?? "")} command={command} /></div>;
  const role = quoteDocumentBlockRole(block);
  const className = `quote-editor-document-block quote-editor-document-${block.type} quote-editor-document-${block.fontSize}${role ? ` quote-editor-document-role-${role}` : ""}${block.text ? "" : " is-empty"}`;
  // O rótulo da seção de serviços não é editável: o estilo dele precisa ser mantido. Selecionado, o Backspace
  // apaga as linhas em branco logo acima, trazendo a seção de volta para a folha anterior.
  if (role === "section-label") return <div data-block-id={block.id} className={className}>
    <div className="quote-editor-document-content" tabIndex={0} role="heading" aria-level={2} title="Selecione e use Backspace para apagar as linhas em branco acima" onFocus={onActivate} onBlur={onCommit} onKeyDown={(event) => { if (event.key === "Backspace") { event.preventDefault(); onPullUp(); } }}>{block.text}</div>
  </div>;
  return <div data-block-id={block.id} className={className}>
    <div className="quote-editor-document-content" role="textbox" aria-multiline="true" aria-label={block.type === "heading" ? "Título do documento" : "Texto do documento"} contentEditable suppressContentEditableWarning onFocus={onActivate} onBlur={onCommit} onKeyDown={(event) => {
      if (event.key === "Backspace" && caretAtTextStart(event.currentTarget) && event.currentTarget.innerText.trim()) { event.preventDefault(); onPullUp(); return; }
      if ((event.key === "Backspace" || event.key === "Delete") && !event.currentTarget.innerText.trim()) { event.preventDefault(); if (!isProtectedBlock(block)) onRemove(); }
    }} onInput={(event) => onInput(event.currentTarget.innerText.slice(0, 4_000))} style={{ textAlign: block.align, fontWeight: block.bold ? 700 : 400, fontStyle: block.italic ? "italic" : "normal", textDecoration: block.underline ? "underline" : "none" }}>{block.text}</div>
  </div>;
}

export function QuoteDocumentEditor({ quoteId, quoteCode, quoteTitle, backHref, initialContent, professional, isCompleted, justSaved = false, preview, templateText }: Props) {
  const [content, setContent] = useState<QuoteDocumentContent>(initialContent);
  const contentRef = useRef<QuoteDocumentContent>(initialContent);
  const documentContentFieldRef = useRef<HTMLInputElement>(null);
  const [activeBlockId, setActiveBlockId] = useState(initialContent.blocks.find((block) => block.id !== "intro-title")?.id ?? "");
  const [richTextCommand, setRichTextCommand] = useState<RichTextEditorCommandRequest | null>(null);
  const [richTextSize, setRichTextSize] = useState(RICH_TEXT_BASE_SIZE);
  const [richTextStyle, setRichTextStyle] = useState<RichTextParagraphStyle | null>(null);
  const [restoreVersion, setRestoreVersion] = useState(0);
  // Editores de texto rico são não controlados: o que foi digitado fica no DOM. Ao confirmar ou redistribuir o
  // texto, a parte editada precisa ser recriada mesmo quando o texto dela volta a ser igual ao anterior
  // (senão continuaria mostrando um parágrafo que foi para a folha seguinte).
  const editedPartsRef = useRef(new Set<string>());
  const [partVersions, setPartVersions] = useState<Record<string, number>>({});
  const reflowRef = useRef<(wrapper: HTMLElement) => void>(() => undefined);
  const reflowGuardRef = useRef<{ content: QuoteDocumentContent | null; count: number }>({ content: null, count: 0 });
  const blocks = content.blocks;
  const editableBlocks = blocks.filter((block) => block.id !== "intro-title");
  const activeBlock = editableBlocks.find((block) => block.id === activeBlockId) ?? (activeBlockId.includes("-part-") ? { id: activeBlockId, type: "rich-text" as const, text: "", fontSize: "medium" as const, bold: false, italic: false, underline: false, align: "left" as const } : editableBlocks[0]);
  const canvasRef = useRef<HTMLElement>(null);
  const measureFrameRef = useRef(0);
  const measureBurstRef = useRef({ since: 0, updates: 0 });
  const [pageLayout, setPageLayout] = useState<PageLayout | null>(null);
  const [pinnedPart, setPinnedPart] = useState<PinnedPart | null>(null);
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const pages = paginateDocument(editableBlocks, pageLayout, pinnedPart);

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
      const outerHeight = Math.ceil(element.offsetHeight + parseFloat(style.marginTop) + parseFloat(style.marginBottom));
      heights[element.dataset.blockId!] = outerHeight;
      // Altura de cada parágrafo, para paginar o texto rico parágrafo a parágrafo. Só vale quando a parte
      // tem exatamente os itens de origem (durante a digitação a contagem muda até o texto ser confirmado).
      const { sourceId, atomStart, atomCount } = element.dataset;
      const editor = element.querySelector("[contenteditable]");
      if (!sourceId || atomStart === undefined || atomCount === undefined || !editor) return;
      const atoms = atomElements(editor);
      if (!atoms.length || atoms.length !== Number(atomCount)) return;
      // Altura própria + margens do item: não depende da posição dele na folha (o que faria a paginação oscilar).
      atoms.forEach((atom, index) => {
        const atomStyle = getComputedStyle(atom);
        heights[`${sourceId}#${Number(atomStart) + index}`] = Math.max(1, Math.ceil(atom.offsetHeight + parseFloat(atomStyle.marginTop) + parseFloat(atomStyle.marginBottom)));
      });
      heights[`${sourceId}#overhead`] = Math.ceil(parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) + parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth) + parseFloat(style.marginTop) + parseFloat(style.marginBottom));
    });
    // Trava de segurança: se as medidas ficarem mudando sem parar, a paginação congela até o próximo segundo.
    const now = performance.now();
    const burst = measureBurstRef.current;
    if (now - burst.since > 1000) measureBurstRef.current = { since: now, updates: 0 };
    setPageLayout((current) => {
      if (current && Math.abs(current.capacity - capacity) < 2 && Object.keys(heights).every((id) => Math.abs((current.heights[id] ?? -100) - heights[id]) < 2)) return current;
      if (measureBurstRef.current.updates > 40) return current;
      measureBurstRef.current.updates += 1;
      return { capacity, heights: { ...current?.heights, ...heights } };
    });
    // A folha do texto em edição passou do tamanho de uma página: redistribui na hora, sem esperar o usuário sair do texto.
    const wrapper = document.activeElement instanceof HTMLElement ? document.activeElement.closest<HTMLElement>("[data-source-id]") : null;
    const activePage = wrapper?.closest<HTMLElement>(".quote-docs-editable-page");
    if (wrapper && activePage && root.contains(activePage) && activePage.offsetHeight > parseFloat(pageStyle.minHeight) + 2) reflowRef.current(wrapper);
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

  function commitContent(next: QuoteDocumentContent) {
    if (editedPartsRef.current.size) {
      const edited = Array.from(editedPartsRef.current);
      editedPartsRef.current.clear();
      setPartVersions((current) => ({ ...current, ...Object.fromEntries(edited.map((id) => [id, (current[id] ?? 0) + 1])) }));
    }
    setContent(next);
  }

  function updateBlock(id: string, patch: Partial<QuoteDocumentBlock>) {
    const next = { ...contentRef.current, blocks: contentRef.current.blocks.map((block) => block.id === id ? { ...block, ...patch } : block) };
    contentRef.current = next;
    if (documentContentFieldRef.current) documentContentFieldRef.current.value = JSON.stringify(next);
    commitContent(next);
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
    // exatamente os itens que ela mostra, sem duplicar o que foi distribuído para as outras folhas.
    const displayedSource = content.blocks.find((item) => item.id === block.sourceId);
    if (!displayedSource || block.atomStart === undefined || block.atomCount === undefined) return;
    const atoms = richTextAtoms(displayedSource.text);
    const merged = [...atoms.slice(0, block.atomStart), ...richTextAtoms(text), ...atoms.slice(block.atomStart + block.atomCount)];
    updateBlockText(displayedSource.id, serializeAtoms(merged));
  }

  /** Continua a edição na folha vizinha: une os parágrafos da quebra (Backspace/Delete) ou só move o cursor (setas). */
  function handlePartBoundary(block: DocumentDisplayBlock, action: PartBoundaryAction) {
    const source = contentRef.current.blocks.find((item) => item.id === block.sourceId);
    if (!source || block.atomStart === undefined || block.atomCount === undefined || block.atomTotal === undefined) return;
    const atoms = richTextAtoms(source.text);
    // Os itens antes e depois da parte não mudam enquanto ela é editada; só a contagem da própria parte pode mudar.
    const firstAfter = atoms.length - (block.atomTotal - block.atomStart - block.atomCount);
    let request: FocusRequest;
    if (action === "focus-previous") request = { sourceId: source.id, atomIndex: block.atomStart - 1, offset: Infinity };
    else if (action === "focus-next") request = { sourceId: source.id, atomIndex: firstAfter, offset: 0 };
    else {
      const boundary = action === "merge-backward" ? block.atomStart : firstAfter;
      if (boundary <= 0 || boundary >= atoms.length) return;
      const joined = joinAtoms(atoms[boundary - 1], atoms[boundary]);
      updateBlockText(source.id, serializeAtoms([...atoms.slice(0, boundary - 1), joined.atom, ...atoms.slice(boundary + 1)]));
      request = { sourceId: source.id, atomIndex: boundary - 1, offset: joined.caret };
    }
    setPinnedPart(null);
    setFocusRequest(request);
    commitContent(contentRef.current);
  }

  useLayoutEffect(() => {
    if (!focusRequest) return;
    const parts = Array.from(canvasRef.current?.querySelectorAll<HTMLElement>(`[data-source-id="${focusRequest.sourceId}"]`) ?? []);
    const part = parts.find((element) => Number(element.dataset.atomStart) <= focusRequest.atomIndex && focusRequest.atomIndex < Number(element.dataset.atomStart) + Number(element.dataset.atomCount));
    const editor = part?.querySelector<HTMLElement>("[contenteditable]");
    if (!part || !editor) return;
    setFocusRequest(null);
    editor.focus();
    const atom = atomElements(editor)[focusRequest.atomIndex - Number(part.dataset.atomStart)];
    placeCaret(atom ?? editor, focusRequest.offset);
  }, [focusRequest, pages]);

  function commitDocument() {
    commitContent(contentRef.current);
  }

  function removeBlock(id: string) {
    if (contentRef.current.blocks.length <= 1) return;
    const next = { ...contentRef.current, blocks: contentRef.current.blocks.filter((block) => block.id !== id) };
    contentRef.current = next;
    if (documentContentFieldRef.current) documentContentFieldRef.current.value = JSON.stringify(next);
    commitContent(next);
  }

  function commitBlock(block: DocumentDisplayBlock) {
    setPinnedPart(null);
    const sourceId = block.sourceId ?? block.id;
    const source = contentRef.current.blocks.find((item) => item.id === sourceId);
    if (source && source.type !== "rich-text" && !source.text.trim()) {
      if (isProtectedBlock(source)) {
        // Título e categoria do serviço não somem: esvaziados, voltam ao texto anterior.
        const previous = content.blocks.find((item) => item.id === source.id);
        if (previous?.text.trim()) updateBlockText(source.id, previous.text);
        setRestoreVersion((version) => version + 1);
      } else if (contentRef.current.blocks.length > 1) {
        removeBlock(source.id);
        return;
      }
    }
    commitDocument();
  }

  /**
   * Redistribui a parte em edição quando ela não cabe mais na folha: o texto é confirmado, a paginação refeita
   * e o cursor volta ao mesmo parágrafo e posição — na folha seguinte, se for para lá que ele foi.
   * Limitado a duas tentativas por alteração para nunca entrar em ciclo (um parágrafo maior que a folha, por exemplo).
   */
  reflowRef.current = (wrapper: HTMLElement) => {
    const guard = reflowGuardRef.current;
    if (guard.content !== contentRef.current) reflowGuardRef.current = { content: contentRef.current, count: 0 };
    if (reflowGuardRef.current.count >= 2) return;
    const editor = wrapper.querySelector<HTMLElement>("[contenteditable]");
    const sourceId = wrapper.dataset.sourceId;
    const selection = window.getSelection();
    if (!editor || !sourceId || !selection?.rangeCount || !editor.contains(selection.anchorNode)) return;
    // Texto solto no início do editor (primeira linha digitada num editor vazio) conta como o primeiro parágrafo.
    const leadingInline = Array.from(editor.childNodes).findIndex((node) => node instanceof HTMLElement && !["A", "B", "BR", "EM", "FONT", "I", "SPAN", "STRONG", "U"].includes(node.tagName));
    const inlineNodes = Array.from(editor.childNodes).slice(0, leadingInline === -1 ? editor.childNodes.length : leadingInline);
    const hasLeadingParagraph = inlineNodes.some((node) => node.textContent?.length || (node instanceof HTMLElement && node.tagName === "BR"));
    const atoms = atomElements(editor);
    const anchor = selection.anchorNode!;
    let index = atoms.findIndex((atom) => atom === anchor || atom.contains(anchor));
    let container: Node = editor;
    if (index >= 0) {
      container = atoms[index];
      if (hasLeadingParagraph) index += 1;
    } else if (hasLeadingParagraph && inlineNodes.some((node) => node === anchor || node.contains(anchor))) {
      index = 0;
    } else return;
    const probe = document.createRange();
    probe.selectNodeContents(container);
    probe.setEnd(anchor, selection.anchorOffset);
    reflowGuardRef.current.count += 1;
    setPinnedPart(null);
    setFocusRequest({ sourceId, atomIndex: Number(wrapper.dataset.atomStart) + index, offset: probe.toString().length });
    commitContent(contentRef.current);
  };

  /** Backspace no início de um bloco fixo: apaga a linha em branco logo acima dele, no texto anterior. */
  function pullBlockUp(block: DocumentDisplayBlock) {
    const blocksInOrder = contentRef.current.blocks.filter((item) => item.id !== "intro-title");
    const position = blocksInOrder.findIndex((item) => item.id === (block.sourceId ?? block.id));
    const previous = position > 0 ? blocksInOrder[position - 1] : null;
    if (!previous || previous.type !== "rich-text") return;
    const atoms = richTextAtoms(previous.text);
    const last = atoms.at(-1);
    if (!last || !isBlankRichTextRuns(atomRuns(last))) return;
    updateBlockText(previous.id, serializeAtoms(atoms.slice(0, -1)));
    commitContent(contentRef.current);
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
    setPinnedPart(null);
    commitContent(next);
  }

  function applyRichTextCommand(value: RichTextEditorCommand, size?: number, paragraphStyle?: RichTextParagraphStyle | null) {
    setRichTextCommand((current) => ({ id: (current?.id ?? 0) + 1, value, size, paragraphStyle }));
  }

  return <form className="quote-document-editor quote-docs-editor" action={updateQuoteDocumentAction}>
    <input type="hidden" name="quoteId" value={quoteId} />
    <input ref={documentContentFieldRef} type="hidden" name="documentContent" defaultValue={JSON.stringify(content)} />
    <section className="quote-docs-toolbar" aria-label="Ferramentas do editor">
      <div className="quote-docs-toolbar-meta"><div className="quote-docs-toolbar-title"><span>{quoteCode} · {isCompleted ? "CONCLUÍDO" : "PENDENTE DE CONCLUSÃO"}</span><strong>{quoteTitle}</strong>{justSaved ? <small className="quote-docs-saved" role="status">Alterações salvas. Conclua quando o documento estiver pronto.</small> : null}</div><div className="quote-docs-toolbar-actions"><SidebarToggle location="header" hideWhenOpen /><button className="quote-docs-back-link quote-docs-template-link" type="submit" name="intent" value="template" title="Salva este PDF e abre o texto padrão">TEXTO PADRÃO</button><Link className="quote-docs-back-link" href={backHref}>VOLTAR</Link><button className="secondary-action quote-docs-save-draft" type="submit" name="intent" value="save">SALVAR</button><button className="primary-action quote-docs-save" type="submit" name="intent" value="complete">{isCompleted ? "SALVAR E SAIR" : "CONCLUIR"}</button></div></div>
      <div className="quote-docs-toolbar-tools">
        {activeBlock && quoteDocumentBlockRole(activeBlock) === "section-label" ? <span className="quote-docs-tool-context">SEÇÃO FIXA DO ORÇAMENTO · BACKSPACE APAGA AS LINHAS EM BRANCO ACIMA</span> : activeBlock?.type === "rich-text" ? <>
          <span className="quote-docs-tool-context">FORMATAÇÃO DO TEXTO</span>
          <button type="button" aria-label="Negrito" onMouseDown={(event) => event.preventDefault()} onClick={() => applyRichTextCommand("bold")}><strong>N</strong></button>
          <button type="button" aria-label="Itálico" className="quote-docs-italic" onMouseDown={(event) => event.preventDefault()} onClick={() => applyRichTextCommand("italic")}><em>I</em></button>
          <button type="button" aria-label="Sublinhado" className="quote-docs-underline" onMouseDown={(event) => event.preventDefault()} onClick={() => applyRichTextCommand("underline")}><u>S</u></button>
          <span className="quote-docs-divider" />
          <ParagraphStyleControl style={richTextStyle} onSelect={(style) => applyRichTextCommand("paragraphStyle", undefined, style)} />
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
            {page.blocks.map((block) => <EditableBlock key={block.type === "rich-text" ? `${block.id}:${textSignature(block.text)}:${partVersions[block.id] ?? 0}` : `${block.id}:${restoreVersion}`} block={block} onPullUp={() => pullBlockUp(block)} onActivate={() => { setActiveBlockId(block.id); setPinnedPart(block.sourceId && block.atomStart !== undefined && block.atomCount !== undefined ? { id: block.id, sourceId: block.sourceId, atomStart: block.atomStart, atomCount: block.atomCount, pageIndex } : { id: block.id, sourceId: block.id, atomStart: -1, atomCount: 0, pageIndex }); }} onBoundary={(action) => handlePartBoundary(block, action)} onInput={(text) => { if (block.type === "rich-text") editedPartsRef.current.add(block.id); updateDisplayBlockText(block, text); scheduleMeasure(); }} onCommit={() => commitBlock(block)} onRemove={() => removeBlock(block.sourceId ?? block.id)} command={activeBlockId === block.id && block.type === "rich-text" ? richTextCommand : null} onSelectionSize={setRichTextSize} onSelectionStyle={setRichTextStyle} />)}
          </div>
          <footer><span />{pageIndex + 2} / {totalPages}</footer>
        </article>)}
        <QuoteClosingPreview quote={preview} professional={professional} pageNumber={totalPages} />
      </div>
    </section>
  </form>;
}
