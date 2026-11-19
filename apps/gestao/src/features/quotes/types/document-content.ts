import { richTextForStorage, richTextHasContent } from "@/lib/rich-text";

/** Limite de caracteres de cada texto do documento: folgado o bastante para nunca cortar uma proposta real. */
export const QUOTE_TEXT_MAX_CHARACTERS = 60_000;
const QUOTE_DOCUMENT_MAX_BLOCKS = 400;
/** Tamanho máximo do documento serializado aceito ao salvar. */
export const QUOTE_DOCUMENT_MAX_JSON_LENGTH = 1_500_000;

export type QuoteDocumentBlockType = "heading" | "paragraph" | "rich-text" | "image" | "page-break" | "divider";
/** Linha divisória: fina e cinza, ou curta e grossa na cor de destaque. */
export type QuoteDividerStyle = "line" | "accent";
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
  /** Somente em linhas divisórias. */
  divider?: QuoteDividerStyle;
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

/** Capa do documento livre: opcional, com rótulo e título próprios. Os demais tipos têm capa fixa. */
export type DocumentCoverSettings = { enabled: boolean; label: string; title: string };
export const COVER_LABEL_MAX_LENGTH = 60;
export const COVER_TITLE_MAX_LENGTH = 180;

export type QuoteDocumentContent = {
  version: 1;
  blocks: QuoteDocumentBlock[];
  /** Somente no documento livre. */
  cover?: DocumentCoverSettings;
  /** Somente na proposta: como o valor aparece na página final e as condições de pagamento. */
  closing?: QuoteClosingSettings;
};

/** Valor na página final da proposta: o total, as parcelas ou os dois ("R$ 12.000,00 ou 6 × R$ 2.000,00"). */
export type QuoteClosingValueDisplay = "total" | "installments" | "both";
export const QUOTE_CLOSING_MIN_INSTALLMENTS = 2;
export const QUOTE_CLOSING_MAX_INSTALLMENTS = 60;
export const QUOTE_CLOSING_MAX_DOWN_PAYMENT_PERCENT = 90;
export const QUOTE_TERMS_MAX_LENGTH = 4_000;

/**
 * Página final da proposta. `terms` (condições de pagamento) é escrito no editor junto com o documento, mas fica
 * gravado na coluna `terms` do orçamento, que a gestão e a Eliza também leem; no JSON do documento ficam só a forma
 * de mostrar o valor, a entrada e o número de parcelas.
 * `downPaymentPercent` é a entrada em % do valor total (0 = sem entrada); as parcelas dividem o que sobra.
 */
export type QuoteClosingSettings = { value: QuoteClosingValueDisplay; installments: number; downPaymentPercent: number; terms?: string };

export const defaultQuoteClosing = (): QuoteClosingSettings => ({ value: "total", installments: QUOTE_CLOSING_MIN_INSTALLMENTS, downPaymentPercent: 0 });

/** Com entrada, o restante pode ir numa parcela só ("50% de entrada e 50% na entrega"); sem ela, são pelo menos duas. */
export const minClosingInstallments = (downPaymentPercent: number) => downPaymentPercent > 0 ? 1 : QUOTE_CLOSING_MIN_INSTALLMENTS;

const wholeNumber = (value: unknown, fallback: number) => typeof value === "number" && Number.isFinite(value) ? Math.round(value) : fallback;

/** Entrada e parcelas dentro dos limites: a entrada entre 0 e 90% e as parcelas no mínimo que a entrada permite. */
export function normalizeClosing<T extends Pick<QuoteClosingSettings, "installments" | "downPaymentPercent">>(closing: T): T {
  const downPaymentPercent = Math.min(QUOTE_CLOSING_MAX_DOWN_PAYMENT_PERCENT, Math.max(0, wholeNumber(closing.downPaymentPercent, 0)));
  const installments = Math.min(QUOTE_CLOSING_MAX_INSTALLMENTS, Math.max(minClosingInstallments(downPaymentPercent), wholeNumber(closing.installments, QUOTE_CLOSING_MIN_INSTALLMENTS)));
  return { ...closing, downPaymentPercent, installments };
}

