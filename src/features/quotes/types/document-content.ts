import { richTextForStorage, richTextHasContent } from "@/lib/rich-text";

/** Limite de caracteres de cada texto do documento: folgado o bastante para nunca cortar uma proposta real. */
export const QUOTE_TEXT_MAX_CHARACTERS = 60_000;
const QUOTE_DOCUMENT_MAX_BLOCKS = 400;
/** Tamanho máximo do documento serializado aceito ao salvar. */
export const QUOTE_DOCUMENT_MAX_JSON_LENGTH = 1_500_000;

export type QuoteDocumentBlockType = "heading" | "paragraph" | "rich-text" | "image" | "page-break";
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
  /** Somente em blocos de imagem: arquivo enviado para o orçamento e suas dimensões em pixels. */
  image?: QuoteDocumentImage;
};

/** Imagem do documento. A largura vem de `fontSize` (pequena, média ou grande) e a posição de `align`. */
export type QuoteDocumentImage = { id: string; width: number; height: number };

export const QUOTE_IMAGE_ID_PATTERN = /^[a-z0-9]{10,40}$/;
const imageWidthShares: Record<QuoteDocumentFontSize, number> = { small: 0.35, medium: 0.6, large: 1 };
/** Área útil da folha do PDF (A4 sem margens) e a altura máxima de uma imagem, para ela sempre caber numa folha. */
export const QUOTE_PAGE_CONTENT_WIDTH = 491;
const QUOTE_IMAGE_MAX_HEIGHT = 480;

/**
 * Fração da largura útil ocupada pela imagem. Editor e PDF usam a mesma regra: imagens muito altas
 * são reduzidas até caberem numa folha, mantendo a proporção.
 */
export function quoteImageWidthShare(block: Pick<QuoteDocumentBlock, "fontSize" | "image">) {
  const share = imageWidthShares[block.fontSize];
  if (!block.image) return share;
  const maxShare = (QUOTE_IMAGE_MAX_HEIGHT * block.image.width) / (block.image.height * QUOTE_PAGE_CONTENT_WIDTH);
  return Math.max(0.1, Math.min(share, maxShare));
}

export function quoteDocumentImageIds(content: QuoteDocumentContent) {
  return content.blocks.flatMap((block) => block.type === "image" && block.image ? [block.image.id] : []);
}

function parseImage(value: unknown): QuoteDocumentImage | null {
  if (!value || typeof value !== "object") return null;
  const image = value as Partial<QuoteDocumentImage>;
  const validSize = (size: unknown) => typeof size === "number" && Number.isInteger(size) && size > 0 && size <= 20_000;
  if (typeof image.id !== "string" || !QUOTE_IMAGE_ID_PATTERN.test(image.id) || !validSize(image.width) || !validSize(image.height)) return null;
  return { id: image.id, width: image.width as number, height: image.height as number };
}

export type QuoteDocumentContent = {
  version: 1;
  blocks: QuoteDocumentBlock[];
};

export type QuoteDocumentBlockRole = "section-label" | "service-title" | "service-category";

/**
 * Papel visual de um bloco. Editor e PDF usam esta mesma regra: títulos pequenos
 * viram rótulos de seção e os blocos gerados por serviço recebem estilo próprio.
 */
export function quoteDocumentBlockRole(block: Pick<QuoteDocumentBlock, "id" | "type" | "fontSize">): QuoteDocumentBlockRole | null {
  if (block.id.startsWith("service-title-")) return "service-title";
  if (block.id.startsWith("service-category-")) return "service-category";
  if (block.type === "heading" && block.fontSize === "small") return "section-label";
  return null;
}

const validTypes = new Set<QuoteDocumentBlockType>(["heading", "paragraph", "rich-text", "image", "page-break"]);
const validSizes = new Set<QuoteDocumentFontSize>(["small", "medium", "large"]);
const validAlignments = new Set<QuoteDocumentAlign>(["left", "center", "right", "justify"]);

/**
 * Documento inicial: uma página em branco para escrever. Serviços incluídos, texto padrão, imagens e
 * quebras de página são componentes inseridos pelo editor onde o usuário escolher.
 */
export function createDefaultQuoteDocument(input: { title: string; clientName: string }): QuoteDocumentContent {
  void input.title;
  void input.clientName;
  return {
    version: 1,
    blocks: [
      { id: "intro-text", type: "rich-text", text: "", fontSize: "medium", bold: false, italic: false, underline: false, align: "left" },
    ],
  };
}

