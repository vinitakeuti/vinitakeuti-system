import { Document, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseRichText, type RichTextRun } from "@/lib/rich-text";
import type { QuoteDocumentContent } from "@/features/quotes/types/document-content";

const colors = {
  black: "#000000",
  charcoal: "#1F1F1F",
  accent: "#4B6156",
  accentSurface: "#EDF2EF",
  line: "#D9DEDA",
  muted: "#6B706C",
  white: "#FFFFFF",
};

const styles = StyleSheet.create({
  page: { backgroundColor: colors.white, color: colors.charcoal, fontFamily: "Helvetica", fontSize: 10, paddingTop: 48, paddingBottom: 46, paddingHorizontal: 52 },
  cover: { backgroundColor: colors.white, color: colors.charcoal, fontFamily: "Helvetica", paddingTop: 42, paddingBottom: 42, paddingHorizontal: 52 },
  coverArtwork: { height: 372, objectFit: "contain", position: "absolute", right: -12, top: -24, width: 300 },
  coverTop: { gap: 14 },
  coverKicker: { color: colors.accent, fontFamily: "Courier", fontSize: 7.2, letterSpacing: 0.9 },
  coverBrand: { alignItems: "center", flexDirection: "row", gap: 12 },
  coverLogo: { height: 53, objectFit: "contain", width: 69 },
  coverProfessional: { gap: 3 },
  coverProfessionalName: { color: colors.black, fontSize: 10.5, fontWeight: 700 },
  coverProfessionalTitle: { color: colors.charcoal, fontSize: 7.5 },
  coverTitleCluster: { borderLeftColor: colors.accent, borderLeftWidth: 4, marginTop: 132, paddingLeft: 18, paddingTop: 3 },
  coverTitle: { color: colors.black, fontSize: 42, fontWeight: 700, letterSpacing: -1.5, lineHeight: 0.96, maxWidth: 360 },
  coverTitleRule: { backgroundColor: colors.accent, height: 2, marginTop: 22, width: 194 },
  coverDetails: { backgroundColor: colors.accentSurface, borderRadius: 8, bottom: 192, left: 52, padding: 16, position: "absolute", right: 52 },
  coverDetailsRow: { flexDirection: "row", gap: 14 },
  coverDetail: { flexBasis: 0, flexGrow: 1 },
  coverDetailLabel: { color: colors.muted, fontFamily: "Courier", fontSize: 6.1, letterSpacing: 0.55, marginBottom: 5 },
  coverDetailValue: { color: colors.charcoal, fontSize: 8.3, fontWeight: 700, lineHeight: 1.25 },
  coverFooter: { bottom: 39, color: colors.muted, fontFamily: "Courier", fontSize: 6.2, left: 52, letterSpacing: 0.4, position: "absolute", right: 52 },
  header: { borderBottomColor: colors.black, borderBottomWidth: 1, paddingBottom: 14 },
  headerTop: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  professional: { alignItems: "center", flexDirection: "row", flexGrow: 1, flexShrink: 1, gap: 16, marginRight: 16 },
  logoBox: { alignItems: "center", height: 78, justifyContent: "center", width: 104 },
  logo: { height: 74, objectFit: "contain", width: 98 },
  professionalDetails: { flexGrow: 1, flexShrink: 1 },
  documentKicker: { color: colors.accent, fontFamily: "Courier", fontSize: 7.3, letterSpacing: 0.9, marginBottom: 4 },
  professionalName: { color: colors.black, fontSize: 13, fontWeight: 700, letterSpacing: -0.25, marginBottom: 3 },
  professionalTitle: { color: colors.charcoal, fontSize: 8.5, lineHeight: 1.3 },
  professionalInfo: { flexShrink: 1, maxWidth: 190 },
  professionalInfoLine: { color: colors.charcoal, fontSize: 7.3, lineHeight: 1.38, textAlign: "left" },
  documentContent: { marginTop: 29 },
  editorHeading: { color: colors.black, fontSize: 20, letterSpacing: -0.5, lineHeight: 1.18, marginBottom: 12 },
  editorParagraph: { color: colors.charcoal, fontSize: 10, lineHeight: 1.65, marginBottom: 9 },
  editorSmall: { fontSize: 8.5 },
  editorMedium: { fontSize: 10 },
  editorLarge: { fontSize: 15 },
  editorRichText: { marginBottom: 9 },
  editorRichTextParagraph: { color: colors.charcoal, fontSize: 10, lineHeight: 1.65, marginBottom: 8 },
  editorRichTextList: { marginBottom: 8 },
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
  sectionLabel: { color: colors.accent, fontFamily: "Courier", fontSize: 8, letterSpacing: 1, marginBottom: 9 },
  terms: { borderTopColor: colors.line, borderTopWidth: 1, marginTop: 23, paddingTop: 16 },
  termsText: { color: colors.muted, fontSize: 8.5, lineHeight: 1.55 },
  closing: { borderTopColor: colors.black, borderTopWidth: 1, marginTop: 30, paddingTop: 2 },
  closingLabel: { color: colors.accent, fontFamily: "Courier", fontSize: 8, letterSpacing: 1, marginTop: 14 },
  table: { marginTop: 10 },
  tableHeader: { color: colors.muted, flexDirection: "row", fontFamily: "Courier", fontSize: 8, letterSpacing: 0.6, paddingVertical: 9 },
  tableRow: { borderTopColor: colors.line, borderTopWidth: 1, flexDirection: "row", minHeight: 33, paddingVertical: 10 },
  description: { flexGrow: 1, flexBasis: 0, paddingRight: 12 },
  quantity: { textAlign: "right", width: 54 },
  amount: { textAlign: "right", width: 90 },
  total: { alignItems: "flex-end", borderTopColor: colors.charcoal, borderTopWidth: 1, marginTop: 4, paddingTop: 13 },
  totalBreakdown: { color: colors.muted, fontFamily: "Courier", fontSize: 8, letterSpacing: 0.55, marginBottom: 4 },
  totalLabel: { color: colors.muted, fontFamily: "Courier", fontSize: 8, letterSpacing: 0.8 },
  totalValue: { color: colors.black, fontSize: 18, fontWeight: 700, marginTop: 4 },
  footer: { alignItems: "flex-end", bottom: 24, color: colors.muted, flexDirection: "row", fontFamily: "Courier", fontSize: 7, justifyContent: "space-between", left: 52, position: "absolute", right: 52 },
  footerDetails: { flexGrow: 1, paddingRight: 16 },
});

