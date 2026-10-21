"use client";

import { useEffect, useRef, type ClipboardEvent, type FormEvent, type KeyboardEvent } from "react";
import { isBlankRichTextRuns, normalizedRichTextSize, parseRichText, RICH_TEXT_BASE_SIZE, RICH_TEXT_COLORS, RICH_TEXT_SIZES, richTextAlign, richTextBox, richTextColor, richTextColorFromCss, richTextLineHeight, richTextListVariant, serializeRichText, type RichTextAlign, type RichTextBox, type RichTextColor, type RichTextDocument, type RichTextListVariant, type RichTextMark, type RichTextParagraphStyle, type RichTextRun } from "@/lib/rich-text";

type Props = {
  name?: string;
  initialValue?: string | null;
  onChange?: (value: string | null) => void;
};

export type RichTextEditorCommand = "bold" | "italic" | "underline" | "insertUnorderedList" | "insertOrderedList" | "removeFormat" | "increaseFontSize" | "decreaseFontSize" | "fontSize" | "paragraphStyle" | "color" | "align" | "box" | "list";
/** Lista escolhida na barra: tipo e aparência (null = texto, sem lista). */
export type RichTextListChoice = { type: "bullet-list" | "ordered-list"; variant?: RichTextListVariant } | null;
/** Formatação onde está o cursor, para a barra de ferramentas mostrar o estado atual. */
export type RichTextSelectionFormat = { color: RichTextColor | null; align: RichTextAlign | "left"; box: RichTextBox | null; list: RichTextListChoice };
export type RichTextEditorCommandRequest = { id: number; value: RichTextEditorCommand; size?: number; color?: RichTextColor | null; align?: RichTextAlign | "left"; box?: RichTextBox | null; list?: RichTextListChoice; paragraphStyle?: RichTextParagraphStyle | null };

/** Cada estilo de parágrafo vira um elemento de bloco próprio no editor. */
const PARAGRAPH_STYLE_TAGS: Record<RichTextParagraphStyle, string> = { title: "H2", subtitle: "H3", section: "H4" };
/** Cor normal do texto: aplicá-la remove a cor da paleta. */
const DEFAULT_TEXT_HEX = "#1f1f1f";

function styleFromTag(tagName: string): RichTextParagraphStyle | undefined {
  if (tagName === "H1" || tagName === "H2") return "title";
  if (tagName === "H3" || tagName === "H5" || tagName === "H6") return "subtitle";
  if (tagName === "H4") return "section";
  return undefined;
}

type InlineEditorProps = {
  initialValue?: string | null;
  onChange: (value: string | null) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  command?: RichTextEditorCommandRequest | null;
  /** Informa o tamanho do texto onde está o cursor, para a barra de ferramentas exibi-lo. */
  onSelectionSize?: (size: number) => void;
  /** Informa o estilo do parágrafo onde está o cursor (null = texto). */
  onSelectionStyle?: (style: RichTextParagraphStyle | null) => void;
  /** Informa cor, alinhamento, moldura e lista onde está o cursor. */
  onSelectionFormat?: (format: RichTextSelectionFormat) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
  ariaLabel: string;
  className?: string;
  placeholder?: string;
  /** Limite de caracteres do texto salvo (o catálogo de serviços usa 4.000; o PDF do orçamento, bem mais). */
  maxCharacters?: number;
};

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#039;");
}

/** Tamanho relativo à base do editor (--rich-text-base), para não acumular quando há elementos aninhados. */
function sizeStyle(size: number) {
  return `font-size:calc(var(--rich-text-base, 1em) * ${size / RICH_TEXT_BASE_SIZE});line-height:${richTextLineHeight(size)}`;
}

function runsToHtml(runs: RichTextRun[]) {
  return runs.map((run) => {
    let value = escapeHtml(run.text).replace(/\n/g, "<br>");
    if (run.underline) value = `<u>${value}</u>`;
    if (run.italic) value = `<em>${value}</em>`;
    if (run.bold) value = `<strong>${value}</strong>`;
    if (run.size) value = `<span data-size="${run.size}" style="${sizeStyle(run.size)}">${value}</span>`;
    if (run.color) value = `<span data-color="${run.color}" style="color:${RICH_TEXT_COLORS[run.color].hex}">${value}</span>`;
    return value;
  }).join("");
}

function blockAttributes(align?: RichTextAlign, box?: RichTextBox) {
  return `${align ? ` style="text-align:${align}"` : ""}${box ? ` data-box="${box}"` : ""}`;
}

