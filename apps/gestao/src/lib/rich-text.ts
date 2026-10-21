export type RichTextMark = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  /** Tamanho em pontos no PDF; ausente quando é o tamanho normal do texto. */
  size?: number;
  /** Cor da paleta do documento; ausente = cor normal do texto. */
  color?: RichTextColor;
};

/** Paleta de cores do texto, a mesma no editor e no PDF. */
export const RICH_TEXT_COLORS = {
  green: { label: "Verde", hex: "#2F7A55" },
  forest: { label: "Verde escuro", hex: "#1E3F33" },
  orange: { label: "Laranja", hex: "#C9761F" },
  blue: { label: "Azul", hex: "#2D5D8A" },
  red: { label: "Vermelho", hex: "#B03A2E" },
  gray: { label: "Cinza", hex: "#6B706C" },
} as const;
export type RichTextColor = keyof typeof RICH_TEXT_COLORS;

export function richTextColor(value: unknown): RichTextColor | undefined {
  return typeof value === "string" && value in RICH_TEXT_COLORS ? value as RichTextColor : undefined;
}

/** Cor da paleta a partir de um valor CSS (#hex ou rgb()); outras cores não são guardadas. */
export function richTextColorFromCss(value: string | null | undefined): RichTextColor | undefined {
  if (!value) return undefined;
  const source = value.trim().toLowerCase();
  const rgb = source.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  const hex = rgb ? `#${[rgb[1], rgb[2], rgb[3]].map((part) => Number(part).toString(16).padStart(2, "0")).join("")}` : source;
  return (Object.keys(RICH_TEXT_COLORS) as RichTextColor[]).find((key) => RICH_TEXT_COLORS[key].hex.toLowerCase() === hex);
}

/** Alinhamento do parágrafo; ausente = à esquerda. */
export type RichTextAlign = "center" | "right" | "justify";
const RICH_TEXT_ALIGNS: RichTextAlign[] = ["center", "right", "justify"];
export function richTextAlign(value: unknown): RichTextAlign | undefined {
  return RICH_TEXT_ALIGNS.includes(value as RichTextAlign) ? value as RichTextAlign : undefined;
}

/** Moldura em volta de parágrafos e listas: fundo verde claro, contorno ou barra lateral. Blocos vizinhos com a mesma moldura formam uma só. */
export type RichTextBox = "tint" | "outline" | "accent";
export const RICH_TEXT_BOXES: RichTextBox[] = ["tint", "outline", "accent"];
export function richTextBox(value: unknown): RichTextBox | undefined {
  return RICH_TEXT_BOXES.includes(value as RichTextBox) ? value as RichTextBox : undefined;
}

/**
 * Aparência da lista. Marcadores: traço (padrão), ponto, quadrado, etiquetas (arredondadas ou retas) e grade em duas
 * colunas. Numeradas: 1. (padrão), cláusulas (1.1, 1.2) e etapas (linha do tempo).
 */
export type RichTextListVariant = "dot" | "square" | "tags" | "tags-square" | "grid" | "clause" | "steps";
const BULLET_VARIANTS: RichTextListVariant[] = ["dot", "square", "tags", "tags-square", "grid"];
const ORDERED_VARIANTS: RichTextListVariant[] = ["clause", "steps"];
export function richTextListVariant(type: "bullet-list" | "ordered-list", value: unknown): RichTextListVariant | undefined {
  return (type === "bullet-list" ? BULLET_VARIANTS : ORDERED_VARIANTS).includes(value as RichTextListVariant) ? value as RichTextListVariant : undefined;
}

/** Tamanhos oferecidos no editor, em pontos do PDF. O texto normal usa RICH_TEXT_BASE_SIZE. */
export const RICH_TEXT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32] as const;
export const RICH_TEXT_BASE_SIZE = 10;

/** Aproxima qualquer valor para o tamanho permitido mais próximo; o tamanho normal é representado por undefined. */
export function normalizedRichTextSize(value: unknown): number | undefined {
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(numeric) || numeric <= 0) return undefined;
  const nearest = RICH_TEXT_SIZES.reduce((best, size) => Math.abs(size - numeric) < Math.abs(best - numeric) ? size : best, RICH_TEXT_BASE_SIZE as number);
  return nearest === RICH_TEXT_BASE_SIZE ? undefined : nearest;
}