export function hasQuoteServicesComponent(content: QuoteDocumentContent) {
  return content.blocks.some((block) => block.id === "services-label" || block.id.startsWith("service-"));
}

/** Blocos do componente Serviços incluídos: rótulo da seção e, para cada serviço, título, categoria e descrição. */
export function quoteServiceComponentBlocks(services: ServiceDocumentSource[]): QuoteDocumentBlock[] {
  if (!services.length) return [];
  return withQuoteServiceBlocks({ version: 1, blocks: [] }, services).blocks;
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
  if (candidate.version !== 1 || !Array.isArray(candidate.blocks)) return createDefaultQuoteDocument(fallback);
  // Um documento grande demais é limitado, nunca trocado por um documento vazio.
  const blocks = candidate.blocks.slice(0, QUOTE_DOCUMENT_MAX_BLOCKS).flatMap((block, index): QuoteDocumentBlock[] => {
    if (!block || typeof block !== "object" || Array.isArray(block)) return [];
    const item = block as Partial<QuoteDocumentBlock>;
    if (typeof item.text !== "string" || !validTypes.has(item.type as QuoteDocumentBlockType) || !validSizes.has(item.fontSize as QuoteDocumentFontSize) || !validAlignments.has(item.align as QuoteDocumentAlign)) return [];
    const type = item.type as QuoteDocumentBlockType;
    const id = typeof item.id === "string" && item.id.length <= 80 ? item.id : `block-${index}`;
    if (type === "page-break") return [{ id, type, text: "", fontSize: "medium", bold: false, italic: false, underline: false, align: "left" }];
    if (type === "image") {
      const image = parseImage(item.image);
      const align = item.align === "justify" ? "center" : item.align as QuoteDocumentAlign;
      return image ? [{ id, type, text: "", fontSize: item.fontSize as QuoteDocumentFontSize, bold: false, italic: false, underline: false, align, image }] : [];
    }
    // O texto rico é validado e regravado inteiro: cortar o JSON no meio o tornaria ilegível.
    const text = type === "rich-text" ? richTextForStorage(item.text, QUOTE_TEXT_MAX_CHARACTERS) ?? "" : item.text.slice(0, 4_000);
    return [{ id, type, text, fontSize: item.fontSize as QuoteDocumentFontSize, bold: Boolean(item.bold), italic: Boolean(item.italic), underline: Boolean(item.underline), align: item.align as QuoteDocumentAlign }];
  });
  const withoutLegacyDefaults = blocks.filter((block) => !(block.id === "intro-title" || (block.id === "intro-client" && block.text === `Olá, ${fallback.clientName}.`) || (block.id === "intro-body" && block.text === "Preparamos esta proposta com os serviços, prazos e investimento apresentados a seguir.")));
  return withoutLegacyDefaults.length ? { version: 1, blocks: withoutLegacyDefaults } : createDefaultQuoteDocument(fallback);
}

export const QUOTE_INTRO_BLOCK_ID = "intro-text";

/**
 * Garante um bloco de apresentação editável antes dos serviços. Sem ele, um orçamento criado sem
 * texto padrão não tinha onde escrever acima de SERVIÇOS INCLUÍDOS. Vazio, o bloco não aparece no PDF.
 */
export function withQuoteIntroBlock(content: QuoteDocumentContent): QuoteDocumentContent {
  if (content.blocks.some((block) => block.id === QUOTE_INTRO_BLOCK_ID)) return content;
  const serviceStart = content.blocks.findIndex((block) => block.id === "services-label" || block.id.startsWith("service-"));
  const end = serviceStart === -1 ? content.blocks.length : serviceStart;
  const hasTextBefore = content.blocks.slice(0, end).some((block) => block.type === "image" || block.type === "page-break" || (block.type === "rich-text" ? richTextHasContent(block.text) : block.text.trim().length > 0));
  if (hasTextBefore) return content;
  const intro: QuoteDocumentBlock = { id: QUOTE_INTRO_BLOCK_ID, type: "rich-text", text: "", fontSize: "medium", bold: false, italic: false, underline: false, align: "left" };
  return { version: 1, blocks: [intro, ...content.blocks.slice(end)] };
}
