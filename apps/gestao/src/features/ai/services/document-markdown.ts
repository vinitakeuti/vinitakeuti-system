import { isBlankRichTextRuns, mergeAdjacentRichTextLists, normalizedRichTextSize, parseRichText, serializeRichText, richTextListVariant, type RichTextAlign, type RichTextBlock, type RichTextBox, type RichTextColor, type RichTextDocument, type RichTextListVariant, type RichTextParagraphStyle, type RichTextRun } from "@/lib/rich-text";
import { QUOTE_TEXT_MAX_CHARACTERS, type QuoteDividerStyle, type QuoteDocumentBlock, type QuoteDocumentContent } from "@/features/quotes/types/document-content";

/**
 * Markdown do editor de PDF: o formato em que a IA lê e escreve documentos. É Markdown simples com alguns acréscimos
 * para os recursos do editor (molduras, aparência das listas, alinhamento, cores, tamanhos e componentes), e a
 * conversão vale nos dois sentidos: um texto formatado vira Markdown para a IA revisar e volta sem perder a formatação.
 *
 *   # título · ## subtítulo · ### rótulo de seção
 *   - item · 1. item (com {ponto} {quadrado} {etiquetas} {etiquetas retas} {grade} {cláusulas} {etapas} na linha anterior)
 *   {centro} {direita} {justificado} na linha anterior de um parágrafo ou título
 *   ::: fundo | ::: contorno | ::: barra ... ::: (moldura)
 *   **negrito** *itálico* ++sublinhado++ {verde 14}cor e tamanho{/}
 *   {linha divisória} {linha de destaque} {quebra de página} {serviços incluídos} {texto padrão} {espaço}
 */

/** Pedaços do documento escrito pela IA: textos e componentes do editor, na ordem. */
export type EditorPart =
  | { type: "text"; text: string }
  | { type: "divider"; style: QuoteDividerStyle }
  | { type: "page-break" }
  | { type: "services" }
  | { type: "template" };

type ParsedPart = { type: "text"; blocks: RichTextBlock[] } | Exclude<EditorPart, { type: "text" }>;
type Marks = Omit<RichTextRun, "text">;

/** Sem acentos, minúsculo e com espaços simples, para aceitar variações como "Cláusulas" e "clausulas". */
function token(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[\s_-]+/g, " ").trim();
}

const COMPONENTS: Record<string, Exclude<EditorPart, { type: "text" }>> = {
  "linha divisoria": { type: "divider", style: "line" },
  linha: { type: "divider", style: "line" },
  divisoria: { type: "divider", style: "line" },
  "linha de destaque": { type: "divider", style: "accent" },
  "divisoria de destaque": { type: "divider", style: "accent" },
  "quebra de pagina": { type: "page-break" },
  "servicos incluidos": { type: "services" },
  "texto padrao": { type: "template" },
};
const BLANK_LINE = new Set(["espaco", "linha em branco"]);
const ALIGNS: Record<string, RichTextAlign> = { centro: "center", centralizado: "center", direita: "right", "a direita": "right", justificado: "justify" };
const LIST_VARIANTS: Record<string, RichTextListVariant> = { ponto: "dot", pontos: "dot", quadrado: "square", quadrados: "square", etiquetas: "tags", "etiquetas arredondadas": "tags", "etiquetas retas": "tags-square", grade: "grid", clausulas: "clause", clausula: "clause", etapas: "steps" };
const BOXES: Record<string, RichTextBox> = { fundo: "tint", "fundo verde": "tint", destaque: "tint", contorno: "outline", moldura: "outline", barra: "accent", "barra lateral": "accent", observacao: "accent" };
const COLORS: Record<string, RichTextColor> = { verde: "green", "verde escuro": "forest", laranja: "orange", azul: "blue", vermelho: "red", cinza: "gray" };
const MARK_WORDS: Record<string, "bold" | "italic" | "underline"> = { negrito: "bold", italico: "italic", sublinhado: "underline" };

