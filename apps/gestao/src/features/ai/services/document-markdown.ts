import { parseRichText, serializeRichText, type RichTextBlock, type RichTextDocument, type RichTextParagraphStyle, type RichTextRun } from "@/lib/rich-text";
import { QUOTE_TEXT_MAX_CHARACTERS, type QuoteDocumentContent } from "@/features/quotes/types/document-content";

/**
 * A IA escreve documentos em Markdown simples; aqui ele vira o texto formatado do editor de documentos (o mesmo
 * que o editor e o PDF usam). Suporta: # título, ## subtítulo, ### rótulo de seção, listas com "-" ou "1.",
 * **negrito**, *itálico* e parágrafos separados por linha em branco. O caminho inverso serve para a IA ler um
 * rascunho antes de revisá-lo.
 */

function inlineRuns(text: string): RichTextRun[] {
  const runs: RichTextRun[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) runs.push({ text: text.slice(last, match.index) });
    const token = match[0];
    if (token.startsWith("**")) runs.push({ text: token.slice(2, -2), bold: true });
    else runs.push({ text: token.slice(1, -1), italic: true });
    last = match.index + token.length;
  }
  if (last < text.length) runs.push({ text: text.slice(last) });
  return runs.filter((run) => run.text);
}

const HEADING_STYLES: Record<number, RichTextParagraphStyle> = { 1: "title", 2: "subtitle", 3: "section" };

export function markdownToRichText(markdown: string): RichTextDocument {
  const blocks: RichTextBlock[] = [];
  let paragraph: string[] = [];
  let list: { type: "bullet-list" | "ordered-list"; items: RichTextRun[][] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: "paragraph", runs: inlineRuns(paragraph.join(" ")) });
    paragraph = [];
  };
  const flushList = () => {
    if (list?.items.length) blocks.push({ type: list.type, items: list.items });
    list = null;
  };

  for (const rawLine of markdown.replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.trim();
    if (!line || /^(-{3,}|\*{3,})$/.test(line)) { flushParagraph(); flushList(); continue; }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushParagraph(); flushList();
      blocks.push({ type: "paragraph", runs: inlineRuns(heading[2].replace(/\*\*/g, "")), style: HEADING_STYLES[Math.min(heading[1].length, 3)] });
      continue;
    }
    const bullet = line.match(/^[-*•]\s+(.+)$/);
    const ordered = line.match(/^\d+[.)]\s+(.+)$/);
    if (bullet || ordered) {
      flushParagraph();
      const type = bullet ? "bullet-list" : "ordered-list";
      if (list && list.type !== type) flushList();
      list ??= { type, items: [] };
      list.items.push(inlineRuns((bullet ?? ordered)![1]));
      continue;
    }
    flushList();
    paragraph.push(line);
  }
  flushParagraph();
  flushList();
  return { version: 1, blocks };
}

/** Conteúdo do documento a partir do Markdown: um único bloco de texto formatado, como o editor cria. */
export function markdownToDocumentContent(markdown: string, extra: Pick<QuoteDocumentContent, "cover"> = {}): QuoteDocumentContent {
  const text = serializeRichText(markdownToRichText(markdown), QUOTE_TEXT_MAX_CHARACTERS) ?? "";
  return {
    version: 1,
    blocks: [{ id: "intro-text", type: "rich-text", text, fontSize: "medium", bold: false, italic: false, underline: false, align: "left" }],
    ...(extra.cover ? { cover: extra.cover } : {}),
  };
}

function runsToMarkdown(runs: RichTextRun[]) {
  return runs.map((run) => run.bold ? `**${run.text}**` : run.italic ? `*${run.text}*` : run.text).join("");
}

const STYLE_PREFIX: Record<RichTextParagraphStyle, string> = { title: "# ", subtitle: "## ", section: "### " };

/** Texto do documento em Markdown, para a IA ler. Imagens e quebras de página aparecem como marcadores. */
export function documentContentToMarkdown(content: QuoteDocumentContent, maxCharacters = 20_000) {
  const parts: string[] = [];
  for (const block of content.blocks) {
    if (block.type === "rich-text") {
      for (const item of parseRichText(block.text).blocks) {
        if (item.type === "paragraph") parts.push(`${item.style ? STYLE_PREFIX[item.style] : ""}${runsToMarkdown(item.runs)}`);
        else parts.push(item.items.map((runs, index) => `${item.type === "ordered-list" ? `${index + 1}.` : "-"} ${runsToMarkdown(runs)}`).join("\n"));
      }
    } else if (block.type === "heading") parts.push(`## ${block.text}`);
    else if (block.type === "paragraph") parts.push(block.text);
    else if (block.type === "image") parts.push("[imagem]");
    else if (block.type === "page-break") parts.push("[quebra de página]");
    else if (block.type === "divider") parts.push("---");
  }
  const text = parts.filter((part) => part.trim()).join("\n\n");
  return text.length > maxCharacters ? `${text.slice(0, maxCharacters)}\n\n[texto cortado]` : text;
}