/** Títulos ficam com entrelinha mais justa que o texto corrido. */
export function richTextLineHeight(size?: number) {
  return (size ?? RICH_TEXT_BASE_SIZE) >= 16 ? 1.25 : 1.65;
}

export type RichTextRun = RichTextMark & {
  text: string;
};

/** Estilo do parágrafo: título, subtítulo ou rótulo de seção (como SERVIÇOS INCLUÍDOS). Ausente = texto. */
export type RichTextParagraphStyle = "title" | "subtitle" | "section";
export const RICH_TEXT_PARAGRAPH_STYLES: RichTextParagraphStyle[] = ["title", "subtitle", "section"];

export type RichTextParagraph = {
  type: "paragraph";
  runs: RichTextRun[];
  style?: RichTextParagraphStyle;
  align?: RichTextAlign;
  box?: RichTextBox;
};

function paragraphStyle(value: unknown): RichTextParagraphStyle | undefined {
  return RICH_TEXT_PARAGRAPH_STYLES.includes(value as RichTextParagraphStyle) ? value as RichTextParagraphStyle : undefined;
}

function paragraph(runs: RichTextRun[], style?: RichTextParagraphStyle, align?: RichTextAlign, box?: RichTextBox): RichTextParagraph {
  return { type: "paragraph", runs, ...(style ? { style } : {}), ...(align ? { align } : {}), ...(box ? { box } : {}) };
}

export type RichTextList = {
  type: "bullet-list" | "ordered-list";
  items: RichTextRun[][];
  variant?: RichTextListVariant;
  box?: RichTextBox;
};

function list(type: RichTextList["type"], items: RichTextRun[][], variant?: RichTextListVariant, box?: RichTextBox): RichTextList {
  return { type, items, ...(variant ? { variant } : {}), ...(box ? { box } : {}) };
}

export type RichTextBlock = RichTextParagraph | RichTextList;

export type RichTextDocument = {
  version: 1;
  blocks: RichTextBlock[];
};

// Limites folgados: um contrato longo tem centenas de parágrafos e nada pode ser cortado sem aviso.
const MAX_BLOCKS = 3_000;
const MAX_LIST_ITEMS = 500;

function normalizedText(value: unknown) {
  return typeof value === "string" ? value.replace(/\r\n?/g, "\n") : "";
}

function normalizedRuns(value: unknown): RichTextRun[] {
  if (!Array.isArray(value)) return [];

  const runs: RichTextRun[] = [];
  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object") continue;
    const source = candidate as Record<string, unknown>;
    const text = normalizedText(source.text);
    if (!text) continue;
    const size = normalizedRichTextSize(source.size);
    const color = richTextColor(source.color);
    const run: RichTextRun = {
      text,
      ...(source.bold === true ? { bold: true } : {}),
      ...(source.italic === true ? { italic: true } : {}),
      ...(source.underline === true ? { underline: true } : {}),
      ...(size ? { size } : {}),
      ...(color ? { color } : {}),
    };
    const previous = runs.at(-1);
    if (previous && previous.bold === run.bold && previous.italic === run.italic && previous.underline === run.underline && previous.size === run.size && previous.color === run.color) {
      previous.text += run.text;
    } else {
      runs.push(run);
    }
  }
  return runs;
}

function normalizeDocument(value: unknown): RichTextDocument {
  if (!value || typeof value !== "object" || !Array.isArray((value as Record<string, unknown>).blocks)) {
    return { version: 1, blocks: [] };
  }

  const sourceBlocks = (value as { blocks: unknown[] }).blocks;
  const blocks: RichTextBlock[] = [];
  for (const candidate of sourceBlocks.slice(0, MAX_BLOCKS)) {
    if (!candidate || typeof candidate !== "object") continue;
    const source = candidate as Record<string, unknown>;
    if (source.type === "paragraph") {
      const runs = normalizedRuns(source.runs);
      if (runs.length) blocks.push(paragraph(runs, paragraphStyle(source.style), richTextAlign(source.align), richTextBox(source.box)));
      continue;
    }
    if (source.type === "bullet-list" || source.type === "ordered-list") {
      const items = Array.isArray(source.items) ? source.items.slice(0, MAX_LIST_ITEMS).map(normalizedRuns).filter((item) => item.length) : [];
      if (items.length) blocks.push(list(source.type, items, richTextListVariant(source.type, source.variant), richTextBox(source.box)));
    }
  }
  return { version: 1, blocks };
}

