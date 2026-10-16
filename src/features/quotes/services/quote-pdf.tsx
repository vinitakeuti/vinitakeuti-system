import { Document, Font, G, Image, Page, Path, StyleSheet, Svg, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { BRAND_MARK_PATHS, BRAND_MARK_TRANSFORM, BRAND_MARK_VIEWBOX, COVER_COLORS, coverTitleLayout } from "@/features/quotes/types/brand-mark";
import type { ReactElement } from "react";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { isBlankRichTextRuns, mergeAdjacentRichTextLists, parseRichText, richTextLineHeight, type RichTextRun } from "@/lib/rich-text";
import { QUOTE_PAGE_CONTENT_WIDTH, quoteDocumentBlockRole, quoteImageWidthShare, type QuoteDocumentBlock, type QuoteDocumentContent } from "@/features/quotes/types/document-content";

const colors = {
  black: "#000000",
  charcoal: "#1F1F1F",
  accent: "#4B6156",
  accentSurface: "#EDF2EF",
  line: "#D9DEDA",
  muted: "#6B706C",
  white: "#FFFFFF",
};

// A hifenização padrão segue regras do inglês e corta palavras em português ("comer-cial"); quebra só entre palavras.
Font.registerHyphenationCallback((word) => [word]);

const styles = StyleSheet.create({
  page: { backgroundColor: colors.white, color: colors.charcoal, fontFamily: "Helvetica", fontSize: 10, paddingTop: 48, paddingBottom: 46, paddingHorizontal: 52 },
  cover: { backgroundColor: COVER_COLORS.background, color: COVER_COLORS.text, fontFamily: "Helvetica", paddingTop: 42, paddingBottom: 42, paddingHorizontal: 52 },
  coverMark: { height: 202, position: "absolute", right: 44, top: 68, width: 270 },
  coverBrand: { alignItems: "center", flexDirection: "row", gap: 12 },
  coverLogo: { height: 46, width: 62 },
  coverProfessional: { gap: 3 },
  coverProfessionalName: { color: COVER_COLORS.text, fontSize: 10.5, fontWeight: 700 },
  coverProfessionalTitle: { color: COVER_COLORS.soft, fontSize: 7.5 },
  coverHeadline: { left: 52, position: "absolute", right: 52 },
  coverKicker: { color: COVER_COLORS.muted, fontFamily: "Courier", fontSize: 7, letterSpacing: 0.9 },
  coverLabel: { color: COVER_COLORS.label, fontSize: 13, fontWeight: 700, letterSpacing: 2, marginTop: 14 },
  coverTitle: { color: COVER_COLORS.text, fontWeight: 700, letterSpacing: -0.8, lineHeight: 1.08, marginTop: 10 },
  coverDetails: { backgroundColor: COVER_COLORS.panel, borderRadius: 8, bottom: 150, left: 52, padding: 18, position: "absolute", right: 52 },
  coverDetailsRow: { flexDirection: "row", gap: 14 },
  coverDetail: { flexBasis: 0, flexGrow: 1 },
  coverDetailLabel: { color: COVER_COLORS.muted, fontFamily: "Courier", fontSize: 6.1, letterSpacing: 0.55, marginBottom: 5 },
  coverDetailValue: { color: COVER_COLORS.text, fontSize: 8.5, fontWeight: 700, lineHeight: 1.25 },
  coverFooter: { bottom: 39, color: COVER_COLORS.muted, fontFamily: "Courier", fontSize: 6.2, left: 52, letterSpacing: 0.4, position: "absolute", right: 52 },
  header: { borderBottomColor: colors.black, borderBottomWidth: 1, marginBottom: 24, paddingBottom: 14 },
  headerTop: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  professional: { alignItems: "center", flexDirection: "row", flexGrow: 1, flexShrink: 1, gap: 16, marginRight: 16 },
  logoBox: { alignItems: "center", height: 78, justifyContent: "center", width: 104 },
  logo: { height: 74, objectFit: "contain", width: 98 },
  professionalDetails: { flexGrow: 1, flexShrink: 1 },
  documentKicker: { color: colors.accent, fontFamily: "Courier", fontSize: 7.3, letterSpacing: 0.9, marginBottom: 4 },
  professionalName: { color: colors.black, fontSize: 13, fontWeight: 700, letterSpacing: -0.25, marginBottom: 3 },
  professionalTitle: { color: colors.charcoal, fontSize: 8.5, lineHeight: 1.3 },
  clientInfo: { alignItems: "flex-end", flexShrink: 1, maxWidth: 200 },
  clientInfoKicker: { color: colors.accent, fontFamily: "Courier", fontSize: 7, letterSpacing: 0.9, marginBottom: 4 },
  clientInfoName: { color: colors.black, fontSize: 9.5, fontWeight: 700, marginBottom: 2, textAlign: "right" },
  clientInfoLine: { color: colors.charcoal, fontSize: 7.3, lineHeight: 1.38, textAlign: "right" },
  documentContent: { marginTop: 5 },
  editorHeading: { color: colors.black, fontSize: 20, letterSpacing: -0.5, lineHeight: 1.18, marginBottom: 12 },
  editorParagraph: { color: colors.charcoal, fontSize: 10, lineHeight: 1.65, marginBottom: 9 },
  editorSmall: { fontSize: 8.5 },
  editorMedium: { fontSize: 10 },
  editorLarge: { fontSize: 15 },
  editorRichText: { marginBottom: 9 },
  editorImage: { marginBottom: 14, marginTop: 4 },
  editorRichTextParagraph: { color: colors.charcoal, fontSize: 10, lineHeight: 1.65, marginBottom: 8 },
  editorRichTextList: { marginBottom: 8 },
  editorRichTextTitle: { color: colors.black, fontSize: 18, fontWeight: 700, letterSpacing: -0.4, lineHeight: 1.2, marginBottom: 8, marginTop: 10 },
  editorRichTextSubtitle: { color: colors.black, fontSize: 13, fontWeight: 700, letterSpacing: -0.2, lineHeight: 1.3, marginBottom: 5, marginTop: 6 },
  editorRichTextListItem: { flexDirection: "row", marginTop: 3, paddingLeft: 2 },
  editorRichTextBullet: { color: colors.charcoal, fontSize: 10, lineHeight: 1.65, width: 12 },
  editorRichTextListText: { color: colors.charcoal, flexGrow: 1, flexShrink: 1, fontSize: 10, lineHeight: 1.65 },
  serviceDescriptions: { marginTop: 14 },
  serviceDescription: { borderTopColor: colors.line, borderTopWidth: 1, marginTop: 12, paddingTop: 12 },
  serviceDescriptionFirst: { borderTopWidth: 0, marginTop: 0, paddingTop: 0 },
  serviceDescriptionHeader: { alignItems: "baseline", flexDirection: "row", justifyContent: "space-between" },
  serviceDescriptionName: { color: colors.black, fontSize: 10, fontWeight: 700 },
  serviceDescriptionCategory: { color: colors.accent, fontFamily: "Courier", fontSize: 7, letterSpacing: 0.55, textAlign: "right" },
  serviceDescriptionText: { color: colors.charcoal, fontSize: 9, lineHeight: 1.55, marginTop: 6 },
  serviceDescriptionList: { marginTop: 5 },
  serviceDescriptionListItem: { flexDirection: "row", marginTop: 3, paddingLeft: 2 },
  serviceDescriptionBullet: { color: colors.charcoal, fontSize: 9, lineHeight: 1.55, width: 12 },
  serviceDescriptionListText: { color: colors.charcoal, flexGrow: 1, flexShrink: 1, fontSize: 9, lineHeight: 1.55 },
  sectionHeading: { alignItems: "center", flexDirection: "row", marginBottom: 14, marginTop: 24 },
  sectionMarker: { backgroundColor: colors.accent, height: 6, marginRight: 8, width: 6 },
  sectionHeadingText: { color: colors.accent, fontFamily: "Courier", fontSize: 7.6, letterSpacing: 1.3 },
  sectionRule: { borderBottomColor: colors.line, borderBottomWidth: 1, flexGrow: 1, marginLeft: 10 },
  serviceTitle: { borderTopColor: colors.line, borderTopWidth: 1, color: colors.black, fontSize: 12, fontWeight: 700, letterSpacing: -0.2, lineHeight: 1.3, marginTop: 16, paddingTop: 14 },
  serviceTitleFirst: { borderTopWidth: 0, marginTop: 0, paddingTop: 0 },
  serviceCategory: { color: colors.accent, fontFamily: "Courier", fontSize: 6.8, letterSpacing: 0.7, marginBottom: 9, marginTop: 4 },
  footer: { alignItems: "flex-end", bottom: 24, color: colors.muted, flexDirection: "row", fontFamily: "Courier", fontSize: 7, justifyContent: "space-between", left: 52, position: "absolute", right: 52 },
  footerDetails: { flexGrow: 1, paddingRight: 16 },
  closingPage: { backgroundColor: colors.white, color: colors.charcoal, fontFamily: "Helvetica", paddingBottom: 56, paddingTop: 42 },
  closingHeader: { alignItems: "center", borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", marginHorizontal: 52, paddingBottom: 14 },
  closingBrand: { alignItems: "center", flexDirection: "row", gap: 10 },
  closingLogo: { height: 22, width: 30 },
  closingBrandName: { color: colors.black, fontSize: 9, fontWeight: 700 },
  closingBrandTitle: { color: colors.muted, fontSize: 6.8, marginTop: 2 },
  closingCode: { color: colors.muted, fontFamily: "Courier", fontSize: 6.8, letterSpacing: 0.8 },
  closingIntro: { marginHorizontal: 52, marginTop: 26 },
  closingKicker: { color: colors.accent, fontFamily: "Courier", fontSize: 7, letterSpacing: 1.2 },
  closingTitle: { color: colors.black, fontSize: 17, fontWeight: 700, letterSpacing: -0.3, lineHeight: 1.2, marginTop: 6 },
  closingSubline: { color: colors.muted, fontSize: 8.5, marginTop: 4 },
  closingBody: { flexGrow: 1, paddingHorizontal: 52, paddingTop: 4 },
  closingTableHead: { borderBottomColor: colors.charcoal, borderBottomWidth: 1, flexDirection: "row", paddingBottom: 7 },
  closingHeadCell: { color: colors.muted, fontFamily: "Courier", fontSize: 6.5, letterSpacing: 0.8 },
  closingRow: { alignItems: "center", borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", paddingVertical: 9 },
  closingItem: { flexBasis: 0, flexGrow: 1, paddingRight: 12 },
  closingItemName: { color: colors.black, fontSize: 10, fontWeight: 700 },
  closingItemCategory: { color: colors.muted, fontSize: 7.5, marginTop: 3 },
  closingItemCalc: { color: colors.muted, fontSize: 8, textAlign: "right", width: 130 },
  closingItemTotal: { color: colors.black, fontSize: 10, fontWeight: 700, textAlign: "right", width: 92 },
  closingSummary: { alignSelf: "flex-end", marginTop: 12, width: 250 },
  closingSummaryLine: { color: colors.muted, flexDirection: "row", fontSize: 8.5, justifyContent: "space-between", marginBottom: 5 },
  closingSummaryTotal: { alignItems: "baseline", borderTopColor: colors.charcoal, borderTopWidth: 1, flexDirection: "row", justifyContent: "space-between", marginTop: 3, paddingTop: 8 },
  closingSummaryTotalLabel: { color: colors.accent, fontFamily: "Courier", fontSize: 7, letterSpacing: 1 },
  closingSummaryTotalValue: { color: colors.black, fontSize: 13, fontWeight: 700 },
  closingSummaryPayment: { color: colors.muted, flexDirection: "row", fontSize: 8.5, justifyContent: "space-between", marginTop: 6 },
  closingSummaryBalance: { alignItems: "baseline", borderTopColor: colors.line, borderTopWidth: 1, flexDirection: "row", justifyContent: "space-between", marginTop: 8, paddingTop: 8 },
  closingSummaryBalanceValue: { color: colors.black, fontSize: 11, fontWeight: 700 },
  closingSummaryNote: { color: colors.muted, fontSize: 7.8, lineHeight: 1.45, marginTop: 8 },
  closingTerms: { color: colors.charcoal, fontSize: 9, lineHeight: 1.6 },
  closingSpacer: { flexGrow: 1, minHeight: 22 },
  closingAcceptance: { borderTopColor: colors.charcoal, borderTopWidth: 1, paddingTop: 13 },
  closingAcceptanceTitle: { color: colors.black, fontSize: 11, fontWeight: 700 },
  closingAcceptanceText: { color: colors.muted, fontSize: 8.5, lineHeight: 1.5, marginTop: 4 },
  closingPlace: { color: colors.charcoal, fontSize: 8.5, marginTop: 11 },
  closingSignatures: { flexDirection: "row", gap: 32, marginTop: 34 },
  closingSignature: { flexBasis: 0, flexGrow: 1 },
  closingSignatureLine: { borderTopColor: colors.charcoal, borderTopWidth: 1, marginBottom: 7 },
  closingSignatureName: { color: colors.black, fontSize: 9.5, fontWeight: 700 },
  closingSignatureDetail: { color: colors.muted, fontSize: 7.8, marginTop: 2 },
  closingSignatureRole: { color: colors.accent, fontFamily: "Courier", fontSize: 6.5, letterSpacing: 0.9, marginTop: 5 },
  closingFooter: { bottom: 24, color: colors.muted, flexDirection: "row", fontFamily: "Courier", fontSize: 6.8, justifyContent: "space-between", left: 52, position: "absolute", right: 52 },
});

export type QuotePdfInput = {
  code: string;
  issuedAt: Date;
  validUntil?: Date | null;
  title: string;
  scope: string;
  documentContent?: QuoteDocumentContent;
  /** Arquivos das imagens do documento, por id. */
  images?: Record<string, QuotePdfImage>;
  discountCents?: number;
  discountPercentBps?: number | null;
  client: { name: string; company?: string | null; document?: string | null; email?: string | null };
  items: Array<{ description: string; categoryName?: string | null; proposalText?: string | null; quantity: number; unitPriceCents: number }>;
  payments?: Array<{ amountCents: number; paidAt: Date }>;
  paymentNotes?: string | null;
  terms?: string | null;
  /** Data da conclusão; o aceite usa essa data (ou a de hoje, enquanto o orçamento estiver pendente). */
  completedAt?: Date | null;
  professional: {
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
};

type QuotePdfImage = { data: Buffer; format: "png" | "jpg" };

const money = new Intl.NumberFormat("pt-BR", { currency: "BRL", style: "currency" });
const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Maceio" });
const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Maceio" });

function formatMoney(cents: number) {
  return money.format(cents / 100);
}

function websiteForDisplay(value?: string | null) {
  return value?.trim().replace(/^https?:\/\//i, "").replace(/\/$/, "") ?? "";
}

function PdfRuns({ runs }: { runs: RichTextRun[] }) {
  // Sem negrito explícito o trecho herda o peso do parágrafo (títulos já são negritos).
  return <>{runs.map((run, index) => <Text key={`${index}-${run.text.slice(0, 12)}`} style={{ ...(run.bold ? { fontWeight: 700 } : {}), fontStyle: run.italic ? "italic" : "normal", textDecoration: run.underline ? "underline" : "none", ...(run.size ? { fontSize: run.size, lineHeight: richTextLineHeight(run.size) } : {}) }}>{run.text}</Text>)}</>;
}

/** Parágrafos e itens curtos não se dividem entre folhas, como no editor; só textos muito longos podem quebrar no meio. */
function keepsWhole(runs: RichTextRun[]) {
  return runs.reduce((total, run) => total + run.text.length, 0) < 1_500;
}

function DocumentRichText({ value }: { value: string }) {
  const document = parseRichText(value);
  if (!document.blocks.length) return null;

  return <View style={styles.editorRichText}>{mergeAdjacentRichTextLists(document.blocks).map((block, index) => {
    // Linha em branco ocupa uma linha só, na altura do tamanho escolhido, como no editor.
    if (block.type === "paragraph" && block.style === "section") return <SectionHeading key={`paragraph-${index}`} compact>{block.runs.map((run) => run.text).join("").replace(/\n/g, " ").trim()}</SectionHeading>;
    if (block.type === "paragraph" && block.style) return <Text key={`paragraph-${index}`} style={[block.style === "title" ? styles.editorRichTextTitle : styles.editorRichTextSubtitle, index === 0 ? { marginTop: 0 } : {}]} minPresenceAhead={40}><PdfRuns runs={block.runs} /></Text>;
    if (block.type === "paragraph" && isBlankRichTextRuns(block.runs)) return <Text key={`paragraph-${index}`} style={styles.editorRichTextParagraph}><PdfRuns runs={[{ ...block.runs[0], text: " " }]} /></Text>;
    if (block.type === "paragraph") return <Text key={`paragraph-${index}`} style={styles.editorRichTextParagraph} wrap={!keepsWhole(block.runs)}><PdfRuns runs={block.runs} /></Text>;
    return <View key={`${block.type}-${index}`} style={styles.editorRichTextList}>{block.items.map((item, itemIndex) => <View key={`${index}-${itemIndex}`} style={styles.editorRichTextListItem} wrap={!keepsWhole(item)}><Text style={styles.editorRichTextBullet}>{block.type === "ordered-list" ? `${itemIndex + 1}.` : "-"}</Text><Text style={styles.editorRichTextListText}><PdfRuns runs={item} /></Text></View>)}</View>;
  })}</View>;
}

/** Rótulo de seção: marcador, texto espaçado e linha fina até a margem. Não fica órfão no pé da página. */
function SectionHeading({ children, compact = false }: { children: string; compact?: boolean }) {
  return <View style={[styles.sectionHeading, compact ? { marginBottom: 10, marginTop: 18 } : {}]} minPresenceAhead={70} wrap={false}><View style={styles.sectionMarker} /><Text style={styles.sectionHeadingText}>{children.toUpperCase()}</Text><View style={styles.sectionRule} /></View>;
}

const imageAlignment = { left: "flex-start", center: "center", right: "flex-end", justify: "center" } as const;

/** Imagem na largura escolhida, alinhada à esquerda, ao centro ou à direita. Nunca é dividida entre folhas. */
function DocumentImage({ block, file }: { block: QuoteDocumentBlock; file?: QuotePdfImage }) {
  if (!block.image || !file) return null;
  const width = QUOTE_PAGE_CONTENT_WIDTH * quoteImageWidthShare(block);
  return <View style={[styles.editorImage, { alignItems: imageAlignment[block.align] }]} wrap={false}><Image src={file} style={{ width, height: (width * block.image.height) / block.image.width }} /></View>;
}

function DocumentBlock({ block, previous, images }: { block: QuoteDocumentBlock; previous?: QuoteDocumentBlock; images?: Record<string, QuotePdfImage> }) {
  // Quebra de página inserida no editor: o conteúdo seguinte começa numa nova folha.
  if (block.type === "page-break") return <View break />;
  if (block.type === "image") return <DocumentImage block={block} file={block.image ? images?.[block.image.id] : undefined} />;
  if (block.type === "rich-text") return <DocumentRichText value={block.text} />;
  const role = quoteDocumentBlockRole(block);
  const marks = { fontStyle: block.italic ? "italic" as const : "normal" as const, textDecoration: block.underline ? "underline" as const : "none" as const, textAlign: block.align };
  if (role === "section-label") return <SectionHeading>{block.text}</SectionHeading>;
  if (role === "service-title") {
    const first = !previous || quoteDocumentBlockRole(previous) === "section-label";
    return <Text style={[styles.serviceTitle, first ? styles.serviceTitleFirst : {}, marks]} minPresenceAhead={60}>{block.text}</Text>;
  }
  if (role === "service-category") return <Text style={[styles.serviceCategory, { textAlign: block.align }]}>{block.text.toUpperCase()}</Text>;
  return <Text style={[block.type === "heading" ? styles.editorHeading : styles.editorParagraph, block.fontSize === "small" ? styles.editorSmall : block.fontSize === "large" ? styles.editorLarge : styles.editorMedium, { fontWeight: block.bold ? 700 : 400, ...marks }]}>{block.text}</Text>;
}

function QuotePdfDocument({ quote, logoSvg }: { quote: QuotePdfInput; logoSvg: Buffer }): ReactElement {
  const subtotalCents = quote.items.reduce((total, item) => total + item.quantity * item.unitPriceCents, 0);
  const discountCents = Math.max(0, Math.min(quote.discountCents ?? 0, subtotalCents));
  const totalCents = subtotalCents - discountCents;
  const clientDetails = [quote.client.company, quote.client.document].filter(Boolean);
  const website = websiteForDisplay(quote.professional.website);
  const footerDetails = [quote.professional.document, website].filter(Boolean).join(" · ");
  const clientCompany = quote.client.company ?? "Não informado";
  const validity = quote.validUntil ? date.format(quote.validUntil) : "Conforme proposta";
  const payments = quote.payments ?? [];
  const paidCents = payments.reduce((total, payment) => total + payment.amountCents, 0);
  const balanceCents = Math.max(0, totalCents - paidCents);
  const titleLayout = coverTitleLayout(quote.title);
  const contentBlocks = quote.documentContent?.blocks.filter((block) => block.id !== "intro-title") ?? [];
  const signaturePlace = [quote.professional.city, quote.professional.state].filter(Boolean).join(" / ");
  const signatureLine = `${signaturePlace ? `${signaturePlace}, ` : ""}${date.format(quote.completedAt ?? new Date())}.`;

  return (
    <Document title={`Orçamento ${quote.code}`} author={quote.professional.name} subject={quote.title}>
      <Page size="A4" style={styles.cover}>
        <Svg viewBox={BRAND_MARK_VIEWBOX} style={styles.coverMark}><G transform={BRAND_MARK_TRANSFORM}>{BRAND_MARK_PATHS.map((d) => <Path key={d} d={d} fill={COVER_COLORS.mark} />)}</G></Svg>
        <View style={styles.coverBrand}>
          <Svg viewBox={BRAND_MARK_VIEWBOX} style={styles.coverLogo}><G transform={BRAND_MARK_TRANSFORM}>{BRAND_MARK_PATHS.map((d) => <Path key={d} d={d} fill={COVER_COLORS.text} />)}</G></Svg>
          <View style={styles.coverProfessional}>
            <Text style={styles.coverProfessionalName}>{quote.professional.name}</Text>
            {quote.professional.professionalTitle ? <Text style={styles.coverProfessionalTitle}>{quote.professional.professionalTitle}</Text> : null}
          </View>
        </View>
        <View style={[styles.coverHeadline, { top: titleLayout.top }]}>
          <Text style={styles.coverKicker}>{quote.code} / {quote.issuedAt.getFullYear()}</Text>
          <Text style={styles.coverLabel}>PROPOSTA COMERCIAL</Text>
          <Text style={[styles.coverTitle, { fontSize: titleLayout.fontSize, maxWidth: titleLayout.maxWidth }]}>{quote.title}</Text>
        </View>
        <View style={styles.coverDetails}>
          <View style={styles.coverDetailsRow}>
            <View style={styles.coverDetail}><Text style={styles.coverDetailLabel}>CLIENTE</Text><Text style={styles.coverDetailValue}>{quote.client.name}</Text></View>
            <View style={styles.coverDetail}><Text style={styles.coverDetailLabel}>EMPRESA</Text><Text style={styles.coverDetailValue}>{clientCompany}</Text></View>
          </View>
          <View style={[styles.coverDetailsRow, { marginTop: 15 }]}>
            <View style={styles.coverDetail}><Text style={styles.coverDetailLabel}>PROPOSTA</Text><Text style={styles.coverDetailValue}>{quote.code}</Text></View>
            <View style={styles.coverDetail}><Text style={styles.coverDetailLabel}>VALIDADE</Text><Text style={styles.coverDetailValue}>{validity}</Text></View>
          </View>
        </View>
        <Text style={styles.coverFooter}>{quote.professional.name.toUpperCase()} {website ? `· ${website.toUpperCase()}` : ""}</Text>
      </Page>
      <Page size="A4" style={styles.page}>
        <View style={styles.header} fixed>
          <View style={styles.headerTop}>
            <View style={styles.professional}>
              <View style={styles.logoBox}><Image src={logoSvg} style={styles.logo} /></View>
              <View style={styles.professionalDetails}>
                <Text style={styles.documentKicker}>PROPOSTA COMERCIAL</Text>
                <Text style={styles.professionalName}>{quote.professional.name}</Text>
                {quote.professional.professionalTitle ? <Text style={styles.professionalTitle}>{quote.professional.professionalTitle}</Text> : null}
              </View>
            </View>
            <View style={styles.clientInfo}><Text style={styles.clientInfoKicker}>CLIENTE</Text><Text style={styles.clientInfoName}>{quote.client.name}</Text>{clientDetails.map((detail) => <Text key={detail} style={styles.clientInfoLine}>{detail}</Text>)}</View>
          </View>
        </View>

        <View style={styles.documentContent}>
          {contentBlocks.map((block, index) => <DocumentBlock key={block.id} block={block} previous={contentBlocks[index - 1]} images={quote.images} />)}
        </View>

        <View style={styles.footer} fixed><Text style={styles.footerDetails} /><Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} /></View>
      </Page>

      {/* Folha final própria: investimento em destaque, composição, pagamentos, condições e aceite no pé da página. */}
      <Page size="A4" style={styles.closingPage}>
        <View style={styles.closingHeader}>
          <View style={styles.closingBrand}>
            <Svg viewBox={BRAND_MARK_VIEWBOX} style={styles.closingLogo}><G transform={BRAND_MARK_TRANSFORM}>{BRAND_MARK_PATHS.map((d) => <Path key={d} d={d} fill={colors.black} />)}</G></Svg>
            <View><Text style={styles.closingBrandName}>{quote.professional.name}</Text>{quote.professional.professionalTitle ? <Text style={styles.closingBrandTitle}>{quote.professional.professionalTitle}</Text> : null}</View>
          </View>
          <Text style={styles.closingCode}>{quote.code}</Text>
        </View>
        <View style={styles.closingIntro}>
          <Text style={styles.closingKicker}>INVESTIMENTO</Text>
          <Text style={styles.closingTitle}>{quote.title}</Text>
          {quote.validUntil ? <Text style={styles.closingSubline}>Proposta válida até {validity}</Text> : null}
        </View>

        <View style={styles.closingBody}>
          <SectionHeading compact>Composição do investimento</SectionHeading>
          <View style={styles.closingTableHead}><Text style={[styles.closingHeadCell, styles.closingItem]}>SERVIÇO</Text><Text style={[styles.closingHeadCell, { textAlign: "right", width: 130 }]}>QUANTIDADE</Text><Text style={[styles.closingHeadCell, { textAlign: "right", width: 92 }]}>VALOR</Text></View>
          {quote.items.map((item, index) => <View style={styles.closingRow} key={`${item.description}-${index}`} wrap={false}>
            <View style={styles.closingItem}><Text style={styles.closingItemName}>{item.description}</Text>{item.categoryName ? <Text style={styles.closingItemCategory}>{item.categoryName}</Text> : null}</View>
            <Text style={styles.closingItemCalc}>{item.quantity} × {formatMoney(item.unitPriceCents)}</Text>
            <Text style={styles.closingItemTotal}>{formatMoney(item.quantity * item.unitPriceCents)}</Text>
          </View>)}
          <View style={styles.closingSummary} wrap={false}>
            {discountCents > 0 ? <>
              <View style={styles.closingSummaryLine}><Text>Subtotal</Text><Text>{formatMoney(subtotalCents)}</Text></View>
              <View style={styles.closingSummaryLine}><Text>{quote.discountPercentBps ? `Desconto (${(quote.discountPercentBps / 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%)` : "Desconto"}</Text><Text>- {formatMoney(discountCents)}</Text></View>
            </> : null}
            <View style={[styles.closingSummaryTotal, discountCents > 0 ? {} : { borderTopWidth: 0, marginTop: 0, paddingTop: 2 }]}><Text style={styles.closingSummaryTotalLabel}>INVESTIMENTO TOTAL</Text><Text style={styles.closingSummaryTotalValue}>{formatMoney(totalCents)}</Text></View>
            {payments.map((payment, index) => <View style={styles.closingSummaryPayment} key={`${payment.paidAt.toISOString()}-${index}`}><Text>Pago em {shortDate.format(payment.paidAt)}</Text><Text>- {formatMoney(payment.amountCents)}</Text></View>)}
            {payments.length ? <View style={styles.closingSummaryBalance}><Text style={styles.closingSummaryTotalLabel}>SALDO A RECEBER</Text><Text style={styles.closingSummaryBalanceValue}>{formatMoney(balanceCents)}</Text></View> : null}
            {quote.paymentNotes ? <Text style={styles.closingSummaryNote}>{quote.paymentNotes}</Text> : null}
          </View>

          {quote.terms ? <View><SectionHeading compact>Condições comerciais</SectionHeading><Text style={styles.closingTerms}>{quote.terms}</Text></View> : null}

          <View style={styles.closingSpacer} />
          <View style={styles.closingAcceptance} wrap={false}>
            <Text style={styles.closingAcceptanceTitle}>Aceite da proposta</Text>
            <Text style={styles.closingAcceptanceText}>Ao assinar, as partes declaram estar de acordo com os serviços, valores e condições descritos nesta proposta.</Text>
            <Text style={styles.closingPlace}>{signatureLine}</Text>
            <View style={styles.closingSignatures}>
              <View style={styles.closingSignature}><View style={styles.closingSignatureLine} /><Text style={styles.closingSignatureName}>{quote.professional.name}</Text>{quote.professional.document ? <Text style={styles.closingSignatureDetail}>{quote.professional.document}</Text> : null}<Text style={styles.closingSignatureRole}>PROFISSIONAL RESPONSÁVEL</Text></View>
              <View style={styles.closingSignature}><View style={styles.closingSignatureLine} /><Text style={styles.closingSignatureName}>{quote.client.name}</Text>{clientDetails.length ? <Text style={styles.closingSignatureDetail}>{clientDetails.join(" · ")}</Text> : null}<Text style={styles.closingSignatureRole}>CLIENTE</Text></View>
            </View>
          </View>
        </View>

        <View style={styles.closingFooter} fixed><Text>{[quote.professional.name, footerDetails].filter(Boolean).join(" · ").toUpperCase()}</Text><Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} /></View>
      </Page>
    </Document>
  );
}

/** Gera um PDF A4 em memória, pronto para resposta HTTP ou armazenamento de arquivo. */
export async function generateQuotePdf(quote: QuotePdfInput): Promise<Buffer> {
  const logoSvg = await readFile(join(process.cwd(), "public/assets/images/logo-vr.svg"));
  return renderToBuffer(<QuotePdfDocument quote={quote} logoSvg={logoSvg} />);
}