function documentToHtml(document: RichTextDocument) {
  // Um editor vazio começa com um parágrafo: o que for digitado já nasce dentro dele, nunca solto na raiz.
  if (!document.blocks.length) return "<p><br></p>";
  return document.blocks.map((block) => {
    if (block.type === "paragraph") {
      // Uma quebra no fim do parágrafo só aparece no navegador se houver outra depois dela.
      const text = block.runs.map((run) => run.text).join("");
      const tag = block.style ? PARAGRAPH_STYLE_TAGS[block.style].toLowerCase() : "p";
      return `<${tag}${blockAttributes(block.align, block.box)}>${runsToHtml(block.runs)}${text.length > 1 && text.endsWith("\n") ? "<br>" : ""}</${tag}>`;
    }
    const tag = block.type === "bullet-list" ? "ul" : "ol";
    return `<${tag}${blockAttributes(undefined, block.box)}${block.variant ? ` data-variant="${block.variant}"` : ""}>${block.items.map((item) => `<li>${runsToHtml(item)}</li>`).join("")}</${tag}>`;
  }).join("");
}

function sameMarks(left: RichTextMark, right: RichTextMark) {
  return left.bold === right.bold && left.italic === right.italic && left.underline === right.underline && left.size === right.size && left.color === right.color;
}

/**
 * Tamanho declarado por um elemento. O editor grava data-size; estilos de fonte que o navegador
 * copia sozinho ao juntar linhas são convertidos pelo tamanho calculado em relação à base do editor.
 */
function elementSize(node: HTMLElement, basePixels: number, inherited?: number) {
  if (!node.style.fontSize) return inherited;
  if (node.dataset.size) return normalizedRichTextSize(node.dataset.size);
  if (!basePixels) return inherited;
  return normalizedRichTextSize(parseFloat(getComputedStyle(node).fontSize) / basePixels * RICH_TEXT_BASE_SIZE);
}

/**
 * Cor declarada pelo elemento: atributo do editor, <font color> criado pelo navegador ou estilo de cor.
 * Uma cor fora da paleta (a cor normal do texto, por exemplo) desfaz a cor herdada.
 */
function elementColor(node: HTMLElement, inherited?: RichTextColor) {
  if (node.dataset.color) return richTextColor(node.dataset.color);
  const declared = node.getAttribute("color") || node.style.color;
  return declared ? richTextColorFromCss(declared) : inherited;
}

function addRun(runs: RichTextRun[], text: string, marks: RichTextMark) {
  if (!text) return;
  const previous = runs.at(-1);
  if (previous && sameMarks(previous, marks)) {
    previous.text += text;
    return;
  }
  runs.push({ text, ...marks });
}

function runsFromNodes(nodes: NodeListOf<ChildNode> | ChildNode[], basePixels: number, marks: RichTextMark = {}) {
  const runs: RichTextRun[] = [];
  for (const node of Array.from(nodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      addRun(runs, node.textContent ?? "", marks);
      continue;
    }
    if (!(node instanceof HTMLElement)) continue;
    if (node.tagName === "BR") {
      addRun(runs, "\n", marks);
      continue;
    }
    const style = node.style;
    const nextMarks: RichTextMark = {
      bold: marks.bold || node.tagName === "B" || node.tagName === "STRONG" || Number(style.fontWeight) >= 600,
      italic: marks.italic || node.tagName === "I" || node.tagName === "EM" || style.fontStyle === "italic",
      underline: marks.underline || node.tagName === "U" || style.textDecoration.includes("underline"),
      size: elementSize(node, basePixels, marks.size),
      color: elementColor(node, marks.color),
    };
    const nested = runsFromNodes(node.childNodes, basePixels, nextMarks);
    for (const run of nested) addRun(runs, run.text, run);
  }
  return runs;
}

const INLINE_TAGS = new Set(["A", "B", "BR", "CODE", "EM", "FONT", "I", "MARK", "S", "SMALL", "SPAN", "STRONG", "SUB", "SUP", "U"]);

/**
 * A última quebra de um bloco é só o marcador que o navegador usa para a linha existir; não é conteúdo.
 * Um bloco que fica vazio sem ela é uma linha em branco e continua representado por uma única quebra.
 */
function blockRuns(runs: RichTextRun[]) {
  const last = runs.at(-1);
  if (!last?.text.endsWith("\n")) return runs;
  const trimmed = last.text.slice(0, -1);
  const output = trimmed ? [...runs.slice(0, -1), { ...last, text: trimmed }] : runs.slice(0, -1);
  return output.length ? output : [{ ...last, text: "\n" }];
}