function documentFromLegacyText(value: string): RichTextDocument {
  const blocks = value
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((text) => text.trim())
    .filter(Boolean)
    .slice(0, MAX_BLOCKS)
    .map((text): RichTextParagraph => ({ type: "paragraph", runs: [{ text }] }));
  return { version: 1, blocks };
}

/**
 * Reads the safe, limited rich-text shape used by service descriptions.
 * Plain-text values from older services stay readable and are treated as paragraphs.
 */
export function parseRichText(value?: string | null): RichTextDocument {
  const source = value?.trim();
  if (!source) return { version: 1, blocks: [] };
  try {
    const parsed: unknown = JSON.parse(source);
    const document = normalizeDocument(parsed);
    if (document.blocks.length || (parsed && typeof parsed === "object")) return document;
  } catch {
    // Previous plain-text proposal descriptions remain supported.
  }
  return documentFromLegacyText(source);
}

/** Linha em branco: parágrafo cujo texto é só a quebra de linha que o representa. */
export function isBlankRichTextRuns(runs: RichTextRun[]) {
  return !runs.map((run) => run.text).join("").replace(/\n/g, "").trim();
}

/** Junta listas consecutivas do mesmo tipo, aparência e moldura (o editor pagina item a item e as reúne de novo). */
export function mergeAdjacentRichTextLists(blocks: RichTextBlock[]): RichTextBlock[] {
  const output: RichTextBlock[] = [];
  for (const block of blocks) {
    const previous = output.at(-1);
    if (block.type !== "paragraph" && previous && previous.type === block.type && previous.variant === block.variant && previous.box === block.box) {
      output[output.length - 1] = list(block.type, [...previous.items, ...block.items], block.variant, block.box);
      continue;
    }
    output.push(block.type === "paragraph" ? block : list(block.type, [...block.items], block.variant, block.box));
  }
  return output;
}

export function richTextPlainText(value?: string | null) {
  return parseRichText(value).blocks
    .map((block) => block.type === "paragraph" ? block.runs.map((run) => run.text).join("") : block.items.map((item) => item.map((run) => run.text).join("")).join("\n"))
    .join("\n\n");
}

export function richTextHasContent(value?: string | null) {
  return richTextPlainText(value).trim().length > 0;
}

function truncateRuns(runs: RichTextRun[], remaining: { value: number }) {
  const output: RichTextRun[] = [];
  for (const run of runs) {
    if (remaining.value <= 0) break;
    const text = run.text.slice(0, remaining.value);
    if (!text) continue;
    output.push({ ...run, text });
    remaining.value -= text.length;
  }
  return output;
}

/** Returns compact, validated JSON suitable for a database Text field. */
export function serializeRichText(value: unknown, maxCharacters = 4_000): string | null {
  const document = normalizeDocument(value);
  const remaining = { value: Math.max(0, maxCharacters) };
  const blocks: RichTextBlock[] = [];

  for (const block of document.blocks) {
    if (remaining.value <= 0) break;
    if (block.type === "paragraph") {
      const runs = truncateRuns(block.runs, remaining);
      if (runs.length) blocks.push(paragraph(runs, block.style, block.align, block.box));
      continue;
    }
    const items = block.items.map((item) => truncateRuns(item, remaining)).filter((item) => item.length);
    if (items.length) blocks.push(list(block.type, items, block.variant, block.box));
  }

  return blocks.length ? JSON.stringify({ version: 1, blocks } satisfies RichTextDocument) : null;
}

/** Validates current rich text and keeps legacy plain text readable when a form is submitted. */
export function richTextForStorage(value: FormDataEntryValue | null, maxCharacters = 4_000): string | null {
  const source = typeof value === "string" ? value.trim() : "";
  if (!source) return null;

  try {
    return serializeRichText(JSON.parse(source), maxCharacters);
  } catch {
    return serializeRichText(documentFromLegacyText(source), maxCharacters);
  }
}
