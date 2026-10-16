"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ClipboardEvent, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { InlineRichTextEditor, type RichTextEditorCommand, type RichTextEditorCommandRequest } from "@/features/services/components/service-proposal-editor";
import { QuoteClosingPreview, QuoteCoverPreview, type QuotePreviewData } from "@/features/quotes/components/quote-document-previews";
import { updateQuoteDocumentAction } from "@/features/quotes/services/quote-actions";
import { hasQuoteServicesComponent, QUOTE_INTRO_BLOCK_ID, quoteDocumentBlockRole, quoteImageWidthShare, quoteServiceComponentBlocks, type QuoteDocumentAlign, type QuoteDocumentBlock, type QuoteDocumentContent, type QuoteDocumentFontSize, type QuoteDocumentImage } from "@/features/quotes/types/document-content";
import { isBlankRichTextRuns, mergeAdjacentRichTextLists, parseRichText, RICH_TEXT_BASE_SIZE, RICH_TEXT_SIZES, serializeRichText, type RichTextBlock, type RichTextParagraphStyle } from "@/lib/rich-text";

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

type ServiceSource = { id: string; name: string; categoryName: string | null; proposalText: string | null };

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
  /** Texto padrão em rich text; só entra no documento pelo componente Texto padrão. */
  templateText?: string | null;
  /** Serviços do orçamento, para o componente Serviços incluídos. */
  services: ServiceSource[];
};

/** Onde um componente entra: no ponto do cursor dentro de um texto ou logo depois de um bloco selecionado. */
type InsertionPoint = { kind: "text"; blockId: string; atomIndex: number; offset: number } | { kind: "block"; blockId: string };
type FocusRequest = { blockId: string; edge: "start" | "end" } | { blockId: string; atomIndex: number; offset: number };

/**
 * Medidas da folha do PDF em pontos (A4). O editor desenha a folha nas mesmas proporções, com a fonte do PDF,
 * para que as quebras de página na tela coincidam com as do arquivo gerado.
 */
const PDF_PAGE = { width: 595.28, top: 48, bottom: 46, header: 93, headerGap: 29 };
const PDF_CONTENT_HEIGHT = 841.89 - PDF_PAGE.top - PDF_PAGE.bottom - PDF_PAGE.header - PDF_PAGE.headerGap;
/** Espaço cinza entre as folhas, em pixels. */
const PAGE_GUTTER = 24;
/**
 * Telas estreitas: o texto mantém um tamanho legível e as margens ficam menores. As folhas continuam com a
 * proporção do A4, mas a quebra é aproximada (as linhas quebram em outros pontos que no PDF).
 */
const COMPACT_PT = 1.3339;
const COMPACT_PADDING = { top: 22, bottom: 28 };
const A4_RATIO = 841.89 / 595.28;

type PageBreak = { top: number; gap: number; remaining: number };
type FlowLayout = { pt: number; compact: boolean; bottom: number; gaps: Array<{ selector: string; gap: number }>; breaks: PageBreak[]; tail: number };
const initialLayout: FlowLayout = { pt: COMPACT_PT, compact: false, bottom: PDF_PAGE.bottom * COMPACT_PT, gaps: [], breaks: [], tail: 0 };

const CONTINUATION_TEXT_PREFIX = "text-";
const alignLabels: Record<QuoteDocumentAlign, string> = { left: "À esquerda", center: "Centralizado", right: "À direita", justify: "Justificado" };

/** Itens indivisíveis do texto rico: cada parágrafo e cada item de lista. */
function richTextAtoms(text: string): RichTextBlock[] {
  return parseRichText(text).blocks.flatMap((item): RichTextBlock[] => item.type === "paragraph" ? [item] : item.items.map((runs) => ({ type: item.type, items: [runs] })));
}

function serializeAtoms(atoms: RichTextBlock[]) {
  return serializeRichText({ version: 1, blocks: mergeAdjacentRichTextLists(atoms) }, 16_000) ?? "";
}

function isBlankAtom(atom: RichTextBlock) {
  return isBlankRichTextRuns(atom.type === "paragraph" ? atom.runs : atom.items[0] ?? []);
}

function newTextBlock(text: string, id = `${CONTINUATION_TEXT_PREFIX}${crypto.randomUUID().slice(0, 8)}`): QuoteDocumentBlock {
  return { id, type: "rich-text", text, fontSize: "medium", bold: false, italic: false, underline: false, align: "left" };
}

/** Textos livres do documento: a apresentação e os textos criados ao inserir componentes. */
function isFreeText(block: QuoteDocumentBlock | undefined) {
  return block?.type === "rich-text" && (block.id === QUOTE_INTRO_BLOCK_ID || block.id.startsWith(CONTINUATION_TEXT_PREFIX));
}

/**
 * Mantém o fluxo coerente depois de inserir ou remover componentes: textos livres vizinhos voltam a ser um só
 * e o documento sempre termina num texto, para haver onde continuar escrevendo.
 */
function normalizeFlow(blocks: QuoteDocumentBlock[], stableIds = false) {
  const output: QuoteDocumentBlock[] = [];
  for (const block of blocks) {
    const previous = output.at(-1);
    if (isFreeText(previous) && block.type === "rich-text" && block.id.startsWith(CONTINUATION_TEXT_PREFIX)) {
      output[output.length - 1] = { ...previous!, text: serializeAtoms([...richTextAtoms(previous!.text), ...richTextAtoms(block.text)]) };
      continue;
    }
    output.push(block);
  }
  if (!isFreeText(output.at(-1))) {
    // Na abertura do editor o id precisa ser o mesmo no servidor e no navegador.
    let id = `${CONTINUATION_TEXT_PREFIX}end`;
    for (let suffix = 2; stableIds && output.some((block) => block.id === id); suffix += 1) id = `${CONTINUATION_TEXT_PREFIX}end-${suffix}`;
    output.push(stableIds ? newTextBlock("", id) : newTextBlock(""));
  }
  return output;
}

/** Elementos que correspondem, em ordem, aos itens de um texto: parágrafos e itens de lista. */
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
  return fragment.querySelectorAll("p, div, li, h1, h2, h3, h4, h5, h6").length <= 1 && fragment.querySelectorAll("br").length <= (edge === "end" ? 1 : 0);
}