function documentFromEditor(root: HTMLElement): RichTextDocument {
  const basePixels = parseFloat(getComputedStyle(root).fontSize) || 0;
  const blocks: RichTextDocument["blocks"] = [];
  const inlineNodes: ChildNode[] = [];
  const appendInlineParagraph = () => {
    const runs = runsFromNodes(inlineNodes, basePixels);
    inlineNodes.length = 0;
    if (runs.length) blocks.push({ type: "paragraph", runs: blockRuns(runs) });
  };

  for (const node of Array.from(root.childNodes)) {
    // Texto e marcações soltas na raiz (o negrito aplicado à primeira linha, por exemplo) formam um parágrafo com as próprias marcas.
    if (node.nodeType === Node.TEXT_NODE || (node instanceof HTMLElement && INLINE_TAGS.has(node.tagName))) {
      inlineNodes.push(node);
      continue;
    }
    if (!(node instanceof HTMLElement)) continue;
    appendInlineParagraph();
    if (node.tagName === "UL" || node.tagName === "OL") {
      const items = Array.from(node.children)
        .filter((item) => item.tagName === "LI")
        .map((item) => blockRuns(runsFromNodes(item.childNodes, basePixels)))
        .filter((item) => item.length && !isBlankRichTextRuns(item));
      const type = node.tagName === "UL" ? "bullet-list" : "ordered-list";
      const variant = richTextListVariant(type, node.dataset.variant);
      const box = richTextBox(node.dataset.box);
      if (items.length) blocks.push({ type, items, ...(variant ? { variant } : {}), ...(box ? { box } : {}) });
      continue;
    }
    const runs = runsFromNodes(node.childNodes, basePixels);
    const style = styleFromTag(node.tagName);
    const align = richTextAlign(node.style.textAlign);
    const box = richTextBox(node.dataset.box);
    blocks.push({ type: "paragraph", runs: runs.length ? blockRuns(runs) : [{ text: "\n" }], ...(style ? { style } : {}), ...(align ? { align } : {}), ...(box ? { box } : {}) });
  }
  appendInlineParagraph();
  // Só linhas em branco equivalem a um texto vazio.
  return { version: 1, blocks: blocks.some((block) => block.type !== "paragraph" || !isBlankRichTextRuns(block.runs)) ? blocks : [] };
}

function elementFromNode(node: Node | null) {
  return node instanceof HTMLElement ? node : node?.parentElement ?? null;
}

/** Tamanho em pontos no início da seleção (o trecho dimensionado mais interno vence). */
function selectionSize(editor: HTMLElement) {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return null;
  const range = selection.getRangeAt(0);
  let node: Node = range.startContainer;
  if (node.nodeType !== Node.TEXT_NODE) {
    node = node.childNodes[range.startOffset] ?? node;
    while (node.firstChild && node.nodeType !== Node.TEXT_NODE) node = node.firstChild;
  }
  let element = elementFromNode(node);
  if (!element || !editor.contains(element)) return null;
  while (element && element !== editor) {
    if (element.dataset.size && element.style.fontSize) return normalizedRichTextSize(element.dataset.size) ?? RICH_TEXT_BASE_SIZE;
    element = element.parentElement;
  }
  return RICH_TEXT_BASE_SIZE;
}

function steppedSize(current: number, direction: 1 | -1) {
  const sizes = direction > 0 ? RICH_TEXT_SIZES : [...RICH_TEXT_SIZES].reverse();
  return sizes.find((size) => direction > 0 ? size > current : size < current) ?? current;
}

function markSizedElement(element: HTMLElement, size: number) {
  element.dataset.size = String(size);
  element.setAttribute("style", sizeStyle(size));
}

/** Remove tamanhos internos para que o novo tamanho valha para todo o trecho. */
function clearNestedSizes(element: HTMLElement) {
  element.querySelectorAll<HTMLElement>("[data-size], [style]").forEach((inner) => {
    inner.removeAttribute("data-size");
    inner.style.removeProperty("font-size");
    inner.style.removeProperty("line-height");
    if (!inner.getAttribute("style")?.trim()) inner.removeAttribute("style");
    if ((inner.tagName === "SPAN" || inner.tagName === "FONT") && !inner.attributes.length) inner.replaceWith(...Array.from(inner.childNodes));
  });
}

/**
 * Ao aplicar um tamanho dentro de um trecho já dimensionado, o navegador retira o font-size do trecho
 * externo mas mantém os demais atributos. Esses restos deixam de declarar tamanho. Nenhum nó é movido,
 * para o cursor continuar onde está.
 */