const VARIANT_NAMES: Record<RichTextListVariant, string> = { dot: "ponto", square: "quadrado", tags: "etiquetas", "tags-square": "etiquetas retas", grid: "grade", clause: "cláusulas", steps: "etapas" };
const ALIGN_NAMES: Record<RichTextAlign, string> = { center: "centro", right: "direita", justify: "justificado" };
const BOX_NAMES: Record<RichTextBox, string> = { tint: "fundo", outline: "contorno", accent: "barra" };
const COLOR_NAMES: Record<RichTextColor, string> = { green: "verde", forest: "verde escuro", orange: "laranja", blue: "azul", red: "vermelho", gray: "cinza" };

/** Regras do formato para a IA (o mesmo texto vale para escrever e para revisar). */
export function editorMarkdownGuide(options: { services?: boolean; template?: string | null } = {}) {
  return [
    "Formato do texto: o Markdown do editor de PDF, descrito abaixo. Use só estes recursos; nada de tabelas, links, imagens ou HTML.",
    "- Títulos: \"# \" título de uma parte, \"## \" subtítulo, \"### \" rótulo de seção (sai em letras pequenas, maiúsculas e verdes, com um traço ao lado; bom para abrir seções como ESCOPO ou ETAPAS).",
    "- Parágrafos separados por linha em branco. Uma quebra de linha simples continua o mesmo parágrafo, em nova linha.",
    "- No texto: **negrito**, *itálico*, ++sublinhado++. Cor e tamanho com {verde}texto{/}: cores verde, verde escuro, laranja, azul, vermelho e cinza; tamanho em pontos de 8 a 32 (o texto normal tem 10), como {verde 14}texto{/} ou {negrito 12}texto{/}.",
    "- Listas com \"- \" ou \"1. \". Para mudar a aparência, escreva numa linha própria logo antes da lista: {ponto}, {quadrado}, {etiquetas} ou {etiquetas retas} (itens curtos lado a lado, como tecnologias), {grade} (duas colunas com linhas), {etapas} (linha do tempo na horizontal, de 3 a 6 itens curtos) ou {cláusulas} (itens numerados 1.1, 1.2; a primeira lista desse tipo no texto é a 1, a segunda a 2, e assim por diante).",
    "- Alinhamento: {centro}, {direita} ou {justificado} numa linha própria logo antes do parágrafo ou título.",
    "- Molduras: envolva parágrafos e listas entre uma linha \"::: fundo\" (fundo verde claro), \"::: contorno\" (contorno fino) ou \"::: barra\" (barra verde na lateral, para observações) e uma linha só com \":::\".",
    `- Componentes, cada um numa linha própria: {linha divisória} (separa assuntos), {linha de destaque} (traço curto e verde, logo abaixo de um título), {quebra de página} (o que vem depois começa em nova folha)${options.services ? ", {serviços incluídos} (insere, uma vez só, o componente com título, categoria e descrição de cada serviço do orçamento; prefira-o a reescrever os serviços)" : ""}${options.template ? ", {texto padrão} (insere o texto padrão salvo para este tipo de documento, transcrito abaixo; use-o quando ele couber, em vez de reescrevê-lo)" : ""}.`,
    "- {espaço} numa linha própria acrescenta uma linha em branco. Para escrever *, { ou + literalmente, ponha uma barra invertida antes (\\*).",
    "Use os recursos como um bom diagramador: títulos e rótulos de seção dão a estrutura; moldura só no que merece destaque (resumo, prazo, condição importante), poucas por documento; etapas para cronogramas; etiquetas para listas curtas; cor para realçar poucas palavras. Nada de enfeite sem função. Se o pedido descrever um layout, siga-o.",
    options.template ? `Texto padrão salvo (para decidir onde usar {texto padrão}):\n"""\n${options.template}\n"""` : "",
  ].filter(Boolean).join("\n");
}

/* Texto em linha ------------------------------------------------------------------------------------------------ */