/** O cursor está na primeira (ou última) linha visual do editor: as setas seguem para o bloco vizinho. */
function caretOnEdgeLine(editor: HTMLElement, edge: "start" | "end") {
  if (caretAtEdge(editor, edge)) return true;
  const selection = window.getSelection();
  if (!selection?.rangeCount || !selection.isCollapsed) return false;
  const caret = selection.getRangeAt(0).getClientRects()[0];
  if (!caret) return false;
  const bounds = editor.getBoundingClientRect();
  return edge === "start" ? caret.top - bounds.top < caret.height * 0.9 : bounds.bottom - caret.bottom < caret.height * 0.9;
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

/** Item do texto onde está o cursor e a posição dele dentro do item. */
function caretAtomPosition(editor: HTMLElement): { atomIndex: number; offset: number } | null {
  const selection = window.getSelection();
  if (!selection?.rangeCount || !editor.contains(selection.anchorNode)) return null;
  const atoms = atomElements(editor);
  const anchor = selection.anchorNode!;
  const index = atoms.findIndex((atom) => atom === anchor || atom.contains(anchor));
  if (index < 0) return null;
  const probe = document.createRange();
  probe.selectNodeContents(atoms[index]);
  probe.setEnd(anchor, selection.anchorOffset);
  return { atomIndex: index, offset: probe.toString().length };
}

/**
 * Prepara a imagem para o PDF: fotos são reduzidas (lado maior até 2000 px) e regravadas em JPEG, o que também
 * aplica a rotação da câmera. PNGs pequenos seguem como estão, preservando a nitidez de prints e logos.
 */
async function prepareImageFile(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
  if (file.type === "image/png" && scale === 1 && file.size <= 3_500_000) {
    bitmap.close();
    return file;
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("encode")), "image/jpeg", 0.88));
}

/**
 * Item medido para a paginação. `selector` identifica o elemento por CSS: o espaço entre as folhas é aplicado por
 * uma regra de estilo, sem alterar o HTML do texto que está sendo editado.
 */
type FlowItem = { element: HTMLElement; selector: string; keepWithNext: boolean; breakAfter: boolean };

function flowItems(content: HTMLElement): FlowItem[] {
  const items: FlowItem[] = [];
  content.querySelectorAll<HTMLElement>(":scope > [data-block-id]").forEach((wrapper) => {
    const base = `[data-block-id="${wrapper.dataset.blockId}"]`;
    const editor = wrapper.dataset.flow === "text" ? wrapper.querySelector<HTMLElement>("[contenteditable]") : null;
    const before = items.length;
    Array.from(editor?.children ?? []).forEach((child, index) => {
      const path = `${base} [contenteditable] > :nth-child(${index + 1})`;
      if (child.tagName === "UL" || child.tagName === "OL") {
        Array.from(child.children).forEach((item, itemIndex) => items.push({ element: item as HTMLElement, selector: `${path} > :nth-child(${itemIndex + 1})`, keepWithNext: false, breakAfter: false }));
        return;
      }
      items.push({ element: child as HTMLElement, selector: path, keepWithNext: /^H[1-6]$/.test(child.tagName), breakAfter: false });
    });
    if (items.length === before) items.push({ element: wrapper, selector: base, keepWithNext: wrapper.dataset.keep === "next", breakAfter: wrapper.dataset.flow === "page-break" });
  });
  return items;
}

/**
 * Pagina o documento a partir das alturas medidas, descontando o espaço entre folhas já aplicado (as posições
 * não dependem da própria paginação, o que evita oscilação). Títulos não ficam sozinhos no fim da folha e a
 * quebra de página manual força uma nova folha.
 */
function measureFlow(sheet: HTMLElement, header: HTMLElement, content: HTMLElement, end: HTMLElement, current: FlowLayout): FlowLayout {
  const width = sheet.clientWidth;
  const compact = width < 600;
  const pt = compact ? COMPACT_PT : width / PDF_PAGE.width;
  const top = compact ? COMPACT_PADDING.top : PDF_PAGE.top * pt;
  const bottom = compact ? COMPACT_PADDING.bottom : PDF_PAGE.bottom * pt;
  // No computador a área útil é a do PDF; no celular, a que sobra na folha A4 depois das margens e do cabeçalho.
  const headerSpace = compact ? header.getBoundingClientRect().height + parseFloat(getComputedStyle(header).marginBottom) : (PDF_PAGE.header + PDF_PAGE.headerGap) * pt;
  const capacity = compact ? width * A4_RATIO - top - bottom - headerSpace : PDF_CONTENT_HEIGHT * pt;
  const items = flowItems(content);
  const applied = new Map(current.gaps.map((gap) => [gap.selector, gap.gap]));
  const contentTop = content.getBoundingClientRect().top;
  const sheetOffset = contentTop - sheet.getBoundingClientRect().top;
  // Posição real de cada item sem o espaço entre folhas, e posição "consumida" (a quebra manual não ocupa altura no PDF).
  let shift = 0;
  const actual = items.map((item) => {
    shift += applied.get(item.selector) ?? 0;
    return item.element.getBoundingClientRect().top - contentTop - shift;
  });
  const endActual = end.getBoundingClientRect().top - contentTop - shift;
  const consumed: number[] = [];
  let position = actual[0] ?? 0;
  items.forEach((item, index) => {
    consumed[index] = position;
    const next = index + 1 < items.length ? actual[index + 1] : endActual;
    position += item.breakAfter ? 0 : next - actual[index];
  });

  const between = bottom + top + headerSpace + PAGE_GUTTER;
  const gaps: FlowLayout["gaps"] = [];
  const breaks: PageBreak[] = [];
  let pageStart = 0;
  let pageStartActual = 0;
  let firstOnPage = 0;
  let added = 0;
  for (let index = 0; index < items.length; index += 1) {
    const forced = index > 0 && items[index - 1].breakAfter;
    const next = index + 1 < items.length ? consumed[index + 1] : position;
    const overflows = next - pageStart > capacity + 0.5 && index > firstOnPage;
    if (!forced && !overflows) continue;
    let breakAt = index;
    if (!forced) while (breakAt - 1 > firstOnPage && items[breakAt - 1].keepWithNext) breakAt -= 1;
    const remaining = Math.max(0, capacity - (actual[breakAt] - pageStartActual));
    const gap = Math.round(remaining + between);
    breaks.push({ top: Math.round(sheetOffset + actual[breakAt] + added), gap, remaining: Math.round(remaining) });
    gaps.push({ selector: items[breakAt].selector, gap });
    added += gap;
    pageStart = consumed[breakAt];
    pageStartActual = actual[breakAt];
    firstOnPage = breakAt;
  }
  return { pt, compact, bottom, gaps, breaks, tail: Math.max(0, Math.round(capacity - (endActual - pageStartActual))) };
}