function dropStaleSizes(editor: HTMLElement) {
  editor.querySelectorAll<HTMLElement>("[data-size]").forEach((element) => {
    if (element.style.fontSize) return;
    element.removeAttribute("data-size");
    element.style.removeProperty("line-height");
    if (!element.getAttribute("style")?.trim()) element.removeAttribute("style");
  });
}

/** Troca as marcações <font size="7"> criadas pelo navegador por trechos com o tamanho do documento. */
function convertFontMarkers(editor: HTMLElement, size: number) {
  const created: HTMLElement[] = [];
  // Os nós de texto são movidos para o novo trecho; o cursor que estava neles volta para o mesmo ponto.
  const selection = window.getSelection();
  const anchor = selection?.rangeCount ? { node: selection.anchorNode, offset: selection.anchorOffset, focus: selection.focusNode, focusOffset: selection.focusOffset } : null;
  editor.querySelectorAll<HTMLElement>("font[size='7']").forEach((font) => {
    const span = document.createElement("span");
    markSizedElement(span, size);
    span.append(...Array.from(font.childNodes));
    font.replaceWith(span);
    clearNestedSizes(span);
    created.push(span);
  });
  dropStaleSizes(editor);
  if (created.length && anchor?.node && anchor.focus && editor.contains(anchor.node) && editor.contains(anchor.focus)) {
    try {
      selection!.setBaseAndExtent(anchor.node, anchor.offset, anchor.focus, anchor.focusOffset);
    } catch {
      // A seleção original deixou de existir; o navegador mantém a posição que já tinha.
    }
  }
  return created;
}

/** Linha (parágrafo ou item de lista) onde está o cursor. */
function currentLine(editor: HTMLElement, node: Node) {
  let element = elementFromNode(node);
  while (element && element !== editor) {
    if (element.tagName === "LI" || element.parentElement === editor && getComputedStyle(element).display !== "inline") return element;
    element = element.parentElement;
  }
  return null;
}

/**
 * Aplica o tamanho à seleção. Sem seleção, vale para a linha inteira onde está o cursor (o caminho
 * mais curto para transformar uma linha em título); numa linha vazia, vale para o que for digitado.
 * Devolve o tamanho pendente para a digitação, quando houver.
 */
function applyFontSize(editor: HTMLElement, size: number) {
  const selection = window.getSelection();
  if (!selection?.rangeCount || !editor.contains(selection.getRangeAt(0).startContainer)) return null;
  if (selection.isCollapsed) {
    const line = currentLine(editor, selection.getRangeAt(0).startContainer);
    if (line && line.textContent?.trim()) {
      const range = document.createRange();
      range.selectNodeContents(line);
      selection.removeAllRanges();
      selection.addRange(range);
    } else if (!line) {
      try {
        selection.modify("move", "backward", "paragraphboundary");
        selection.modify("extend", "forward", "paragraphboundary");
      } catch {
        // Navegadores sem Selection.modify aplicam o tamanho apenas ao que for digitado.
      }
    }
  }
  document.execCommand("styleWithCSS", false, "false");
  document.execCommand("fontSize", false, "7");
  if (selection.isCollapsed) return size;
  const created = convertFontMarkers(editor, size);
  if (created.length) {
    const range = document.createRange();
    range.setStartBefore(created[0]);
    range.setEndAfter(created.at(-1)!);
    selection.removeAllRanges();
    selection.addRange(range);
  }
  return null;
}

function placeCaretAt(node: Node, offset: number) {
  const selection = window.getSelection();
  if (!selection) return;
  const range = document.createRange();
  range.setStart(node, offset);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

/** Texto e marcações soltos na raiz passam para dentro de um parágrafo, mantendo o cursor onde estava. */
function ensureParagraphs(editor: HTMLElement) {
  const loose = Array.from(editor.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE ? Boolean(node.textContent) : node instanceof HTMLElement && INLINE_TAGS.has(node.tagName));
  if (!loose.length) return;
  const selection = window.getSelection();
  const anchor = selection?.rangeCount ? { node: selection.anchorNode, offset: selection.anchorOffset } : null;
  let paragraph: HTMLParagraphElement | null = null;
  for (const node of Array.from(editor.childNodes)) {
    if (!loose.includes(node)) {
      paragraph = null;
      continue;
    }
    if (!paragraph) {
      paragraph = document.createElement("p");
      editor.insertBefore(paragraph, node);
    }
    paragraph.appendChild(node);
  }
  if (anchor?.node && editor.contains(anchor.node)) placeCaretAt(anchor.node, anchor.offset);
}

/**
 * A linha criada pelo Enter começa limpa: sem negrito, tamanho ou estilo de título herdados da linha anterior.
 * Linhas em branco que ficaram com estilo de título voltam a ser texto comum.
 */
function cleanNewLine(editor: HTMLElement) {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return;
  editor.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6").forEach((heading) => {
    if (heading.textContent || heading.contains(selection.anchorNode)) return;
    const paragraph = document.createElement("p");
    paragraph.innerHTML = "<br>";
    heading.replaceWith(paragraph);
  });
  const line = currentLine(editor, selection.getRangeAt(0).startContainer);
  if (!line) return;
  // Enter no início de uma linha deixa a linha vazia acima dela: ela também fica sem formatação.
  const previous = line.previousElementSibling;
  if (previous instanceof HTMLElement && !previous.textContent && (previous.tagName === line.tagName || /^(P|DIV|H[1-6])$/.test(previous.tagName))) resetLine(previous);
  if (line.textContent) return;
  // Reposicionar a seleção também descarta o estilo de digitação que o navegador guardaria para a nova linha.
  placeCaretAt(resetLine(line), 0);
}