function parseClosingSettings(value: unknown): QuoteClosingSettings | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const closing = value as Partial<Record<keyof QuoteClosingSettings, unknown>>;
  const display = closing.value === "installments" || closing.value === "both" ? closing.value : "total";
  const { installments, downPaymentPercent } = normalizeClosing({ installments: wholeNumber(closing.installments, QUOTE_CLOSING_MIN_INSTALLMENTS), downPaymentPercent: wholeNumber(closing.downPaymentPercent, 0) });
  const terms = typeof closing.terms === "string" ? closing.terms.replace(/\r\n?/g, "\n").trim().slice(0, QUOTE_TERMS_MAX_LENGTH) : undefined;
  return { value: display, installments, downPaymentPercent, ...(terms === undefined ? {} : { terms }) };
}

/** Parcelas iguais; a diferença dos centavos vai para a última, como no Financeiro. */
export function splitInstallments(totalCents: number, count: number) {
  const each = Math.floor(totalCents / count);
  return { count, each, last: totalCents - each * (count - 1) };
}

/** `joined`: continua a linha de cima (entrada e saldo da mesma condição), sem o traço que separa as linhas. */
export type QuoteClosingRow = { label: string; value: string; joined?: boolean };

/**
 * Linhas de valor da página final, iguais na prévia do editor e no PDF.
 * - `lead`: o bloco principal, logo abaixo dos serviços (o total; ou, no parcelado, a entrada e as parcelas).
 * - `rest`: depois dos pagamentos já recebidos (saldo e a alternativa parcelada).
 * Com entrada, as parcelas dividem o que sobra dela. Com pagamentos já recebidos, eles abatem primeiro a entrada:
 * enquanto não a cobrem, aparece o que falta dela; depois, as parcelas dividem o saldo a receber. Sem saldo (ou com
 * menos de um centavo por parcela), fica só o total.
 */
export function quoteClosingRows({ totalCents, paidCents, hasPayments, settings, format }: { totalCents: number; paidCents: number; hasPayments: boolean; settings: Pick<QuoteClosingSettings, "value" | "installments" | "downPaymentPercent"> | undefined; format: (cents: number) => string }) {
  const balanceCents = Math.max(0, totalCents - paidCents);
  const wanted = settings?.value ?? "total";
  const percent = wanted === "total" ? 0 : settings?.downPaymentPercent ?? 0;
  const downCents = Math.round(totalCents * percent / 100);
  const downDueCents = hasPayments ? Math.max(0, downCents - paidCents) : downCents;
  // O que as parcelas dividem: o total sem a entrada; com pagamentos que já cobrem a entrada, o saldo a receber.
  const financedCents = downDueCents > 0 ? totalCents - downCents : hasPayments ? balanceCents : totalCents - downCents;
  const count = settings ? normalizeClosing(settings).installments : QUOTE_CLOSING_MIN_INSTALLMENTS;
  const plan = wanted !== "total" && financedCents >= count ? splitInstallments(financedCents, count) : null;
  const display = plan ? wanted : "total";
  const planText = plan ? plan.count === 1 ? format(plan.each) : `${plan.count} × ${format(plan.each)}` : "";
  const parcels = plan ? `${plan.count} ${plan.count === 1 ? "PARCELA" : "PARCELAS"}` : "";
  const percentText = percent.toLocaleString("pt-BR");
  const total: QuoteClosingRow = { label: "INVESTIMENTO TOTAL", value: format(totalCents) };
  const balance: QuoteClosingRow = { label: "SALDO A RECEBER", value: format(balanceCents) };

  // A condição parcelada: com entrada a pagar, a entrada e o saldo em parcelas; sem ela, só as parcelas.
  const condition = (prefix: "" | "OU "): QuoteClosingRow[] => {
    if (!plan) return [];
    if (downDueCents > 0) return [
      { label: `${prefix}${hasPayments ? "RESTANTE DA ENTRADA" : `ENTRADA DE ${percentText}%`}`, value: format(downDueCents) },
      { label: `${prefix ? "E " : ""}SALDO EM ${parcels}`, value: planText, joined: true },
    ];
    return [{ label: prefix ? `OU EM ${parcels}` : `${hasPayments ? "SALDO" : "INVESTIMENTO"} EM ${parcels}`, value: planText }];
  };

  let lead: QuoteClosingRow[] = [total];
  let rest: QuoteClosingRow[] = hasPayments ? [balance] : [];
  if (display === "installments") {
    if (hasPayments) rest = condition("");
    else lead = condition("");
  } else if (display === "both") {
    rest = [...rest, ...condition("OU ")];
  }
  const note = plan && plan.last !== plan.each ? `A última parcela é de ${format(plan.last)}.` : null;
  return { lead, rest, note };
}