function sameLayout(left: FlowLayout, right: FlowLayout) {
  if (left.compact !== right.compact || Math.abs(left.bottom - right.bottom) > 0.5 || Math.abs(left.pt - right.pt) > 0.001 || Math.abs(left.tail - right.tail) > 1 || left.gaps.length !== right.gaps.length) return false;
  return left.gaps.every((gap, index) => gap.selector === right.gaps[index].selector && Math.abs(gap.gap - right.gaps[index].gap) <= 1) && left.breaks.every((item, index) => Math.abs(item.top - right.breaks[index].top) <= 1);
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

type ComponentOption = { key: "services" | "template" | "images" | "page-break"; label: string; detail: string; disabled?: boolean };

/** Componentes: blocos prontos inseridos no ponto do cursor (ou depois do bloco selecionado). */
function ComponentsMenu({ options, onOpen, onSelect }: { options: ComponentOption[]; onOpen: () => void; onSelect: (key: ComponentOption["key"]) => void }) {
  const menu = useToolbarMenu("quote-docs-components-menu");
  return <>
    <button type="button" ref={menu.triggerRef} className="quote-docs-components-trigger" aria-haspopup="menu" aria-expanded={menu.position !== null} title="Inserir serviços incluídos, texto padrão, imagens ou quebra de página" onMouseDown={(event) => { event.preventDefault(); if (!menu.position) onOpen(); }} onClick={() => menu.toggle(300)}>COMPONENTES</button>
    {menu.position ? <div className="quote-docs-components-menu" role="menu" aria-label="Componentes do documento" style={{ top: menu.position.top, left: menu.position.left }}>
      <p>Entra no ponto do cursor.</p>
      {options.map((option) => <button type="button" role="menuitem" key={option.key} disabled={option.disabled} onMouseDown={(event) => event.preventDefault()} onClick={() => { menu.close(); onSelect(option.key); }}><strong>{option.label}</strong><small>{option.detail}</small></button>)}
    </div> : null}
  </>;
}

const imageAlignOptions: Array<{ value: QuoteDocumentAlign; label: string }> = [
  { value: "left", label: "Alinhar imagem à esquerda" },
  { value: "center", label: "Centralizar imagem" },
  { value: "right", label: "Alinhar imagem à direita" },
];
const imageSizeOptions: Array<{ value: QuoteDocumentFontSize; label: string }> = [
  { value: "small", label: "PEQUENA" },
  { value: "medium", label: "MÉDIA" },
  { value: "large", label: "LARGURA TOTAL" },
];

/** Ícone de alinhamento: linhas encostadas à esquerda, ao centro ou à direita. */
function AlignIcon({ align }: { align: QuoteDocumentAlign }) {
  return <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">{[14, 9, 14, 7].map((width, index) => <rect key={index} x={align === "left" ? 1 : align === "right" ? 15 - width : (16 - width) / 2} y={2 + index * 3.5} width={width} height="1.5" fill="currentColor" />)}</svg>;
}

function pastePlainLine(event: ClipboardEvent<HTMLDivElement>) {
  event.preventDefault();
  document.execCommand("insertText", false, event.clipboardData.getData("text/plain").replace(/\s+/g, " ").slice(0, 400));
}

/**
 * Texto de uma linha (título e categoria do serviço). Não controlado pelo React: o navegador edita o texto
 * livremente e o componente só é recriado quando o texto muda por fora (ao restaurar um título apagado).
 */
function PlainEditable({ text, className, ariaLabel, style, onInput, onFocus, onBlur, onKeyDown }: { text: string; className: string; ariaLabel: string; style?: CSSProperties; onInput: (text: string) => void; onFocus: () => void; onBlur: () => void; onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const initialText = useRef(text);
  useLayoutEffect(() => {
    if (ref.current) ref.current.textContent = initialText.current;
  }, []);
  return <div ref={ref} className={className} style={style} role="textbox" aria-label={ariaLabel} contentEditable suppressContentEditableWarning spellCheck onFocus={onFocus} onBlur={onBlur} onKeyDown={onKeyDown} onPaste={pastePlainLine} onInput={(event) => onInput(event.currentTarget.innerText.replace(/\n/g, " ").slice(0, 400))} />;
}

export function QuoteDocumentEditor({ quoteId, quoteCode, quoteTitle, backHref, initialContent, professional, isCompleted, justSaved = false, preview, templateText, services }: Props) {
  const [content, setContent] = useState<QuoteDocumentContent>(() => ({ ...initialContent, blocks: normalizeFlow(initialContent.blocks.filter((block) => block.id !== "intro-title"), true) }));
  const contentRef = useRef(content);
  const documentContentFieldRef = useRef<HTMLInputElement>(null);
  const [activeBlockId, setActiveBlockId] = useState("");
  const [richTextCommand, setRichTextCommand] = useState<RichTextEditorCommandRequest | null>(null);
  const [richTextSize, setRichTextSize] = useState(RICH_TEXT_BASE_SIZE);
  const [richTextStyle, setRichTextStyle] = useState<RichTextParagraphStyle | null>(null);
  // Textos são editores não controlados: só são recriados quando o texto muda por fora (inserir um componente no meio, por exemplo).
  const [versions, setVersions] = useState<Record<string, number>>({});
  const [restoreVersion, setRestoreVersion] = useState(0);
  const [focusRequest, setFocusRequest] = useState<FocusRequest | null>(null);
  const [layout, setLayout] = useState<FlowLayout>(initialLayout);
  const layoutRef = useRef(layout);
  const [showClosing, setShowClosing] = useState(false);
  const [imageUpload, setImageUpload] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null });
  const sheetRef = useRef<HTMLElement>(null);
  const flowRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const flowEndRef = useRef<HTMLDivElement>(null);
  const measureFrameRef = useRef(0);
  const measureBurstRef = useRef({ since: 0, updates: 0 });
  const imageInputRef = useRef<HTMLInputElement>(null);
  const insertionPointRef = useRef<InsertionPoint | null>(null);
  const blocks = content.blocks;
  const activeBlock = blocks.find((block) => block.id === activeBlockId);
  const hasServices = hasQuoteServicesComponent(content);
  const totalPages = layout.breaks.length + 3;

  const measure = useCallback(() => {
    const sheet = sheetRef.current;
    const header = headerRef.current;
    const flow = flowRef.current;
    const end = flowEndRef.current;
    if (!sheet || !header || !flow || !end) return;
    const next = measureFlow(sheet, header, flow, end, layoutRef.current);
    if (sameLayout(next, layoutRef.current)) return;
    // Trava de segurança: se as medidas ficarem mudando sem parar, a paginação congela até o próximo segundo.
    const now = performance.now();
    if (now - measureBurstRef.current.since > 1000) measureBurstRef.current = { since: now, updates: 0 };
    if (measureBurstRef.current.updates > 30) return;
    measureBurstRef.current.updates += 1;
    layoutRef.current = next;
    setLayout(next);
  }, []);

  const scheduleMeasure = useCallback(() => {
    cancelAnimationFrame(measureFrameRef.current);
    measureFrameRef.current = requestAnimationFrame(measure);
  }, [measure]);

  useLayoutEffect(() => { measure(); });
  useEffect(() => {
    const sheet = sheetRef.current;
    const observer = new ResizeObserver(scheduleMeasure);
    if (sheet) observer.observe(sheet);
    window.addEventListener("resize", scheduleMeasure);
    return () => { observer.disconnect(); window.removeEventListener("resize", scheduleMeasure); cancelAnimationFrame(measureFrameRef.current); };
  }, [scheduleMeasure]);

  function writeContent(next: QuoteDocumentContent) {
    contentRef.current = next;
    if (documentContentFieldRef.current) documentContentFieldRef.current.value = JSON.stringify(next);
  }

  /** Aplica uma mudança de estrutura (inserir, remover, alinhar). Textos alterados por fora são recriados. */
  function applyBlocks(nextBlocks: QuoteDocumentBlock[], focus?: FocusRequest) {
    const normalized = normalizeFlow(nextBlocks);
    const previous = new Map(contentRef.current.blocks.map((block) => [block.id, block.text]));
    const changed = normalized.filter((block) => block.type === "rich-text" && previous.has(block.id) && previous.get(block.id) !== block.text).map((block) => block.id);
    if (changed.length) setVersions((current) => ({ ...current, ...Object.fromEntries(changed.map((id) => [id, (current[id] ?? 0) + 1])) }));
    const next = { ...contentRef.current, blocks: normalized };
    writeContent(next);
    setContent(next);
    if (focus) setFocusRequest(focus);
  }

  function updateBlock(id: string, patch: Partial<QuoteDocumentBlock>) {
    applyBlocks(contentRef.current.blocks.map((block) => block.id === id ? { ...block, ...patch } : block));
  }

  /** Digitação: atualiza só o documento salvo no formulário; a tela continua com o que o navegador já mostra. */
  function updateBlockText(id: string, text: string) {
    writeContent({ ...contentRef.current, blocks: contentRef.current.blocks.map((block) => block.id === id ? { ...block, text } : block) });
    scheduleMeasure();
  }

  useLayoutEffect(() => {
    if (!focusRequest) return;
    const wrapper = sheetRef.current?.querySelector<HTMLElement>(`[data-block-id="${focusRequest.blockId}"]`);
    if (!wrapper) return;
    setFocusRequest(null);
    const editor = wrapper.querySelector<HTMLElement>("[contenteditable]");
    const target = editor ?? wrapper.querySelector<HTMLElement>("[tabindex]");
    if (!target) return;
    target.focus({ preventScroll: true });
    wrapper.scrollIntoView({ block: "nearest" });
    if (!editor) return;
    const atoms = atomElements(editor);
    if ("atomIndex" in focusRequest) placeCaret(atoms[focusRequest.atomIndex] ?? atoms.at(-1) ?? editor, focusRequest.offset);
    else placeCaret(focusRequest.edge === "start" ? atoms[0] ?? editor : atoms.at(-1) ?? editor, focusRequest.edge === "start" ? 0 : Infinity);
  }, [focusRequest, content]);

  function focusNeighbor(id: string, direction: -1 | 1) {
    const index = contentRef.current.blocks.findIndex((block) => block.id === id);
    const neighbor = contentRef.current.blocks[index + direction];
    if (neighbor) setFocusRequest({ blockId: neighbor.id, edge: direction < 0 ? "end" : "start" });
  }

  /** Ponto de inserção a partir do foco atual: o cursor num texto ou o bloco selecionado. */
  function currentInsertionPoint(): InsertionPoint | null {
    const focused = document.activeElement instanceof HTMLElement ? document.activeElement.closest<HTMLElement>("[data-block-id]") : null;
    if (!focused || !flowRef.current?.contains(focused)) return null;
    const blockId = focused.dataset.blockId!;
    const editor = focused.dataset.flow === "text" ? focused.querySelector<HTMLElement>("[contenteditable]") : null;
    if (editor) {
      const position = caretAtomPosition(editor);
      return { kind: "text", blockId, ...(position ?? { atomIndex: atomElements(editor).length - 1, offset: Infinity }) };
    }
    return { kind: "block", blockId };
  }

  /**
   * Abre espaço para um componente. Dentro de um texto, ele é dividido no parágrafo do cursor (numa linha em
   * branco, o componente ocupa o lugar dela). Sem cursor, o componente entra no fim do documento.
   */
  function insertionSlot(point: InsertionPoint | null) {
    const blocks = [...contentRef.current.blocks];
    const target = point ? blocks.findIndex((block) => block.id === point.blockId) : -1;
    if (point?.kind === "text" && target >= 0) {
      const source = blocks[target];
      const atoms = richTextAtoms(source.text);
      const at = Math.min(Math.max(0, point.atomIndex), atoms.length - 1);
      const caretAtom = atoms[at];
      let split = caretAtom ? at + 1 : atoms.length;
      let skip = 0;
      if (caretAtom && isBlankAtom(caretAtom)) { split = at; skip = 1; }
      else if (caretAtom && point.offset === 0) split = at;
      const before = atoms.slice(0, split);
      const after = atoms.slice(split + skip);
      // Texto vazio: o componente entra depois dele, que continua acima como lugar para escrever.
      if (!atoms.some((atom) => !isBlankAtom(atom))) return { blocks, index: target + 1, before, after, splitText: false };
      if (!before.length) {
        blocks[target] = { ...source, text: serializeAtoms(after) };
        return { blocks, index: target, before, after, splitText: false };
      }
      blocks[target] = { ...source, text: serializeAtoms(before) };
      if (after.length) blocks.splice(target + 1, 0, newTextBlock(serializeAtoms(after)));
      return { blocks, index: target + 1, before, after, splitText: after.length > 0 };
    }
    let index = target;
    const role = index >= 0 ? quoteDocumentBlockRole(blocks[index]) : null;
    if (role === "service-title" || role === "service-category") {
      // Título e categoria ficam junto da descrição do serviço: o componente entra depois dela.
      const description = blocks.findIndex((block) => block.id === `service-description-${blocks[index].id.replace(/^service-(title|category)-/, "")}`);
      if (description >= 0) index = description;
    } else if (role === "section-label") index -= 1;
    if (target < 0) {
      const last = blocks.at(-1);
      index = last && last.id !== QUOTE_INTRO_BLOCK_ID && isFreeText(last) && !richTextAtoms(last.text).length ? blocks.length - 2 : blocks.length - 1;
    }
    return { blocks, index: index + 1, before: [] as RichTextBlock[], after: [] as RichTextBlock[], splitText: false };
  }

  function insertBlocks(point: InsertionPoint | null, inserted: QuoteDocumentBlock[], focus: FocusRequest) {
    if (!inserted.length) return;
    const slot = insertionSlot(point);
    slot.blocks.splice(slot.index, 0, ...inserted);
    applyBlocks(slot.blocks, focus);
  }

  function insertServices(point: InsertionPoint | null) {
    if (hasQuoteServicesComponent(contentRef.current)) return;
    const inserted = quoteServiceComponentBlocks(services);
    if (inserted.length) insertBlocks(point, inserted, { blockId: inserted[0].id, edge: "start" });
  }

  function insertPageBreak(point: InsertionPoint | null) {
    const pageBreak: QuoteDocumentBlock = { id: `page-break-${crypto.randomUUID().slice(0, 8)}`, type: "page-break", text: "", fontSize: "medium", bold: false, italic: false, underline: false, align: "left" };
    const slot = insertionSlot(point);
    slot.blocks.splice(slot.index, 0, pageBreak);
    // O cursor segue para o texto da nova página (criado pela normalização quando a quebra fica no fim).
    const following = slot.blocks[slot.index + 1];
    applyBlocks(slot.blocks, following?.type === "rich-text" ? { blockId: following.id, edge: "start" } : { blockId: pageBreak.id, edge: "start" });
    if (!following) requestAnimationFrame(() => focusNeighbor(pageBreak.id, 1));
  }

  /** O texto padrão entra no ponto do cursor, dentro do próprio texto. */
  function insertTemplate(point: InsertionPoint | null) {
    if (!templateText) return;
    const templateAtoms = richTextAtoms(templateText);
    if (point?.kind === "text" && contentRef.current.blocks.some((block) => block.id === point.blockId && block.type === "rich-text")) {
      const slot = insertionSlot(point);
      const sourceIndex = slot.blocks.findIndex((block) => block.id === point.blockId);
      slot.blocks[sourceIndex] = { ...slot.blocks[sourceIndex], text: serializeAtoms([...slot.before, ...templateAtoms, ...slot.after]) };
      // O texto que a divisão separou volta para o mesmo bloco, logo depois do texto padrão.
      const merged = slot.splitText ? slot.blocks.filter((_, index) => index !== slot.index) : slot.blocks;
      applyBlocks(merged, { blockId: point.blockId, atomIndex: slot.before.length + templateAtoms.length - 1, offset: Infinity });
      return;
    }
    const text = newTextBlock(serializeAtoms(templateAtoms));
    insertBlocks(point, [text], { blockId: text.id, edge: "end" });
  }

  /** Remove blocos e reúne o texto que tinha sido dividido por eles. O cursor vai para o bloco anterior. */
  function removeBlocks(ids: string[]) {
    const current = contentRef.current.blocks;
    const first = current.findIndex((block) => ids.includes(block.id));
    const previous = current.slice(0, Math.max(0, first)).reverse().find((block) => !ids.includes(block.id));
    const next = current.slice(first + 1).find((block) => !ids.includes(block.id));
    const target = previous ?? next;
    applyBlocks(current.filter((block) => !ids.includes(block.id)), target ? { blockId: target.id, edge: previous ? "end" : "start" } : undefined);
    setActiveBlockId(target?.id ?? "");
  }

  function removeServices() {
    if (!window.confirm("Remover a seção Serviços incluídos? As descrições editadas neste PDF serão descartadas. A seção pode ser inserida de novo em COMPONENTES.")) return;
    removeBlocks(contentRef.current.blocks.filter((block) => block.id === "services-label" || block.id.startsWith("service-")).map((block) => block.id));
  }

  async function uploadImages(files: File[]) {
    const point = insertionPointRef.current;
    insertionPointRef.current = null;
    if (!files.length) return;
    setImageUpload({ busy: true, error: null });
    const uploaded: QuoteDocumentImage[] = [];
    let error: string | null = null;
    for (const file of files.slice(0, 20)) {
      try {
        const body = new FormData();
        body.append("file", await prepareImageFile(file), "imagem");
        const response = await fetch(`/api/orcamentos/${quoteId}/imagens`, { method: "POST", body });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) { error = result.error ?? "Não foi possível enviar a imagem."; break; }
        uploaded.push(result as QuoteDocumentImage);
      } catch {
        error = `Não foi possível ler "${file.name}". Use PNG, JPEG ou WEBP.`;
        break;
      }
    }
    const imageBlocks: QuoteDocumentBlock[] = uploaded.map((image) => ({ id: `image-${image.id}`, type: "image", text: "", fontSize: "medium", bold: false, italic: false, underline: false, align: "center", image }));
    if (imageBlocks.length) insertBlocks(point, imageBlocks, { blockId: imageBlocks[0].id, edge: "start" });
    setImageUpload({ busy: false, error });
  }

  function selectComponent(key: ComponentOption["key"]) {
    const point = insertionPointRef.current ?? currentInsertionPoint();
    if (key === "images") {
      insertionPointRef.current = point;
      imageInputRef.current?.click();
      return;
    }
    insertionPointRef.current = null;
    if (key === "services") insertServices(point);
    else if (key === "template") insertTemplate(point);
    else insertPageBreak(point);
  }

  /** Texto: setas nas bordas seguem para o bloco vizinho; Backspace/Delete na borda selecionam o componente ao lado. */
  function handleTextKeys(event: KeyboardEvent<HTMLDivElement>, block: QuoteDocumentBlock) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const editor = event.currentTarget;
    const index = contentRef.current.blocks.findIndex((item) => item.id === block.id);
    const previous = contentRef.current.blocks[index - 1];
    const next = contentRef.current.blocks[index + 1];
    if (event.key === "ArrowUp" && previous && caretOnEdgeLine(editor, "start")) { event.preventDefault(); focusNeighbor(block.id, -1); return; }
    if (event.key === "ArrowDown" && next && caretOnEdgeLine(editor, "end")) { event.preventDefault(); focusNeighbor(block.id, 1); return; }
    if ((event.key === "ArrowLeft" || event.key === "Backspace") && previous && caretAtEdge(editor, "start")) {
      event.preventDefault();
      if (event.key === "ArrowLeft" || previous.type !== "rich-text") focusNeighbor(block.id, -1);
      return;
    }
    if ((event.key === "ArrowRight" || event.key === "Delete") && next && caretAtEdge(editor, "end")) {
      event.preventDefault();
      if (event.key === "ArrowRight" || next.type !== "rich-text") focusNeighbor(block.id, 1);
    }
  }

  /** Componente selecionado (imagem, quebra de página, rótulo da seção): Backspace/Delete remove, setas e Enter navegam. */
  function handleComponentKeys(event: KeyboardEvent<HTMLDivElement>, block: QuoteDocumentBlock) {
    if (event.key === "Backspace" || event.key === "Delete") {
      event.preventDefault();
      if (block.id === "services-label") removeServices();
      else removeBlocks([block.id]);
    } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      focusNeighbor(block.id, -1);
    } else if (event.key === "ArrowDown" || event.key === "ArrowRight" || event.key === "Enter") {
      event.preventDefault();
      focusNeighbor(block.id, 1);
    }
  }

  /** Título e categoria do serviço: uma linha só; Enter e setas seguem para o bloco vizinho. */
  function handlePlainKeys(event: KeyboardEvent<HTMLDivElement>, block: QuoteDocumentBlock) {
    const editor = event.currentTarget;
    if (event.key === "Enter") { event.preventDefault(); focusNeighbor(block.id, 1); return; }
    if (event.shiftKey) return;
    if (event.key === "ArrowUp" || (event.key === "ArrowLeft" && caretAtEdge(editor, "start"))) { event.preventDefault(); focusNeighbor(block.id, -1); return; }
    if (event.key === "ArrowDown" || (event.key === "ArrowRight" && caretAtEdge(editor, "end"))) { event.preventDefault(); focusNeighbor(block.id, 1); }
  }

  /** Título e categoria do serviço não ficam vazios: apagados, voltam ao texto anterior ao sair do campo. */
  function commitPlain(block: QuoteDocumentBlock) {
    const current = contentRef.current.blocks.find((item) => item.id === block.id);
    if (current && !current.text.trim()) {
      const role = quoteDocumentBlockRole(current);
      if (role === "service-title" || role === "service-category") {
        writeContent({ ...contentRef.current, blocks: contentRef.current.blocks.map((item) => item.id === current.id ? { ...item, text: block.text } : item) });
        setContent(contentRef.current);
        setRestoreVersion((version) => version + 1);
        return;
      }
      removeBlocks([current.id]);
      return;
    }
    setContent(contentRef.current);
  }

  function applyRichTextCommand(value: RichTextEditorCommand, size?: number, paragraphStyle?: RichTextParagraphStyle | null) {
    setRichTextCommand((current) => ({ id: (current?.id ?? 0) + 1, value, size, paragraphStyle }));
  }

  const componentOptions: ComponentOption[] = [
    { key: "services", label: "Serviços incluídos", detail: hasServices ? "Já está no documento." : services.length ? "Título, categoria e descrição de cada serviço do orçamento." : "O orçamento não tem serviços.", disabled: hasServices || !services.length },
    { key: "template", label: "Texto padrão", detail: templateText ? "Seu texto padrão salvo, no ponto do cursor." : "Nenhum texto padrão salvo. Crie em TEXTO PADRÃO.", disabled: !templateText },
    { key: "images", label: "Imagens", detail: "PNG, JPEG ou WEBP. Uma ou várias de uma vez." },
    { key: "page-break", label: "Quebra de página", detail: "O conteúdo seguinte começa numa nova página." },
  ];

  function pageHeader(key?: string) {
    return <header className="quote-sheet-header" key={key} ref={key ? undefined : headerRef}>
      <div className="quote-sheet-brand">
        <span className="quote-sheet-logo"><img src="/assets/images/logo-vr.svg" alt="" /></span>
        <div className="quote-sheet-professional">
          <span>PROPOSTA COMERCIAL</span>
          <strong>{professional.name}</strong>
          {professional.professionalTitle ? <small>{professional.professionalTitle}</small> : null}
        </div>
      </div>
      <div className="quote-sheet-client"><span>CLIENTE</span><strong>{preview.client.name}</strong>{[preview.client.company, preview.client.document].filter(Boolean).map((detail) => <small key={detail}>{detail}</small>)}</div>
    </header>;
  }

  function renderBlock(block: QuoteDocumentBlock, index: number): ReactNode {
    const activate = () => setActiveBlockId(block.id);
    const role = quoteDocumentBlockRole(block);
    const selected = activeBlockId === block.id ? " is-selected" : "";
    if (block.type === "rich-text") {
      const placeholder = block.id === QUOTE_INTRO_BLOCK_ID ? "Comece a escrever a proposta aqui. Use COMPONENTES para inserir serviços incluídos, texto padrão, imagens ou quebras de página." : block.id.startsWith(CONTINUATION_TEXT_PREFIX) ? "Continue o texto aqui." : "Descrição do serviço.";
      // A orientação de texto vazio ocupa espaço de verdade (fica na mesma célula do editor): em telas estreitas
      // ela quebra em várias linhas sem vazar da folha, e clicar sobre ela posiciona o cursor no texto.
      return <div key={`${block.id}:${versions[block.id] ?? 0}`} data-block-id={block.id} data-flow="text" className="quote-sheet-block is-text">
        <InlineRichTextEditor initialValue={block.text} className="quote-sheet-text" ariaLabel={block.id.startsWith("service-description-") ? "Descrição do serviço" : "Texto da proposta"} onFocus={activate} onBlur={() => setContent(contentRef.current)} onChange={(value) => updateBlockText(block.id, value ?? "")} onKeyDown={(event) => handleTextKeys(event, block)} command={activeBlockId === block.id ? richTextCommand : null} onSelectionSize={setRichTextSize} onSelectionStyle={setRichTextStyle} />
        <span className="quote-sheet-placeholder" aria-hidden="true">{placeholder}</span>
      </div>;
    }
    if (block.type === "image" && block.image) return <div key={block.id} data-block-id={block.id} data-flow="block" className={`quote-sheet-block is-image is-${block.align}${selected}`}>
      <div className="quote-sheet-image" tabIndex={0} role="img" aria-label="Imagem do documento. Backspace ou Delete remove a imagem." title="Clique para alinhar, redimensionar ou remover" style={{ width: `${quoteImageWidthShare(block) * 100}%` }} onFocus={activate} onKeyDown={(event) => handleComponentKeys(event, block)}>
        {/* eslint-disable-next-line @next/next/no-img-element -- arquivo servido pela API do orçamento, já reduzido no envio */}
        <img src={`/api/orcamentos/${quoteId}/imagens/${block.image.id}`} alt="" draggable={false} style={{ aspectRatio: `${block.image.width} / ${block.image.height}` }} />
      </div>
    </div>;
    if (block.type === "page-break") return <div key={block.id} data-block-id={block.id} data-flow="page-break" className={`quote-sheet-block is-page-break${selected}`}>
      <div className="quote-sheet-page-break" tabIndex={0} role="separator" aria-label="Quebra de página. Backspace ou Delete remove." onFocus={activate} onKeyDown={(event) => handleComponentKeys(event, block)}><span>QUEBRA DE PÁGINA</span></div>
    </div>;
    if (role === "section-label") return <div key={block.id} data-block-id={block.id} data-flow="block" data-keep="next" className={`quote-sheet-block is-section-label${selected}`}>
      <div className="quote-sheet-section-label" tabIndex={0} role="heading" aria-level={2} title="Componente Serviços incluídos" onFocus={activate} onKeyDown={(event) => handleComponentKeys(event, block)}><span>{block.text}</span></div>
    </div>;
    const plainClass = role === "service-title" ? "is-service-title" : role === "service-category" ? "is-service-category" : block.type === "heading" ? "is-heading" : "is-paragraph";
    const first = role === "service-title" && blocks[index - 1]?.id === "services-label" ? " is-first" : "";
    return <div key={`${block.id}:${restoreVersion}`} data-block-id={block.id} data-flow="block" data-keep={role ? "next" : undefined} className={`quote-sheet-block ${plainClass}${first}`}>
      <PlainEditable text={block.text} className="quote-sheet-plain" ariaLabel={role === "service-title" ? "Nome do serviço" : role === "service-category" ? "Categoria do serviço" : "Texto do documento"} style={role ? undefined : { textAlign: block.align, fontWeight: block.bold ? 700 : 400, fontStyle: block.italic ? "italic" : "normal", textDecoration: block.underline ? "underline" : "none" }} onFocus={activate} onBlur={() => commitPlain(block)} onInput={(text) => updateBlockText(block.id, text)} onKeyDown={(event) => handlePlainKeys(event, block)} />
    </div>;
  }

  const activeRole = activeBlock ? quoteDocumentBlockRole(activeBlock) : null;
  const gapCss = layout.gaps.map((gap) => `${gap.selector}{margin-top:${gap.gap}px!important}`).join("");
  const bottomSpace = layout.bottom;

  return <form className="quote-document-editor quote-docs-editor" action={updateQuoteDocumentAction}>
    <input type="hidden" name="quoteId" value={quoteId} />
    <input ref={documentContentFieldRef} type="hidden" name="documentContent" defaultValue={JSON.stringify(content)} />
    <input ref={imageInputRef} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(event) => { const files = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = ""; void uploadImages(files); }} />
    <section className="quote-docs-toolbar" aria-label="Ferramentas do editor">
      <div className="quote-docs-toolbar-meta"><div className="quote-docs-toolbar-title"><span>{quoteCode} · {isCompleted ? "CONCLUÍDO" : "PENDENTE DE CONCLUSÃO"}</span><strong>{quoteTitle}</strong>{justSaved ? <small className="quote-docs-saved" role="status">Alterações salvas. Conclua quando o documento estiver pronto.</small> : null}</div><div className="quote-docs-toolbar-actions"><SidebarToggle location="header" hideWhenOpen /><button className="quote-docs-back-link quote-docs-template-link" type="submit" name="intent" value="template" title="Salva este PDF e abre o texto padrão">TEXTO PADRÃO</button><Link className="quote-docs-back-link" href={backHref}>VOLTAR</Link><button className="secondary-action quote-docs-save-draft" type="submit" name="intent" value="save">SALVAR</button><button className="primary-action quote-docs-save" type="submit" name="intent" value="complete">{isCompleted ? "SALVAR E SAIR" : "CONCLUIR"}</button></div></div>
      <div className="quote-docs-toolbar-tools">
        <ComponentsMenu options={componentOptions} onOpen={() => { insertionPointRef.current = currentInsertionPoint(); }} onSelect={selectComponent} />
        {imageUpload.busy ? <span className="quote-docs-tool-context">ENVIANDO IMAGENS...</span> : null}
        {imageUpload.error ? <span className="quote-docs-tool-error" role="alert">{imageUpload.error}</span> : null}
        <span className="quote-docs-divider" />
        {activeBlock?.type === "image" ? <>
          {imageAlignOptions.map((option) => <button type="button" key={option.value} aria-label={option.label} title={option.label} aria-pressed={activeBlock.align === option.value} className={`quote-docs-image-align${activeBlock.align === option.value ? " is-active" : ""}`} onMouseDown={(event) => event.preventDefault()} onClick={() => updateBlock(activeBlock.id, { align: option.value })}><AlignIcon align={option.value} /></button>)}
          <span className="quote-docs-divider" />
          {imageSizeOptions.map((option) => <button type="button" key={option.value} aria-pressed={activeBlock.fontSize === option.value} className={`quote-docs-image-size${activeBlock.fontSize === option.value ? " is-active" : ""}`} onMouseDown={(event) => event.preventDefault()} onClick={() => updateBlock(activeBlock.id, { fontSize: option.value })}>{option.label}</button>)}
          <span className="quote-docs-divider" />
          <button type="button" className="quote-docs-remove" onMouseDown={(event) => event.preventDefault()} onClick={() => removeBlocks([activeBlock.id])}>REMOVER IMAGEM</button>
        </> : activeBlock?.type === "page-break" ? <>
          <span className="quote-docs-tool-context">QUEBRA DE PÁGINA</span>
          <button type="button" className="quote-docs-remove" onMouseDown={(event) => event.preventDefault()} onClick={() => removeBlocks([activeBlock.id])}>REMOVER QUEBRA</button>
        </> : activeRole === "section-label" ? <>
          <span className="quote-docs-tool-context">SERVIÇOS INCLUÍDOS</span>
          <button type="button" className="quote-docs-remove" onMouseDown={(event) => event.preventDefault()} onClick={removeServices}>REMOVER SEÇÃO</button>
        </> : activeRole === "service-title" || activeRole === "service-category" ? <span className="quote-docs-tool-context">{activeRole === "service-title" ? "NOME DO SERVIÇO" : "CATEGORIA DO SERVIÇO"}</span>
        : activeBlock && activeBlock.type !== "rich-text" ? <>
          <button type="button" aria-label="Negrito" className={activeBlock.bold ? "is-active" : ""} aria-pressed={activeBlock.bold} onMouseDown={(event) => event.preventDefault()} onClick={() => updateBlock(activeBlock.id, { bold: !activeBlock.bold })}>N</button>
          <button type="button" aria-label="Itálico" className={activeBlock.italic ? "is-active quote-docs-italic" : "quote-docs-italic"} aria-pressed={activeBlock.italic} onMouseDown={(event) => event.preventDefault()} onClick={() => updateBlock(activeBlock.id, { italic: !activeBlock.italic })}>I</button>
          <button type="button" aria-label="Sublinhado" className={activeBlock.underline ? "is-active quote-docs-underline" : "quote-docs-underline"} aria-pressed={activeBlock.underline} onMouseDown={(event) => event.preventDefault()} onClick={() => updateBlock(activeBlock.id, { underline: !activeBlock.underline })}>S</button>
          <select aria-label="Alinhamento" value={activeBlock.align} onChange={(event) => updateBlock(activeBlock.id, { align: event.target.value as QuoteDocumentAlign })}>{Object.entries(alignLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        </> : <>
          <button type="button" aria-label="Negrito" title="Negrito" onMouseDown={(event) => event.preventDefault()} onClick={() => applyRichTextCommand("bold")}><strong>N</strong></button>
          <button type="button" aria-label="Itálico" title="Itálico" className="quote-docs-italic" onMouseDown={(event) => event.preventDefault()} onClick={() => applyRichTextCommand("italic")}><em>I</em></button>
          <button type="button" aria-label="Sublinhado" title="Sublinhado" className="quote-docs-underline" onMouseDown={(event) => event.preventDefault()} onClick={() => applyRichTextCommand("underline")}><u>S</u></button>
          <span className="quote-docs-divider" />
          <ParagraphStyleControl style={richTextStyle} onSelect={(style) => applyRichTextCommand("paragraphStyle", undefined, style)} />
          <FontSizeControl size={richTextSize} onStep={(direction) => applyRichTextCommand(direction > 0 ? "increaseFontSize" : "decreaseFontSize")} onSelect={(size) => applyRichTextCommand("fontSize", size)} />
          <span className="quote-docs-divider" />
          <button type="button" title="Lista com marcadores" onMouseDown={(event) => event.preventDefault()} onClick={() => applyRichTextCommand("insertUnorderedList")}>LISTA</button>
          <button type="button" aria-label="Lista numerada" title="Lista numerada" onMouseDown={(event) => event.preventDefault()} onClick={() => applyRichTextCommand("insertOrderedList")}>1.</button>
          <span className="quote-docs-divider" />
          <button type="button" title="Remove negrito, itálico, sublinhado, tamanho e estilo de título da linha ou do trecho selecionado" onMouseDown={(event) => event.preventDefault()} onClick={() => applyRichTextCommand("removeFormat")}>LIMPAR FORMATAÇÃO</button>
        </>}
      </div>
    </section>
    <section className="quote-docs-canvas" aria-label="Documento editável">
      <div className="quote-docs-pages">
        <QuoteCoverPreview quote={preview} professional={professional} />
        <article ref={sheetRef} className={`quote-sheet${layout.compact ? " is-compact" : ""}`} style={{ "--pt": `${layout.pt}px`, paddingBottom: layout.tail + bottomSpace } as CSSProperties} aria-label="Páginas do documento">
          <style>{gapCss}</style>
          {pageHeader()}
          <div ref={flowRef} className="quote-sheet-flow">
            {blocks.map(renderBlock)}
            <div ref={flowEndRef} className="quote-sheet-flow-end" />
          </div>
          <span className="quote-sheet-page-number" aria-hidden="true">{totalPages - 1} / {totalPages}</span>
          {layout.breaks.map((pageBreak, index) => <div key={index} className="quote-sheet-break" aria-hidden="true" style={{ top: pageBreak.top, height: pageBreak.gap }}>
            <div className="quote-sheet-break-end" style={{ height: pageBreak.remaining + bottomSpace }}><span className="quote-sheet-page-number">{index + 2} / {totalPages}</span></div>
            <div className="quote-sheet-break-gutter" />
            <div className="quote-sheet-break-start">{pageHeader(`header-${index}`)}</div>
          </div>)}
        </article>
        <div className="quote-docs-closing-toggle">
          <div><span>PÁGINA FINAL</span><small>Investimento, condições e aceite. Gerada a partir dos valores do orçamento.</small></div>
          <button type="button" className="secondary-action" aria-expanded={showClosing} onClick={() => setShowClosing((value) => !value)}>{showClosing ? "OCULTAR PÁGINA FINAL" : "EXIBIR PÁGINA FINAL"}</button>
        </div>
        {showClosing ? <QuoteClosingPreview quote={preview} professional={professional} pageNumber={totalPages} /> : null}
      </div>
    </section>
  </form>;
}