/** Deixa uma linha vazia como texto comum, sem marcações nem estilo de título. */
function resetLine(line: HTMLElement) {
  let target = line;
  if (/^H[1-6]$/.test(line.tagName)) {
    target = document.createElement("p");
    // A linha nova continua na mesma moldura e com o mesmo alinhamento.
    if (line.dataset.box) target.dataset.box = line.dataset.box;
    if (line.style.textAlign) target.style.textAlign = line.style.textAlign;
    line.replaceWith(target);
  }
  target.innerHTML = "<br>";
  return target;
}

/**
 * Limpar formatação: sem seleção, vale para a linha inteira do cursor; com seleção, para o trecho selecionado.
 * Remove negrito, itálico, sublinhado e tamanhos, e títulos voltam a ser texto comum.
 */
function clearFormatting(editor: HTMLElement) {
  const selection = window.getSelection();
  if (!selection?.rangeCount || !editor.contains(selection.getRangeAt(0).startContainer)) return;
  const collapsed = selection.isCollapsed;
  if (collapsed) {
    const line = currentLine(editor, selection.getRangeAt(0).startContainer);
    if (!line) return;
    if (!line.textContent) {
      placeCaretAt(resetLine(line), 0);
      return;
    }
    const range = document.createRange();
    range.selectNodeContents(line);
    selection.removeAllRanges();
    selection.addRange(range);
  }
  document.execCommand("removeFormat", false);
  const range = selection.rangeCount ? selection.getRangeAt(0) : null;
  if (range && Array.from(editor.querySelectorAll("h1, h2, h3, h4, h5, h6")).some((heading) => range.intersectsNode(heading))) document.execCommand("formatBlock", false, "<p>");
  dropStaleSizes(editor);
  editor.querySelectorAll<HTMLElement>("span, font").forEach((element) => {
    if (!element.attributes.length || (element.tagName === "FONT" && !element.getAttribute("size") && !element.getAttribute("style"))) element.replaceWith(...Array.from(element.childNodes));
  });
  if (collapsed && selection.rangeCount) selection.collapseToEnd();
}

/** Colar sempre como texto simples: a formatação de outros programas não entra no documento. */
function pastePlainText(event: ClipboardEvent<HTMLDivElement>) {
  event.preventDefault();
  const lines = event.clipboardData.getData("text/plain").replace(/\r\n?/g, "\n").split("\n").slice(0, 400);
  lines.forEach((line, index) => {
    if (index) document.execCommand("insertParagraph", false);
    if (line) document.execCommand("insertText", false, line);
  });
}

/** Blocos (parágrafos, títulos e listas) do primeiro nível do editor alcançados pela seleção. */
function selectedBlocks(editor: HTMLElement) {
  const selection = window.getSelection();
  if (!selection?.rangeCount || !editor.contains(selection.getRangeAt(0).startContainer)) return [];
  const range = selection.getRangeAt(0);
  const top = (node: Node) => {
    let element = elementFromNode(node);
    while (element && element.parentElement !== editor) element = element.parentElement;
    return element && element.parentElement === editor ? element : null;
  };
  if (range.collapsed) {
    const block = top(range.startContainer);
    return block ? [block] : [];
  }
  return Array.from(editor.children).filter((child) => range.intersectsNode(child)) as HTMLElement[];
}

function selectionList(editor: HTMLElement) {
  const selection = window.getSelection();
  const element = selection?.rangeCount ? elementFromNode(selection.getRangeAt(0).startContainer) : null;
  const list = element?.closest("ul, ol");
  return list && editor.contains(list) ? list as HTMLElement : null;
}