const ESCAPABLE = new Set(["\\", "*", "_", "+", "{", "}", "#", "-", ".", ")", ":", "•", ">"]);
const isSpace = (character: string | undefined) => character === undefined || /\s/.test(character);
const isWord = (character: string | undefined) => character !== undefined && /[\p{L}\p{N}]/u.test(character);
const MARKS_OF: Record<string, Marks> = { "***": { bold: true, italic: true }, "**": { bold: true }, "__": { bold: true }, "*": { italic: true }, "_": { italic: true }, "++": { underline: true } };

function runLength(text: string, index: number, character: string) {
  let length = 0;
  while (text[index + length] === character) length += 1;
  return length;
}

/** Onde o marcador aberto termina, pulando o que estiver escapado e os marcadores de outro tamanho aninhados. */
function findCloser(text: string, from: number, delimiter: string) {
  for (let index = from; index < text.length; index += 1) {
    if (text[index] === "\\") { index += 1; continue; }
    if (delimiter === "{/}") { if (text.startsWith("{/}", index)) return index; continue; }
    if (text[index] !== delimiter[0]) continue;
    const run = runLength(text, index, delimiter[0]);
    if (index > from && !isSpace(text[index - 1])) {
      if (delimiter === "*" && run % 2 === 1) return index;
      if ((delimiter === "**" || delimiter === "__" || delimiter === "++") && run >= 2) return index;
      if (delimiter === "***" && run >= 3) return index;
      if (delimiter === "_" && run === 1 && !isWord(text[index + 1])) return index;
    }
    index += run - 1;
  }
  return -1;
}

/** Atributos de {…}texto{/}: cor, tamanho em pontos e negrito/itálico/sublinhado. Nulo quando não é um destaque. */
function spanMarks(content: string): Marks | null {
  let rest = ` ${token(content)} `;
  const marks: Marks = {};
  let matched = false;
  const size = rest.match(/\s(\d{1,2})\s?(?:pt)?\s/);
  if (size) {
    matched = true;
    const value = normalizedRichTextSize(Number(size[1]));
    if (value) marks.size = value;
    rest = rest.replace(size[0], " ");
  }
  for (const [word, mark] of Object.entries(MARK_WORDS)) {
    if (rest.includes(` ${word} `)) { marks[mark] = true; matched = true; rest = rest.replace(` ${word} `, " "); }
  }
  rest = rest.replace(/\s+/g, " ").trim();
  if (rest) {
    if (!COLORS[rest]) return null;
    marks.color = COLORS[rest];
    matched = true;
  }
  return matched ? marks : null;
}

function parseInline(text: string, marks: Marks, output: RichTextRun[]) {
  let buffer = "";
  const flush = () => {
    if (buffer) output.push({ text: buffer, ...marks });
    buffer = "";
  };
  let index = 0;
  while (index < text.length) {
    const character = text[index];
    if (character === "\\" && ESCAPABLE.has(text[index + 1])) { buffer += text[index + 1]; index += 2; continue; }
    if (character === "{") {
      const open = /^\{([^{}\n]{1,40})\}/.exec(text.slice(index, index + 42));
      const attributes = open ? spanMarks(open[1]) : null;
      const close = open && attributes ? findCloser(text, index + open[0].length, "{/}") : -1;
      if (open && attributes && close !== -1) {
        flush();
        parseInline(text.slice(index + open[0].length, close), { ...marks, ...attributes }, output);
        index = close + 3;
        continue;
      }
    }
    const candidates = character === "*" ? ["***", "**", "*"] : character === "+" ? ["++"] : character === "_" && !isWord(text[index - 1]) ? ["__", "_"] : [];
    let consumed = false;
    for (const delimiter of candidates) {
      if (!text.startsWith(delimiter, index) || isSpace(text[index + delimiter.length])) continue;
      const close = findCloser(text, index + delimiter.length, delimiter);
      if (close === -1) continue;
      flush();
      parseInline(text.slice(index + delimiter.length, close), { ...marks, ...MARKS_OF[delimiter] }, output);
      index = close + delimiter.length;
      consumed = true;
      break;
    }
    if (consumed) continue;
    buffer += character;
    index += 1;
  }
  flush();
}