/** Capa do documento livre antes da primeira edição: incluída, sem rótulo e com o título do documento. */
export function defaultFreeCover(title: string): DocumentCoverSettings {
  return { enabled: true, label: "", title };
}

function parseCoverSettings(value: unknown): DocumentCoverSettings | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const cover = value as Partial<DocumentCoverSettings>;
  if (typeof cover.enabled !== "boolean") return null;
  const text = (input: unknown, max: number) => typeof input === "string" ? input.replace(/\s+/g, " ").trim().slice(0, max) : "";
  return { enabled: cover.enabled, label: text(cover.label, COVER_LABEL_MAX_LENGTH), title: text(cover.title, COVER_TITLE_MAX_LENGTH) };
}

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

const validTypes = new Set<QuoteDocumentBlockType>(["heading", "paragraph", "rich-text", "image", "page-break", "divider"]);
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
  const candidate = value as { version?: unknown; blocks?: unknown; cover?: unknown; closing?: unknown };
  if (candidate.version !== 1 || !Array.isArray(candidate.blocks)) return createDefaultQuoteDocument(fallback);
  // Um documento grande demais é limitado, nunca trocado por um documento vazio.
  const blocks = candidate.blocks.slice(0, QUOTE_DOCUMENT_MAX_BLOCKS).flatMap((block, index): QuoteDocumentBlock[] => {
    if (!block || typeof block !== "object" || Array.isArray(block)) return [];
    const item = block as Partial<QuoteDocumentBlock>;
    if (typeof item.text !== "string" || !validTypes.has(item.type as QuoteDocumentBlockType) || !validSizes.has(item.fontSize as QuoteDocumentFontSize) || !validAlignments.has(item.align as QuoteDocumentAlign)) return [];
    const type = item.type as QuoteDocumentBlockType;
    const id = typeof item.id === "string" && item.id.length <= 80 ? item.id : `block-${index}`;
    if (type === "page-break") return [{ id, type, text: "", fontSize: "medium", bold: false, italic: false, underline: false, align: "left" }];
    if (type === "divider") return [{ id, type, text: "", fontSize: "medium", bold: false, italic: false, underline: false, align: "left", divider: item.divider === "accent" ? "accent" : "line" }];
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
  const content = withoutLegacyDefaults.length ? { version: 1 as const, blocks: withoutLegacyDefaults } : createDefaultQuoteDocument(fallback);
  const cover = parseCoverSettings(candidate.cover);
  const closing = parseClosingSettings(candidate.closing);
  return { ...uniqueBlockIds(content), ...(cover ? { cover } : {}), ...(closing ? { closing } : {}) };
}

/**
 * Ids repetidos quebram o editor (a tela perde blocos e o texto some). Um documento salvo assim é consertado ao
 * abrir: a segunda ocorrência ganha um id novo, e um texto livre repetido vira continuação do texto anterior.
 */
export function uniqueBlockIds(content: QuoteDocumentContent): QuoteDocumentContent {
  const seen = new Set<string>();
  let changed = false;
  const blocks = content.blocks.map((block, index) => {
    if (!seen.has(block.id)) {
      seen.add(block.id);
      return block;
    }
    changed = true;
    let id = block.type === "rich-text" && (block.id === QUOTE_INTRO_BLOCK_ID || block.id.startsWith("text-")) ? `text-${index}` : `${block.id}-${index}`;
    for (let suffix = 2; seen.has(id); suffix += 1) id = `${id}-${suffix}`;
    seen.add(id);
    return { ...block, id };
  });
  return changed ? { ...content, blocks } : content;
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
  const hasTextBefore = content.blocks.slice(0, end).some((block) => block.type === "image" || block.type === "page-break" || block.type === "divider" || (block.type === "rich-text" ? richTextHasContent(block.text) : block.text.trim().length > 0));
  if (hasTextBefore) return content;
  const intro: QuoteDocumentBlock = { id: QUOTE_INTRO_BLOCK_ID, type: "rich-text", text: "", fontSize: "medium", bold: false, italic: false, underline: false, align: "left" };
  return { version: 1, blocks: [intro, ...content.blocks.slice(end)] };
}