/** Cor do texto onde está o cursor. */
function selectionColor(editor: HTMLElement): RichTextColor | null {
  const selection = window.getSelection();
  let element = selection?.rangeCount ? elementFromNode(selection.getRangeAt(0).startContainer) : null;
  while (element && element !== editor) {
    if (element.dataset.color || element.getAttribute("color") || element.style.color) return elementColor(element) ?? null;
    element = element.parentElement;
  }
  return null;
}

function selectionFormat(editor: HTMLElement): RichTextSelectionFormat {
  const block = selectedBlocks(editor)[0];
  const list = selectionList(editor);
  const type = list ? (list.tagName === "UL" ? "bullet-list" : "ordered-list") : null;
  return {
    color: selectionColor(editor),
    align: richTextAlign(block?.style.textAlign) ?? "left",
    box: richTextBox(block?.dataset.box) ?? null,
    list: type ? { type, variant: richTextListVariant(type, list!.dataset.variant) } : null,
  };
}

/** Cor da paleta (ou a cor normal) no trecho selecionado; sem seleção, vale para o que for digitado. */
function applyColor(color: RichTextColor | null) {
  document.execCommand("styleWithCSS", false, "false");
  document.execCommand("foreColor", false, color ? RICH_TEXT_COLORS[color].hex : DEFAULT_TEXT_HEX);
}

function applyAlign(editor: HTMLElement, align: RichTextAlign | "left") {
  for (const block of selectedBlocks(editor)) {
    if (align === "left") block.style.removeProperty("text-align");
    else block.style.textAlign = align;
    if (!block.getAttribute("style")?.trim()) block.removeAttribute("style");
  }
}

function applyBox(editor: HTMLElement, box: RichTextBox | null) {
  for (const block of selectedBlocks(editor)) {
    if (box) block.dataset.box = box;
    else delete block.dataset.box;
  }
}

/**
 * Transforma as linhas selecionadas em lista (ou volta a texto) e aplica a aparência escolhida. A lista é montada
 * aqui, sem o comando do navegador: ele coloca a lista dentro de títulos, e os itens acabariam salvos numa linha só.
 */
function applyList(editor: HTMLElement, choice: RichTextListChoice) {
  const blocks = selectedBlocks(editor);
  if (!blocks.length) return;
  const isList = (element: Element) => element.tagName === "UL" || element.tagName === "OL";
  const selectContents = (first: Node, last: Node) => {
    const range = document.createRange();
    range.setStart(first, 0);
    range.setEnd(last, last.childNodes.length);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  };
  if (!choice) {
    // Lista para texto: cada item vira um parágrafo, na mesma moldura.
    const paragraphs: HTMLElement[] = [];
    for (const block of blocks) {
      if (!isList(block)) continue;
      const created = Array.from(block.children).map((item) => {
        const paragraph = document.createElement("p");
        paragraph.append(...Array.from(item.childNodes));
        if (!paragraph.childNodes.length) paragraph.innerHTML = "<br>";
        if (block.dataset.box) paragraph.dataset.box = block.dataset.box;
        return paragraph;
      });
      block.replaceWith(...created);
      paragraphs.push(...created);
    }
    if (paragraphs.length) selectContents(paragraphs[0], paragraphs.at(-1)!);
    return;
  }
  const tag = choice.type === "bullet-list" ? "UL" : "OL";
  const list = document.createElement(tag);
  const box = blocks[0].dataset.box;
  for (const block of blocks) {
    if (isList(block)) {
      list.append(...Array.from(block.children));
      continue;
    }
    const item = document.createElement("li");
    item.append(...Array.from(block.childNodes));
    if (!item.textContent) item.innerHTML = "<br>";
    list.append(item);
  }
  blocks[0].replaceWith(list);
  blocks.slice(1).forEach((block) => block.remove());
  if (choice.variant) list.dataset.variant = choice.variant;
  if (box) list.dataset.box = box;
  if (list.firstChild && list.lastChild) selectContents(list.firstChild, list.lastChild);
}

/** Lista dentro de um parágrafo ou título (criada pelo navegador ou colada) sobe para o primeiro nível do editor. */
function liftNestedLists(editor: HTMLElement) {
  for (const block of Array.from(editor.children)) {
    if (block.tagName === "UL" || block.tagName === "OL") continue;
    const nested = Array.from(block.children).filter((child) => child.tagName === "UL" || child.tagName === "OL");
    if (!nested.length) continue;
    let anchor: Element = block;
    for (const list of nested) {
      anchor.after(list);
      anchor = list;
    }
    if (!block.textContent?.trim()) block.remove();
  }
}