function inlineRuns(text: string) {
  const runs: RichTextRun[] = [];
  parseInline(text, {}, runs);
  return runs.filter((run) => run.text);
}

/* Blocos -------------------------------------------------------------------------------------------------------- */

const HEADING_STYLES: Record<number, RichTextParagraphStyle> = { 1: "title", 2: "subtitle", 3: "section" };
const LIST_ITEM = /^(?:([-*•+])|(\d{1,3})[.)])\s+(.*)$/;

function parseParts(markdown: string): ParsedPart[] {
  const parts: ParsedPart[] = [];
  let blocks: RichTextBlock[] = [];
  let paragraph: { lines: string[]; align?: RichTextAlign; quote: boolean } | null = null;
  let list: { type: "bullet-list" | "ordered-list"; items: string[]; variant?: RichTextListVariant; box?: RichTextBox } | null = null;
  let box: RichTextBox | undefined;
  let pending: { align?: RichTextAlign; variant?: RichTextListVariant } = {};

  const paragraphBlock = (runs: RichTextRun[], style?: RichTextParagraphStyle, align?: RichTextAlign, frame?: RichTextBox): RichTextBlock => ({ type: "paragraph", runs, ...(style ? { style } : {}), ...(align ? { align } : {}), ...(frame ? { box: frame } : {}) });
  const flushParagraph = () => {
    if (paragraph?.lines.length) {
      const runs = inlineRuns(paragraph.lines.join("\n"));
      if (runs.length) blocks.push(paragraphBlock(runs, undefined, paragraph.align, box ?? (paragraph.quote ? "accent" : undefined)));
    }
    paragraph = null;
  };
  const flushList = () => {
    if (list?.items.length) {
      const items = list.items.map(inlineRuns).filter((item) => item.length);
      if (items.length) blocks.push({ type: list.type, items, ...(list.variant ? { variant: list.variant } : {}), ...(list.box ? { box: list.box } : {}) });
    }
    list = null;
  };
  const flushAll = () => { flushParagraph(); flushList(); };
  const flushText = () => {
    flushAll();
    if (blocks.length) parts.push({ type: "text", blocks: mergeAdjacentRichTextLists(blocks) });
    blocks = [];
  };

  for (const raw of markdown.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) { flushAll(); continue; }

    const fence = line.match(/^:{3,}\s*(.*)$/);
    if (fence) {
      flushAll();
      box = fence[1].trim() ? BOXES[token(fence[1])] ?? "tint" : undefined;
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) { flushText(); parts.push(COMPONENTS["linha divisoria"]); continue; }

    const directive = line.match(/^\{([^{}]{1,60})\}$/);
    if (directive) {
      const key = token(directive[1]).replace(/^(lista|alinhamento|estilo|componente)\s*:\s*/, "");
      if (COMPONENTS[key]) { flushText(); parts.push(COMPONENTS[key]); continue; }
      if (BLANK_LINE.has(key)) { flushAll(); blocks.push(paragraphBlock([{ text: "\n" }], undefined, undefined, box)); continue; }
      const words = key.split(/\s*[,;]\s*/);
      if (words.every((word) => ALIGNS[word] || LIST_VARIANTS[word])) {
        flushAll();
        for (const word of words) {
          if (ALIGNS[word]) pending.align = ALIGNS[word];
          else pending.variant = LIST_VARIANTS[word];
        }
        continue;
      }
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushAll();
      const runs = inlineRuns(heading[2].replace(/\s+#+$/, ""));
      if (runs.length) blocks.push(paragraphBlock(runs, HEADING_STYLES[Math.min(heading[1].length, 3)], pending.align, box));
      pending = {};
      continue;
    }

    const item = line.match(LIST_ITEM);
    if (item) {
      flushParagraph();
      const type = item[1] ? "bullet-list" : "ordered-list";
      if (list && list.type !== type) flushList();
      if (!list) {
        list = { type, items: [], variant: richTextListVariant(type, pending.variant), box };
        pending = {};
      }
      list.items.push(item[3]);
      continue;
    }
    if (list && /^(\s{2,}|\t)/.test(raw)) {
      list.items[list.items.length - 1] += `\n${line}`;
      continue;
    }
    flushList();

    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      if (paragraph && !paragraph.quote) flushParagraph();
      if (!quote[1].trim()) { flushParagraph(); continue; }
      paragraph ??= { lines: [], quote: true, align: pending.align };
      paragraph.lines.push(quote[1].trim());
      pending = {};
      continue;
    }
    if (paragraph?.quote) flushParagraph();
    paragraph ??= { lines: [], quote: false, align: pending.align };
    paragraph.lines.push(line);
    pending = {};
  }
  flushText();
  return parts;
}