export type QuotePdfInput = {
  code: string;
  issuedAt: Date;
  validUntil?: Date | null;
  title: string;
  scope: string;
  documentContent?: QuoteDocumentContent;
  discountCents?: number;
  client: { name: string; company?: string | null; document?: string | null; email?: string | null };
  items: Array<{ description: string; categoryName?: string | null; proposalText?: string | null; quantity: number; unitPriceCents: number }>;
  terms?: string | null;
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

const money = new Intl.NumberFormat("pt-BR", { currency: "BRL", style: "currency" });
const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Maceio" });

function formatMoney(cents: number) {
  return money.format(cents / 100);
}

function websiteForDisplay(value?: string | null) {
  return value?.trim().replace(/^https?:\/\//i, "").replace(/\/$/, "") ?? "";
}

function PdfRuns({ runs }: { runs: RichTextRun[] }) {
  return <>{runs.map((run, index) => <Text key={`${index}-${run.text.slice(0, 12)}`} style={{ fontWeight: run.bold ? 700 : 400, fontStyle: run.italic ? "italic" : "normal", textDecoration: run.underline ? "underline" : "none" }}>{run.text}</Text>)}</>;
}

function DocumentRichText({ value }: { value: string }) {
  const document = parseRichText(value);
  if (!document.blocks.length) return null;

  return <View style={styles.editorRichText}>{document.blocks.map((block, index) => {
    if (block.type === "paragraph") return <Text key={`paragraph-${index}`} style={styles.editorRichTextParagraph}><PdfRuns runs={block.runs} /></Text>;
    return <View key={`${block.type}-${index}`} style={styles.editorRichTextList}>{block.items.map((item, itemIndex) => <View key={`${index}-${itemIndex}`} style={styles.editorRichTextListItem}><Text style={styles.editorRichTextBullet}>{block.type === "ordered-list" ? `${itemIndex + 1}.` : "-"}</Text><Text style={styles.editorRichTextListText}><PdfRuns runs={item} /></Text></View>)}</View>;
  })}</View>;
}

function QuotePdfDocument({ quote, logoSvg, coverDesignPng }: { quote: QuotePdfInput; logoSvg: Buffer; coverDesignPng: Buffer }): ReactElement {
  const subtotalCents = quote.items.reduce((total, item) => total + item.quantity * item.unitPriceCents, 0);
  const discountCents = Math.max(0, Math.min(quote.discountCents ?? 0, subtotalCents));
  const totalCents = subtotalCents - discountCents;
  const headerDetails = [quote.professional.document, quote.professional.phone, quote.professional.email].filter(Boolean);
  const website = websiteForDisplay(quote.professional.website);
  const footerDetails = [quote.professional.document, website].filter(Boolean).join(" · ");
  const clientCompany = quote.client.company ?? "Não informado";
  const validity = quote.validUntil ? date.format(quote.validUntil) : "Conforme proposta";

  return (
    <Document title={`Orçamento ${quote.code}`} author={quote.professional.name} subject={quote.title}>
      <Page size="A4" style={styles.cover}>
        <Image src={coverDesignPng} style={styles.coverArtwork} />
        <View style={styles.coverTop}>
          <Text style={styles.coverKicker}>PROPOSTA COMERCIAL / {quote.issuedAt.getFullYear()}</Text>
          <View style={styles.coverBrand}>
            <Image src={logoSvg} style={styles.coverLogo} />
            <View style={styles.coverProfessional}>
              <Text style={styles.coverProfessionalName}>{quote.professional.name}</Text>
              {quote.professional.professionalTitle ? <Text style={styles.coverProfessionalTitle}>{quote.professional.professionalTitle}</Text> : null}
            </View>
          </View>
        </View>
        <View style={styles.coverTitleCluster}>
          <Text style={styles.coverTitle}>PROPOSTA{`\n`}COMERCIAL</Text>
          <View style={styles.coverTitleRule} />
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
            {headerDetails.length ? <View style={styles.professionalInfo}>{headerDetails.map((detail) => <Text key={detail} style={styles.professionalInfoLine}>{detail}</Text>)}</View> : null}
          </View>
        </View>

        <View style={styles.documentContent}>
          {quote.documentContent?.blocks.filter((block) => block.id !== "intro-title").map((block) => block.type === "rich-text" ? <DocumentRichText key={block.id} value={block.text} /> : <Text key={block.id} style={[block.type === "heading" ? styles.editorHeading : styles.editorParagraph, block.fontSize === "small" ? styles.editorSmall : block.fontSize === "large" ? styles.editorLarge : styles.editorMedium, { fontWeight: block.bold ? 700 : 400, fontStyle: block.italic ? "italic" : "normal", textDecoration: block.underline ? "underline" : "none", textAlign: block.align }]}>{block.text}</Text>)}
        </View>

        {quote.terms ? <View style={styles.terms}><Text style={styles.sectionLabel}>CONDIÇÕES COMERCIAIS</Text><Text style={styles.termsText}>{quote.terms}</Text></View> : null}

        <View style={styles.closing}>
          <Text style={styles.closingLabel}>VALOR PARA FECHAMENTO</Text>
          <View style={styles.table}>
          <View style={styles.tableHeader} fixed><Text style={styles.description}>ENTREGA</Text><Text style={styles.quantity}>QTD.</Text><Text style={styles.amount}>VALOR</Text></View>
          {quote.items.map((item, index) => <View style={styles.tableRow} key={`${item.description}-${index}`} wrap={false}><Text style={styles.description}>{item.description}</Text><Text style={styles.quantity}>{item.quantity}</Text><Text style={styles.amount}>{formatMoney(item.quantity * item.unitPriceCents)}</Text></View>)}
          </View>
          <View style={styles.total} wrap={false}>
            {discountCents > 0 ? <><Text style={styles.totalBreakdown}>SUBTOTAL {formatMoney(subtotalCents)}</Text><Text style={styles.totalBreakdown}>DESCONTO −{formatMoney(discountCents)}</Text></> : null}
            <Text style={styles.totalLabel}>INVESTIMENTO TOTAL</Text><Text style={styles.totalValue}>{formatMoney(totalCents)}</Text>
          </View>
        </View>

        <View style={styles.footer} fixed><Text style={styles.footerDetails} render={({ pageNumber, totalPages }) => pageNumber === totalPages ? footerDetails : ""} /><Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} /></View>
      </Page>
    </Document>
  );
}

/** Gera um PDF A4 em memória, pronto para resposta HTTP ou armazenamento de arquivo. */
export async function generateQuotePdf(quote: QuotePdfInput): Promise<Buffer> {
  const [logoSvg, coverDesignPng] = await Promise.all([
    readFile(join(process.cwd(), "public/assets/images/logo-vr.svg")),
    readFile(join(process.cwd(), "public/assets/images/design-capa.png")),
  ]);
  return renderToBuffer(<QuotePdfDocument quote={quote} logoSvg={logoSvg} coverDesignPng={coverDesignPng} />);
}