/** Estilo do parágrafo onde está o cursor. */
function selectionParagraphStyle(editor: HTMLElement) {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return null;
  const line = currentLine(editor, selection.getRangeAt(0).startContainer);
  return line ? styleFromTag(line.tagName) ?? null : null;
}

/** Transforma as linhas selecionadas em título, subtítulo, seção ou texto. O estilo define o tamanho: tamanhos manuais saem. */
function applyParagraphStyle(editor: HTMLElement, style: RichTextParagraphStyle | null) {
  const selection = window.getSelection();
  if (!selection?.rangeCount || !editor.contains(selection.getRangeAt(0).startContainer)) return;
  document.execCommand("formatBlock", false, `<${style ? PARAGRAPH_STYLE_TAGS[style].toLowerCase() : "p"}>`);
  if (!style || !selection.rangeCount) return;
  const range = selection.getRangeAt(0);
  editor.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6").forEach((block) => {
    if (range.intersectsNode(block)) clearNestedSizes(block);
  });
}

export function InlineRichTextEditor({ initialValue, onChange, onFocus, onBlur, command, onSelectionSize, onSelectionStyle, onSelectionFormat, onKeyDown, ariaLabel, className, placeholder, maxCharacters = 4_000 }: InlineEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const pendingSizeRef = useRef<number | null>(null);
  const onSelectionSizeRef = useRef(onSelectionSize);
  onSelectionSizeRef.current = onSelectionSize;
  const onSelectionStyleRef = useRef(onSelectionStyle);
  const onSelectionFormatRef = useRef(onSelectionFormat);
  onSelectionFormatRef.current = onSelectionFormat;
  onSelectionStyleRef.current = onSelectionStyle;
  const initialDocumentRef = useRef<RichTextDocument | null>(null);
  // Um editor montado depois do último comando (ex.: o texto criado ao inserir um componente) não o repete.
  const lastCommandIdRef = useRef(command?.id ?? 0);
  if (!initialDocumentRef.current) initialDocumentRef.current = parseRichText(initialValue);
  // O React 19 compara dangerouslySetInnerHTML pela identidade do objeto: um objeto novo a cada renderização
  // reescreve o conteúdo e apaga o que está sendo digitado. O HTML inicial é criado uma única vez.
  const initialHtmlRef = useRef<{ __html: string } | null>(null);
  if (!initialHtmlRef.current) initialHtmlRef.current = { __html: documentToHtml(initialDocumentRef.current) };

  function syncValue(event?: FormEvent<HTMLDivElement>) {
    const editor = editorRef.current;
    if (!editor) return;
    if ((event?.nativeEvent as InputEvent | undefined)?.inputType === "insertParagraph") cleanNewLine(editor);
    ensureParagraphs(editor);
    liftNestedLists(editor);
    // O tamanho escolhido numa linha vazia vira <font> só quando o primeiro caractere é digitado.
    if (pendingSizeRef.current && editor.querySelector("font[size='7']")) {
      convertFontMarkers(editor, pendingSizeRef.current);
      pendingSizeRef.current = null;
    }
    dropStaleSizes(editor);
    const value = serializeRichText(documentFromEditor(editor), maxCharacters);
    editor.dataset.empty = String(!value);
    onChange(value);
  }

  function reportSelectionSize() {
    const editor = editorRef.current;
    if (!editor || document.activeElement !== editor) return;
    const selection = window.getSelection();
    const line = selection?.rangeCount ? currentLine(editor, selection.getRangeAt(0).startContainer) : null;
    if (pendingSizeRef.current && line?.textContent?.trim()) pendingSizeRef.current = null;
    const size = pendingSizeRef.current ?? selectionSize(editor);
    if (size) onSelectionSizeRef.current?.(size);
    onSelectionStyleRef.current?.(selectionParagraphStyle(editor));
    onSelectionFormatRef.current?.(selectionFormat(editor));
  }

  useEffect(() => {
    document.addEventListener("selectionchange", reportSelectionSize);
    return () => document.removeEventListener("selectionchange", reportSelectionSize);
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !command || command.id === lastCommandIdRef.current || document.activeElement !== editor) return;
    lastCommandIdRef.current = command.id;
    if (command.value === "fontSize" || command.value === "increaseFontSize" || command.value === "decreaseFontSize") {
      const current = pendingSizeRef.current ?? selectionSize(editor) ?? RICH_TEXT_BASE_SIZE;
      const size = command.value === "fontSize" ? command.size ?? RICH_TEXT_BASE_SIZE : steppedSize(current, command.value === "increaseFontSize" ? 1 : -1);
      if (size === current && command.value !== "fontSize") return;
      pendingSizeRef.current = applyFontSize(editor, size);
      onSelectionSizeRef.current?.(size);
    } else if (command.value === "paragraphStyle") {
      applyParagraphStyle(editor, command.paragraphStyle ?? null);
      onSelectionStyleRef.current?.(selectionParagraphStyle(editor));
    } else if (command.value === "removeFormat") {
      clearFormatting(editor);
      onSelectionStyleRef.current?.(selectionParagraphStyle(editor));
      onSelectionSizeRef.current?.(selectionSize(editor) ?? RICH_TEXT_BASE_SIZE);
    } else if (command.value === "color") {
      applyColor(command.color ?? null);
    } else if (command.value === "align") {
      applyAlign(editor, command.align ?? "left");
    } else if (command.value === "box") {
      applyBox(editor, command.box ?? null);
    } else if (command.value === "list") {
      applyList(editor, command.list ?? null);
    } else {
      document.execCommand(command.value, false);
    }
    syncValue();
    onSelectionFormatRef.current?.(selectionFormat(editor));
  }, [command]);

  function handleFocus() {
    // Enter cria parágrafos (<p>), como os que o documento salva.
    document.execCommand("defaultParagraphSeparator", false, "p");
    onFocus?.();
  }

  return <div ref={editorRef} className={className} data-placeholder={placeholder} data-empty={String(!initialDocumentRef.current.blocks.length)} role="textbox" aria-multiline="true" aria-label={ariaLabel} contentEditable suppressContentEditableWarning spellCheck onFocus={handleFocus} onBlur={onBlur} onKeyDown={onKeyDown} onInput={syncValue} onPaste={pastePlainText} dangerouslySetInnerHTML={initialHtmlRef.current} />;
}