function serializeBlocks(blocks: RichTextBlock[]) {
  return serializeRichText({ version: 1, blocks }, QUOTE_TEXT_MAX_CHARACTERS) ?? "";
}

/** Markdown da IA em pedaços prontos para o editor: textos (no formato guardado) e componentes, na ordem. */
export function markdownToEditorParts(markdown: string): EditorPart[] {
  return parseParts(markdown).flatMap((part): EditorPart[] => {
    if (part.type !== "text") return [part];
    const text = serializeBlocks(part.blocks);
    return text ? [{ type: "text", text }] : [];
  });
}

/** Só o texto formatado (componentes ficam de fora), para campos de texto único como a descrição de um serviço. */
export function markdownToRichText(markdown: string): RichTextDocument {
  return { version: 1, blocks: parseParts(markdown).flatMap((part) => part.type === "text" ? part.blocks : []) };
}

const newBlockId = (prefix: string) => `${prefix}${crypto.randomUUID().slice(0, 8)}`;
const blockBase = { fontSize: "medium", bold: false, italic: false, underline: false, align: "left" } as const;

/** Conteúdo do documento a partir do Markdown: textos, linhas e quebras de página, como o editor cria. */
export function markdownToDocumentContent(markdown: string, extra: Pick<QuoteDocumentContent, "cover"> = {}): QuoteDocumentContent {
  const blocks: QuoteDocumentBlock[] = [];
  for (const part of markdownToEditorParts(markdown)) {
    if (part.type === "text") blocks.push({ id: blocks.length ? newBlockId("text-") : "intro-text", type: "rich-text", text: part.text, ...blockBase });
    else if (part.type === "divider") blocks.push({ id: newBlockId("divider-"), type: "divider", divider: part.style, text: "", ...blockBase });
    else if (part.type === "page-break") blocks.push({ id: newBlockId("page-break-"), type: "page-break", text: "", ...blockBase });
  }
  if (blocks[0]?.id !== "intro-text") blocks.unshift({ id: "intro-text", type: "rich-text", text: "", ...blockBase });
  return { version: 1, blocks, ...(extra.cover ? { cover: extra.cover } : {}) };
}

/* Texto formatado → Markdown ------------------------------------------------------------------------------------- */

