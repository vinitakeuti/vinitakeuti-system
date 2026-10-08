export type QuoteDocumentBlockType = "heading" | "paragraph" | "rich-text";
export type QuoteDocumentFontSize = "small" | "medium" | "large";
export type QuoteDocumentAlign = "left" | "center" | "right" | "justify";

export type QuoteDocumentBlock = {
  id: string;
  type: QuoteDocumentBlockType;
  text: string;
  fontSize: QuoteDocumentFontSize;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  align: QuoteDocumentAlign;
};

export type QuoteDocumentContent = {
  version: 1;
  blocks: QuoteDocumentBlock[];
};

const validTypes = new Set<QuoteDocumentBlockType>(["heading", "paragraph", "rich-text"]);
const validSizes = new Set<QuoteDocumentFontSize>(["small", "medium", "large"]);
const validAlignments = new Set<QuoteDocumentAlign>(["left", "center", "right", "justify"]);

function blocksFromTemplate(text?: string | null): QuoteDocumentBlock[] {
  const paragraphs = (text ?? "")
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  for (const paragraph of paragraphs) {
    let remaining = paragraph;
    while (remaining && chunks.length < 200) {
      if (remaining.length <= 4_000) {
        chunks.push(remaining);
        break;
      }
      const breakAt = remaining.lastIndexOf(" ", 4_000);
      const cutAt = breakAt > 2_400 ? breakAt + 1 : 4_000;
      chunks.push(remaining.slice(0, cutAt).trim());
      remaining = remaining.slice(cutAt).trim();
    }
    if (chunks.length === 200) break;
  }

  return chunks.map((text, index) => ({ id: `template-${index + 1}`, type: "paragraph" as const, text, fontSize: "medium" as const, bold: false, italic: false, underline: false, align: "left" as const }));
}

export function createDefaultQuoteDocument(input: { title: string; clientName: string; templateText?: string | null }): QuoteDocumentContent {
  void input.title;
  void input.clientName;
  const templateBlocks = blocksFromTemplate(input.templateText);
  return {
    version: 1,
    blocks: templateBlocks.length ? templateBlocks : [
      { id: "body-1", type: "paragraph", text: "", fontSize: "medium", bold: false, italic: false, underline: false, align: "left" },
    ],
  };
}

type ServiceDocumentSource = {
  id?: string;
  name: string;
  categoryName?: string | null;
  proposalText?: string | null;
};

/**
 * Service copy becomes part of the document on first use. From then on it is
 * independent from the catalog and can be edited as ordinary proposal text.
 */
export function withQuoteServiceBlocks(content: QuoteDocumentContent, services: ServiceDocumentSource[]): QuoteDocumentContent {
  if (!services.length || content.blocks.some((block) => block.id.startsWith("service-"))) return content;

  const blocks: QuoteDocumentBlock[] = [
    ...content.blocks,
    { id: "services-label", type: "heading", text: "SERVIÇOS INCLUÍDOS", fontSize: "small", bold: false, italic: false, underline: false, align: "left" },
  ];

  services.forEach((service, index) => {
    const key = service.id ?? String(index + 1);
    blocks.push({ id: `service-title-${key}`, type: "heading", text: service.name, fontSize: "medium", bold: true, italic: false, underline: false, align: "left" });
    if (service.categoryName) blocks.push({ id: `service-category-${key}`, type: "paragraph", text: service.categoryName, fontSize: "small", bold: false, italic: false, underline: false, align: "left" });
    blocks.push({ id: `service-description-${key}`, type: "rich-text", text: service.proposalText ?? "", fontSize: "medium", bold: false, italic: false, underline: false, align: "left" });
  });

  return { version: 1, blocks };
}

export function parseQuoteDocumentContent(value: unknown, fallback: { title: string; clientName: string }): QuoteDocumentContent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return createDefaultQuoteDocument(fallback);
  const candidate = value as { version?: unknown; blocks?: unknown };
  if (candidate.version !== 1 || !Array.isArray(candidate.blocks) || candidate.blocks.length > 200) return createDefaultQuoteDocument(fallback);
  const blocks = candidate.blocks.flatMap((block, index) => {
    if (!block || typeof block !== "object" || Array.isArray(block)) return [];
    const item = block as Partial<QuoteDocumentBlock>;
    if (typeof item.text !== "string" || !validTypes.has(item.type as QuoteDocumentBlockType) || !validSizes.has(item.fontSize as QuoteDocumentFontSize) || !validAlignments.has(item.align as QuoteDocumentAlign)) return [];
    const type = item.type as QuoteDocumentBlockType;
    const text = type === "rich-text" ? item.text.slice(0, 16_000) : item.text.slice(0, 4_000);
    return [{ id: typeof item.id === "string" && item.id.length <= 80 ? item.id : `block-${index}`, type, text, fontSize: item.fontSize as QuoteDocumentFontSize, bold: Boolean(item.bold), italic: Boolean(item.italic), underline: Boolean(item.underline), align: item.align as QuoteDocumentAlign }];
  });
  const withoutLegacyDefaults = blocks.filter((block) => !(block.id === "intro-title" || (block.id === "intro-client" && block.text === `Olá, ${fallback.clientName}.`) || (block.id === "intro-body" && block.text === "Preparamos esta proposta com os serviços, prazos e investimento apresentados a seguir.")));
  return withoutLegacyDefaults.length ? { version: 1, blocks: withoutLegacyDefaults } : createDefaultQuoteDocument(fallback);
}