export function ServiceProposalEditor({ name, initialValue, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hiddenFieldRef = useRef<HTMLInputElement>(null);
  const initialDocumentRef = useRef<RichTextDocument | null>(null);
  if (!initialDocumentRef.current) initialDocumentRef.current = parseRichText(initialValue);
  const initialDocument = initialDocumentRef.current;
  const initialValueRef = useRef(serializeRichText(initialDocument) ?? "");

  function applyCommand(command: RichTextEditorCommand) {
    const editor = containerRef.current?.querySelector<HTMLDivElement>(".service-proposal-content");
    editor?.focus();
    if (command === "removeFormat" && editor) clearFormatting(editor);
    else document.execCommand(command, false);
    if (!editor) return;
    liftNestedLists(editor);
    const value = serializeRichText(documentFromEditor(editor));
    if (hiddenFieldRef.current) hiddenFieldRef.current.value = value ?? "";
    onChange?.(value);
  }

  function syncValue(value: string | null) {
    if (hiddenFieldRef.current) hiddenFieldRef.current.value = value ?? "";
    onChange?.(value);
  }

  return <div ref={containerRef} className="service-proposal-editor" data-editor="service-proposal">
    {name ? <input ref={hiddenFieldRef} type="hidden" name={name} defaultValue={initialValueRef.current} /> : null}
    <div className="service-proposal-toolbar" role="toolbar" aria-label="Formatação da descrição da proposta">
      <button type="button" title="Negrito" aria-label="Negrito" onMouseDown={(event) => event.preventDefault()} onClick={() => applyCommand("bold")}><strong>N</strong></button>
      <button type="button" title="Itálico" aria-label="Itálico" onMouseDown={(event) => event.preventDefault()} onClick={() => applyCommand("italic")}><em>I</em></button>
      <button type="button" title="Sublinhado" aria-label="Sublinhado" onMouseDown={(event) => event.preventDefault()} onClick={() => applyCommand("underline")}><u>S</u></button>
      <span aria-hidden="true" />
      <button type="button" title="Lista com marcadores" aria-label="Lista com marcadores" onMouseDown={(event) => event.preventDefault()} onClick={() => applyCommand("insertUnorderedList")}>LISTA</button>
      <button type="button" title="Lista numerada" aria-label="Lista numerada" onMouseDown={(event) => event.preventDefault()} onClick={() => applyCommand("insertOrderedList")}>1.</button>
      <span aria-hidden="true" />
      <button type="button" title="Limpar formatação" aria-label="Limpar formatação" onMouseDown={(event) => event.preventDefault()} onClick={() => applyCommand("removeFormat")}>LIMPAR</button>
    </div>
    <InlineRichTextEditor initialValue={initialValue} onChange={syncValue} ariaLabel="Descrição que será exibida no PDF" className="service-proposal-content" />
  </div>;
}