function escapeInline(text: string) {
  return text.replace(/\\/g, "\\\\").replace(/\*/g, "\\*").replace(/\{/g, "\\{").replace(/\+(?=\+)/g, "\\+").replace(/(?<![\p{L}\p{N}])_/gu, "\\_");
}

/** Escapa o começo de uma linha que seria lida como título, lista, citação, moldura ou linha divisória. */
function escapeLineStart(line: string) {
  return line
    .replace(/^#/, "\\#")
    .replace(/^>/, "\\>")
    .replace(/^:::/, "\\:::")
    .replace(/^(-{3,})\s*$/, "\\$1")
    .replace(/^([-•+])(\s)/, "\\$1$2")
    .replace(/^(\d{1,3})([.)])(\s)/, "$1\\$2$3");
}

const hasMarks = (run: RichTextRun | undefined) => Boolean(run && (run.bold || run.italic || run.underline || run.size || run.color));

function runsToMarkdown(runs: RichTextRun[]) {
  return runs.map((run, index) => {
    if (!hasMarks(run)) return escapeInline(run.text);
    const [, lead, core, trail] = run.text.match(/^(\s*)([\s\S]*?)(\s*)$/)!;
    if (!core) return run.text;
    const text = escapeInline(core);
    // Encostado em outro trecho com destaque, os marcadores ficariam ambíguos: usa a forma {…}texto{/}.
    const touching = (!lead && hasMarks(runs[index - 1]) && !/\s$/.test(runs[index - 1].text)) || (!trail && hasMarks(runs[index + 1]) && !/^\s/.test(runs[index + 1].text));
    if (run.size || run.color || touching) {
      const words = [run.bold ? "negrito" : "", run.italic ? "itálico" : "", run.underline ? "sublinhado" : "", run.color ? COLOR_NAMES[run.color] : "", run.size ? String(run.size) : ""].filter(Boolean).join(" ");
      return `${lead}{${words}}${text}{/}${trail}`;
    }
    let value = text;
    if (run.underline) value = `++${value}++`;
    if (run.bold && run.italic) value = `***${value}***`;
    else if (run.bold) value = `**${value}**`;
    else if (run.italic) value = `*${value}*`;
    return `${lead}${value}${trail}`;
  }).join("");
}

function blockToMarkdown(block: RichTextBlock) {
  if (block.type === "paragraph") {
    if (isBlankRichTextRuns(block.runs)) return "{espaço}";
    const prefix = block.style === "title" ? "# " : block.style === "subtitle" ? "## " : block.style === "section" ? "### " : "";
    const text = runsToMarkdown(block.runs).replace(/\n+$/, "");
    const body = prefix ? `${prefix}${text.replace(/\n/g, " ")}` : text.split("\n").map(escapeLineStart).join("\n");
    return `${block.align ? `{${ALIGN_NAMES[block.align]}}\n` : ""}${body}`;
  }
  const items = block.items.map((runs, index) => {
    const [first, ...rest] = runsToMarkdown(runs).split("\n");
    return [`${block.type === "ordered-list" ? `${index + 1}.` : "-"} ${first}`, ...rest.map((line) => `  ${line}`)].join("\n");
  });
  return `${block.variant ? `{${VARIANT_NAMES[block.variant]}}\n` : ""}${items.join("\n")}`;
}

/** Um texto formatado do editor em Markdown do editor, com a formatação (molduras, listas, cores, alinhamento). */
export function richTextToMarkdown(text: string) {
  const output: string[] = [];
  let open: RichTextBox | undefined;
  for (const block of parseRichText(text).blocks) {
    if (block.box !== open) {
      if (open) output.push(":::");
      if (block.box) output.push(`::: ${BOX_NAMES[block.box]}`);
      open = block.box;
    }
    output.push(blockToMarkdown(block));
  }
  if (open) output.push(":::");
  return output.join("\n\n");
}

/** Texto do documento em Markdown, para a IA ler. Imagens aparecem como marcador; linhas e quebras, como componentes. */
export function documentContentToMarkdown(content: QuoteDocumentContent, maxCharacters = 20_000) {
  const parts: string[] = [];
  for (const block of content.blocks) {
    if (block.type === "rich-text") parts.push(richTextToMarkdown(block.text));
    else if (block.type === "heading") parts.push(`## ${block.text}`);
    else if (block.type === "paragraph") parts.push(block.text);
    else if (block.type === "image") parts.push("[imagem]");
    else if (block.type === "page-break") parts.push("{quebra de página}");
    else if (block.type === "divider") parts.push(block.divider === "accent" ? "{linha de destaque}" : "{linha divisória}");
  }
  const text = parts.filter((part) => part.trim()).join("\n\n");
  return text.length > maxCharacters ? `${text.slice(0, maxCharacters)}\n\n[texto cortado]` : text;
}
