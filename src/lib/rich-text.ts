export type RichTextMark = {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
};

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
    const run: RichTextRun = {
      text,
      ...(source.bold === true ? { bold: true } : {}),
      ...(source.italic === true ? { italic: true } : {}),
      ...(source.underline === true ? { underline: true } : {}),
    };
    const previous = runs.at(-1);
    if (previous && previous.bold === run.bold && previous.italic === run.italic && previous.underline === run.underline) {
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
