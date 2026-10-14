export type RichTextMark = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  /** Tamanho em pontos no PDF; ausente quando é o tamanho normal do texto. */
  size?: number;
};

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

export type RichTextParagraph = {
  type: "paragraph";
  runs: RichTextRun[];
};

export type RichTextList = {
  type: "bullet-list" | "ordered-list";
  items: RichTextRun[][];
};

export type RichTextBlock = RichTextParagraph | RichTextList;

export type RichTextDocument = {
  version: 1;
  blocks: RichTextBlock[];
};

const MAX_BLOCKS = 120;
const MAX_LIST_ITEMS = 120;

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
    const run: RichTextRun = {
      text,
      ...(source.bold === true ? { bold: true } : {}),
      ...(source.italic === true ? { italic: true } : {}),
      ...(source.underline === true ? { underline: true } : {}),
      ...(size ? { size } : {}),
    };
    const previous = runs.at(-1);
    if (previous && previous.bold === run.bold && previous.italic === run.italic && previous.underline === run.underline && previous.size === run.size) {
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
      if (runs.length) blocks.push({ type: "paragraph", runs });
      continue;
    }
    if (source.type === "bullet-list" || source.type === "ordered-list") {
      const items = Array.isArray(source.items) ? source.items.slice(0, MAX_LIST_ITEMS).map(normalizedRuns).filter((item) => item.length) : [];
      if (items.length) blocks.push({ type: source.type, items });
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

/** Junta listas consecutivas do mesmo tipo (o editor pagina item a item e as reúne de novo). */
export function mergeAdjacentRichTextLists(blocks: RichTextBlock[]): RichTextBlock[] {
  const output: RichTextBlock[] = [];
  for (const block of blocks) {
    const previous = output.at(-1);
    if (block.type !== "paragraph" && previous && previous.type === block.type) {
      output[output.length - 1] = { type: block.type, items: [...previous.items, ...block.items] };
      continue;
    }
    output.push(block.type === "paragraph" ? block : { type: block.type, items: [...block.items] });
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
      if (runs.length) blocks.push({ type: "paragraph", runs });
      continue;
    }
    const items = block.items.map((item) => truncateRuns(item, remaining)).filter((item) => item.length);
    if (items.length) blocks.push({ type: block.type, items });
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
