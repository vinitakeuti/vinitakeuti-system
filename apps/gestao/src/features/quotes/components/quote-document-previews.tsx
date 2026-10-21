import Link from "next/link";
import type { ReactNode } from "react";
import type { CSSProperties } from "react";
import { ASSIGNMENT_COVER_COLORS, BRAND_MARK_PATHS, BRAND_MARK_TRANSFORM, BRAND_MARK_VIEWBOX, CONTRACT_COVER_COLORS, coverTitleLayout, coverTitleSize, MEMORIAL_COVER_COLORS, MEMORIAL_GRID, pointsToCoverCqw } from "@/features/quotes/types/brand-mark";
import { documentKindInfo, type DocumentKind } from "@/features/documents/types/document-kinds";

function BrandMark({ className }: { className: string }) {
  return <svg className={className} viewBox={BRAND_MARK_VIEWBOX} aria-hidden="true" focusable="false"><g transform={BRAND_MARK_TRANSFORM}>{BRAND_MARK_PATHS.map((d) => <path key={d} d={d} />)}</g></svg>;
}

export type QuotePreviewProfessional = {
  name: string;
  professionalTitle?: string | null;
  document?: string | null;
  city?: string | null;
  state?: string | null;
  website?: string | null;
};

export type QuotePreviewData = {
  id: string;
  code: string;
  title: string;
  issuedAt: string;
  validUntil: string | null;
  client: { name: string; company: string | null; document: string | null };
  items: Array<{ id: string; name: string; categoryName: string | null; quantity: number; totalAmountCents: number }>;
  discountCents: number;
  discountPercentBps: number | null;
  payments: Array<{ id: string; amountCents: number; paidAt: string }>;
  paymentNotes: string | null;
  terms: string | null;
  signatureDate: string;
};

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const longDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Maceio" });
const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Maceio" });
const yearOf = new Intl.DateTimeFormat("pt-BR", { year: "numeric", timeZone: "America/Maceio" });

function websiteForDisplay(value?: string | null) {
  return value?.trim().replace(/^https?:\/\//i, "").replace(/\/$/, "") ?? "";
}

function PreviewLabel({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) {
  return <div className="quote-docs-preview-label"><div><span>{title}</span><small>{detail}</small></div>{action}</div>;
}

function SectionHeading({ children }: { children: string }) {
  return <div className="quote-preview-section"><i aria-hidden="true" /><span>{children}</span></div>;
}

/** Dados da capa: comuns à proposta comercial e aos demais documentos do cliente. */
export type DocumentCoverData = Pick<QuotePreviewData, "code" | "title" | "issuedAt" | "validUntil" | "client">;

/** Pontos do PDF em unidades proporcionais à largura da capa (as mesmas medidas de pdf-covers.tsx). */
const pt = pointsToCoverCqw;
const coverFont = "Helvetica, Arial, sans-serif";
const coverMono = '"Courier New", Courier, monospace';
/** Na tela a grade usa linhas de 1px; um tom mais claro equivale às linhas de 0,5pt do PDF. */
const PREVIEW_GRID_LINE = "#E5ECE7";

function CoverMark({ color, style, outline = false }: { color: string; style: CSSProperties; outline?: boolean }) {
  return <svg viewBox={BRAND_MARK_VIEWBOX} aria-hidden="true" focusable="false" style={{ position: "absolute", ...style }}><g transform={BRAND_MARK_TRANSFORM}>{BRAND_MARK_PATHS.map((d) => outline ? <path key={d} d={d} fill="none" stroke={color} strokeWidth={5} /> : <path key={d} d={d} fill={color} />)}</g></svg>;
}

function CoverBrand({ professional, color, muted, left, top }: { professional: QuotePreviewProfessional; color: string; muted: string; left: number; top: number }) {
  return <div style={{ position: "absolute", left: pt(left), top: pt(top), display: "flex", alignItems: "center", gap: pt(12) }}>
    <svg viewBox={BRAND_MARK_VIEWBOX} aria-hidden="true" focusable="false" style={{ width: pt(46), height: pt(34) }}><g transform={BRAND_MARK_TRANSFORM}>{BRAND_MARK_PATHS.map((d) => <path key={d} d={d} fill={color} />)}</g></svg>
    <div style={{ display: "grid", gap: pt(3) }}><strong style={{ color, fontSize: pt(10.5) }}>{professional.name}</strong>{professional.professionalTitle ? <small style={{ color: muted, fontSize: pt(7.5) }}>{professional.professionalTitle}</small> : null}</div>
  </div>;
}

function CoverMeta({ items, left, top, labelColor, valueColor }: { items: Array<[string, string]>; left: number; top: number; labelColor: string; valueColor: string }) {
  return <div style={{ position: "absolute", left: pt(left), top: pt(top), display: "flex", gap: pt(40) }}>{items.map(([label, value]) => <div key={label} style={{ display: "grid", gap: pt(5) }}><span style={{ color: labelColor, fontFamily: coverMono, fontSize: pt(6.1), letterSpacing: pt(0.55) }}>{label}</span><b style={{ color: valueColor, fontSize: pt(8.5) }}>{value}</b></div>)}</div>;
}

function CoverParty({ role, name, detail, roleColor, nameColor, detailColor }: { role: string; name: string; detail?: string | null; roleColor: string; nameColor: string; detailColor: string }) {
  return <div style={{ display: "grid", minWidth: 0 }}><span style={{ color: roleColor, fontFamily: coverMono, fontSize: pt(6.8), letterSpacing: pt(0.9) }}>{role}</span><b style={{ marginTop: pt(7), color: nameColor, fontSize: pt(11), lineHeight: 1.25, overflowWrap: "anywhere" }}>{name}</b>{detail ? <small style={{ marginTop: pt(3), color: detailColor, fontSize: pt(7.8), lineHeight: 1.35, overflowWrap: "anywhere" }}>{detail}</small> : null}</div>;
}

function CoverFooter({ professional, color, left }: { professional: QuotePreviewProfessional; color: string; left: number }) {
  const website = websiteForDisplay(professional.website);
  return <footer style={{ position: "absolute", left: pt(left), bottom: pt(39), color, fontFamily: coverMono, fontSize: pt(6.2), letterSpacing: pt(0.4) }}>{[professional.name, website].filter(Boolean).join(" · ").toUpperCase()}</footer>;
}

function CoverHeadline({ kicker, label, title, colors, left, top, labelSize, labelGap, rule }: { kicker: string; label: string; title: string; colors: { kicker: string; label: string; title: string; rule?: string }; left: number; top: number; labelSize: number; labelGap: number; rule?: boolean }) {
  return <div style={{ position: "absolute", left: pt(left), right: pt(left), top: pt(top), display: "grid", justifyItems: "start" }}>
    <span style={{ color: colors.kicker, fontFamily: coverMono, fontSize: pt(7), letterSpacing: pt(1.1) }}>{kicker}</span>
    <span style={{ marginTop: pt(labelGap), color: colors.label, fontSize: pt(labelSize), fontWeight: 700, letterSpacing: pt(labelSize === 11 ? 1.6 : 1.8) }}>{label}</span>
    {rule ? <i style={{ display: "block", width: pt(56), height: pt(2), marginTop: pt(18), background: colors.rule }} /> : null}
    <h2 style={{ margin: `${pt(rule ? 18 : 12)} 0 0`, color: colors.title, fontSize: pt(coverTitleSize(title)), fontWeight: 700, letterSpacing: pt(-0.6), lineHeight: 1.1, overflowWrap: "break-word" }}>{title}</h2>
  </div>;
}

function clientDetailText(quote: DocumentCoverData) {
  return [quote.client.company, quote.client.document].filter(Boolean).join(" · ");
}

/** Capa do contrato: papel claro, faixa lateral, título entre réguas finas e as partes do contrato. */
function ContractCoverArt({ quote, professional }: { quote: DocumentCoverData; professional: QuotePreviewProfessional }) {
  const C = CONTRACT_COVER_COLORS;
  return <div className="quote-cover-art" style={{ background: C.background, color: C.text }}>
    <i style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: pt(16), background: C.band }} />
    <i style={{ position: "absolute", left: pt(16), top: 0, bottom: 0, width: pt(3), background: C.accent }} />
    <CoverMark color={C.watermark} style={{ right: pt(-46), bottom: pt(-34), width: pt(330), height: pt(246) }} />
    <CoverBrand professional={professional} color={C.text} muted={C.muted} left={60} top={46} />
    <span style={{ position: "absolute", right: pt(52), top: pt(58), color: C.muted, fontFamily: coverMono, fontSize: pt(7), letterSpacing: pt(0.9) }}>{quote.code} / {yearOf.format(new Date(quote.issuedAt))}</span>
    <CoverHeadline kicker="INSTRUMENTO PARTICULAR" label="CONTRATO DE PRESTAÇÃO DE SERVIÇO" title={quote.title} colors={{ kicker: C.muted, label: C.accent, title: C.text, rule: C.band }} left={60} top={236} labelSize={12} labelGap={12} rule />
    <div style={{ position: "absolute", left: pt(60), right: pt(60), top: pt(556), display: "grid", gridTemplateColumns: "minmax(0, 1fr) 1px minmax(0, 1fr)", borderTop: `1px solid ${C.line}`, paddingTop: pt(16) }}>
      <div style={{ paddingRight: pt(18) }}><CoverParty role="CONTRATADA" name={professional.name} detail={professional.document} roleColor={C.accent} nameColor={C.text} detailColor={C.muted} /></div>
      <i style={{ background: "#C8C5BC" }} />
      <div style={{ paddingLeft: pt(18) }}><CoverParty role="CONTRATANTE" name={quote.client.name} detail={clientDetailText(quote)} roleColor={C.accent} nameColor={C.text} detailColor={C.muted} /></div>
    </div>
    <CoverMeta items={[["DOCUMENTO", quote.code], ["EMISSÃO", longDate.format(new Date(quote.issuedAt))]]} left={60} top={680} labelColor={C.muted} valueColor={C.text} />
    <CoverFooter professional={professional} color={C.muted} left={60} />
  </div>;
}

/** Capa da cessão: verde profundo e o diagrama da transferência, do cedente para o cessionário. */
function AssignmentCoverArt({ quote, professional }: { quote: DocumentCoverData; professional: QuotePreviewProfessional }) {
  const C = ASSIGNMENT_COVER_COLORS;
  const panel: CSSProperties = { width: pt(210), minHeight: pt(92), padding: pt(16), borderRadius: pt(6), background: C.panel, boxSizing: "border-box" };
  return <div className="quote-cover-art" style={{ background: C.background, color: C.text }}>
    <CoverMark color={C.mark} style={{ right: pt(-70), top: pt(-40), width: pt(420), height: pt(313) }} />
    <CoverBrand professional={professional} color={C.text} muted={C.soft} left={52} top={42} />
    <CoverHeadline kicker={`TERMO DE CESSÃO · ${quote.code}`} label="CESSÃO DE TRANSFERÊNCIA DE PROPRIEDADE" title={quote.title} colors={{ kicker: C.muted, label: C.accent, title: C.text }} left={52} top={236} labelSize={11} labelGap={14} />
    <div style={{ position: "absolute", left: pt(52), right: pt(52), top: pt(500), display: "flex", alignItems: "center" }}>
      <div style={panel}><CoverParty role="CEDENTE" name={professional.name} detail={professional.document} roleColor={C.muted} nameColor={C.text} detailColor={C.soft} /></div>
      <svg viewBox="0 0 71 20" aria-hidden="true" style={{ width: pt(71), height: pt(20), flex: "0 0 auto" }}><line x1={8} y1={10} x2={56} y2={10} stroke={C.accent} strokeWidth={1.2} /><polygon points="56,5 64,10 56,15" fill={C.accent} /></svg>
      <div style={panel}><CoverParty role="CESSIONÁRIO" name={quote.client.name} detail={clientDetailText(quote)} roleColor={C.muted} nameColor={C.text} detailColor={C.soft} /></div>
    </div>
    <p style={{ position: "absolute", left: pt(52), top: pt(616), width: pt(380), margin: 0, color: C.soft, fontSize: pt(8.5), lineHeight: 1.5 }}>Transferência dos direitos patrimoniais sobre o que foi desenvolvido, nos termos descritos neste documento.</p>
    <CoverMeta items={[["DOCUMENTO", quote.code], ["EMISSÃO", longDate.format(new Date(quote.issuedAt))]]} left={52} top={690} labelColor={C.muted} valueColor={C.text} />
    <CoverFooter professional={professional} color={C.muted} left={52} />
  </div>;
}

/** Capa do memorial técnico: prancheta quadriculada, marca em traço de desenho técnico e a ficha do documento. */
function MemorialCoverArt({ quote, professional }: { quote: DocumentCoverData; professional: QuotePreviewProfessional }) {
  const C = MEMORIAL_COVER_COLORS;
  const { height, step } = MEMORIAL_GRID;
  const corner = (left: number, top: number, sides: string): CSSProperties => ({ position: "absolute", left: pt(left), top: pt(top), width: pt(12), height: pt(12), boxSizing: "border-box", ...Object.fromEntries(sides.split(" ").map((side) => [`border${side}`, `1px solid ${C.accent}`])) });
  const rows: Array<[string, string]> = [
    ["PROJETO", quote.title],
    ["CLIENTE", [quote.client.name, quote.client.company].filter(Boolean).join(" · ")],
    ["DOCUMENTO", quote.code],
    ["EMISSÃO", longDate.format(new Date(quote.issuedAt))],
    ["RESPONSÁVEL TÉCNICO", [professional.name, professional.document].filter(Boolean).join(" · ")],
  ];
  return <div className="quote-cover-art" style={{ background: C.background, color: C.text }}>
    <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: pt(height), borderBottom: `1px solid ${C.accent}`, backgroundColor: C.grid, backgroundImage: `linear-gradient(to right, ${PREVIEW_GRID_LINE} 1px, transparent 1px), linear-gradient(to bottom, ${PREVIEW_GRID_LINE} 1px, transparent 1px)`, backgroundSize: `${pt(step)} ${pt(step)}` }} />
    <i style={corner(40, 30, "Top Left")} /><i style={corner(543, 30, "Top Right")} /><i style={corner(40, height - 42, "Bottom Left")} /><i style={corner(543, height - 42, "Bottom Right")} />
    <CoverMark color={C.accent} outline style={{ left: pt(352), top: pt(104), width: pt(190), height: pt(142) }} />
    <CoverBrand professional={professional} color={C.text} muted={C.muted} left={52} top={48} />
    <span style={{ position: "absolute", right: pt(52), top: pt(58), color: C.muted, fontFamily: coverMono, fontSize: pt(7), letterSpacing: pt(0.9) }}>{quote.code}</span>
    <CoverHeadline kicker={`DOCUMENTAÇÃO DO PROJETO / ${yearOf.format(new Date(quote.issuedAt))}`} label="MEMORIAL TÉCNICO" title={quote.title} colors={{ kicker: C.muted, label: C.accent, title: C.text }} left={52} top={286} labelSize={12} labelGap={12} />
    <div style={{ position: "absolute", left: pt(52), right: pt(52), top: pt(500) }}>
      <span style={{ display: "block", marginBottom: pt(10), color: C.muted, fontFamily: coverMono, fontSize: pt(7), letterSpacing: pt(1.1) }}>FICHA DO DOCUMENTO</span>
      {rows.map(([label, value]) => <div key={label} style={{ display: "grid", gridTemplateColumns: `${pt(150)} minmax(0, 1fr)`, padding: `${pt(9)} 0`, borderTop: `1px solid ${C.line}` }}><span style={{ paddingTop: pt(2), color: C.muted, fontFamily: coverMono, fontSize: pt(6.5), letterSpacing: pt(0.6) }}>{label}</span><b style={{ color: C.text, fontSize: pt(9.5), lineHeight: 1.3, overflowWrap: "anywhere" }}>{value}</b></div>)}
      <i style={{ display: "block", borderTop: `1px solid ${C.line}` }} />
    </div>
    <CoverFooter professional={professional} color={C.muted} left={52} />
  </div>;
}

/** Réplica somente leitura da capa do PDF, em medidas proporcionais à largura da página. Cada tipo de documento tem a sua capa. */
export function QuoteCoverPreview({ quote, professional, kind = "proposal" }: { quote: DocumentCoverData; professional: QuotePreviewProfessional; kind?: DocumentKind }) {
  if (kind !== "proposal") {
    const art = kind === "contract" ? <ContractCoverArt quote={quote} professional={professional} /> : kind === "assignment" ? <AssignmentCoverArt quote={quote} professional={professional} /> : <MemorialCoverArt quote={quote} professional={professional} />;
    return <div className="quote-docs-preview" id="quote-preview-cover"><article className="quote-docs-page quote-docs-cover is-text-document" aria-label="Capa do documento">{art}</article></div>;
  }
  const website = websiteForDisplay(professional.website);
  const titleLayout = coverTitleLayout(quote.title);
  const info = documentKindInfo(kind);
  return <div className="quote-docs-preview" id="quote-preview-cover">
    <article className="quote-docs-page quote-docs-cover" aria-label="Capa da proposta">
      <div className="quote-cover-sheet">
        <BrandMark className="quote-cover-mark" />
        <div className="quote-cover-brand"><BrandMark className="quote-cover-logo" /><div><strong>{professional.name}</strong>{professional.professionalTitle ? <small>{professional.professionalTitle}</small> : null}</div></div>
        <div className="quote-cover-headline" style={{ top: pointsToCoverCqw(titleLayout.top) }}>
          <span className="quote-cover-kicker">{quote.code} / {yearOf.format(new Date(quote.issuedAt))}</span>
          <span className="quote-cover-label">{info.coverLabel}</span>
          <h2 style={{ maxWidth: pointsToCoverCqw(titleLayout.maxWidth), fontSize: pointsToCoverCqw(titleLayout.fontSize) }}>{quote.title}</h2>
        </div>
        <dl className="quote-cover-details">
          <div><dt>CLIENTE</dt><dd>{quote.client.name}</dd></div>
          <div><dt>EMPRESA</dt><dd>{quote.client.company ?? "Não informado"}</dd></div>
          <div><dt>{kind === "proposal" ? "PROPOSTA" : "DOCUMENTO"}</dt><dd>{quote.code}</dd></div>
          {kind === "proposal" ? <div><dt>VALIDADE</dt><dd>{quote.validUntil ? longDate.format(new Date(quote.validUntil)) : "Conforme proposta"}</dd></div> : <div><dt>EMISSÃO</dt><dd>{longDate.format(new Date(quote.issuedAt))}</dd></div>}
        </dl>
        <footer className="quote-cover-footer">{professional.name.toUpperCase()}{website ? ` · ${website.toUpperCase()}` : ""}</footer>
      </div>
    </article>
  </div>;
}

/** Réplica somente leitura da folha final do PDF (faixa de investimento, composição, pagamentos, condições e aceite). */
export function QuoteClosingPreview({ quote, professional, pageNumber }: { quote: QuotePreviewData; professional: QuotePreviewProfessional; pageNumber: number }) {
  const items = quote.items;
  const subtotalCents = items.reduce((total, item) => total + item.totalAmountCents, 0);
  const discountCents = Math.max(0, Math.min(quote.discountCents, subtotalCents));
  const totalCents = subtotalCents - discountCents;
  const paidCents = quote.payments.reduce((total, payment) => total + payment.amountCents, 0);
  const place = [professional.city, professional.state].filter(Boolean).join(" / ");
  const footer = [professional.name, professional.document, websiteForDisplay(professional.website)].filter(Boolean).join(" · ").toUpperCase();
  const clientDetail = [quote.client.company, quote.client.document].filter(Boolean).join(" · ");

  return <div className="quote-docs-preview" id="quote-preview-closing">
    <PreviewLabel title="FOLHA FINAL" detail="Gerada a partir dos valores salvos. Pode ocupar mais de uma página no PDF." action={<Link className="quote-docs-preview-action" href={`/orcamentos/${quote.id}/editar`}>AJUSTAR VALORES</Link>} />
    <article className="quote-docs-page quote-docs-closing" aria-label="Folha final da proposta">
      <div className="quote-closing-sheet">
        <div className="quote-closing-header">
          <div className="quote-closing-brand"><BrandMark className="quote-closing-logo" /><div><strong>{professional.name}</strong>{professional.professionalTitle ? <small>{professional.professionalTitle}</small> : null}</div></div>
          <span className="quote-closing-code">{quote.code}</span>
        </div>
        <div className="quote-closing-intro">
          <span>INVESTIMENTO</span>
          <h3>{quote.title}</h3>
          {quote.validUntil ? <p>Proposta válida até {longDate.format(new Date(quote.validUntil))}</p> : null}
        </div>
        <div className="quote-closing-body">
          <SectionHeading>Composição do investimento</SectionHeading>
          <div className="quote-closing-table" role="table" aria-label="Serviços e valores">
            <div className="quote-closing-head" role="row"><span role="columnheader">SERVIÇO</span><span role="columnheader">QUANTIDADE</span><span role="columnheader">VALOR</span></div>
            {items.map((item) => <div className="quote-closing-row" role="row" key={item.id}><span role="cell"><b>{item.name}</b>{item.categoryName ? <small>{item.categoryName}</small> : null}</span><span role="cell">{item.quantity} × {money.format(item.totalAmountCents / item.quantity / 100)}</span><span role="cell">{money.format(item.totalAmountCents / 100)}</span></div>)}
          </div>
          <div className="quote-closing-summary">
            {discountCents > 0 ? <>
              <div><span>Subtotal</span><span>{money.format(subtotalCents / 100)}</span></div>
              <div><span>{quote.discountPercentBps ? `Desconto (${(quote.discountPercentBps / 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%)` : "Desconto"}</span><span>- {money.format(discountCents / 100)}</span></div>
            </> : null}
            <div className={discountCents > 0 ? "is-total" : "is-total is-alone"}><span>INVESTIMENTO TOTAL</span><strong>{money.format(totalCents / 100)}</strong></div>
            {quote.payments.map((payment) => <div className="is-payment" key={payment.id}><span>Pago em {shortDate.format(new Date(payment.paidAt))}</span><span>- {money.format(payment.amountCents / 100)}</span></div>)}
            {quote.payments.length ? <div className="is-balance"><span>SALDO A RECEBER</span><strong>{money.format(Math.max(0, totalCents - paidCents) / 100)}</strong></div> : null}
            {quote.paymentNotes ? <p className="quote-closing-summary-note">{quote.paymentNotes}</p> : null}
          </div>
          {quote.terms ? <><SectionHeading>Condições comerciais</SectionHeading><p className="quote-closing-terms">{quote.terms}</p></> : null}
          <div className="quote-closing-spacer" />
          <div className="quote-closing-acceptance">
            <strong>Aceite da proposta</strong>
            <p>Ao assinar, as partes declaram estar de acordo com os serviços, valores e condições descritos nesta proposta.</p>
            <p className="quote-closing-place">{place ? `${place}, ` : ""}{longDate.format(new Date(quote.signatureDate))}.</p>
            <div className="quote-closing-signatures">
              <div><i aria-hidden="true" /><b>{professional.name}</b>{professional.document ? <small>{professional.document}</small> : null}<span>PROFISSIONAL RESPONSÁVEL</span></div>
              <div><i aria-hidden="true" /><b>{quote.client.name}</b>{clientDetail ? <small>{clientDetail}</small> : null}<span>CLIENTE</span></div>
            </div>
          </div>
        </div>
        <footer className="quote-closing-footer"><span>{footer}</span><span>{pageNumber} / {pageNumber}</span></footer>
      </div>
    </article>
  </div>;
}

export type SignaturePreviewData = { id: string; code: string; title: string; client: { name: string; company: string | null; document: string | null }; signatureDate: string };

/**
 * Folha final dos documentos de texto (contrato, cessão e memorial): declaração, local e data e as assinaturas
 * das partes. Contrato e cessão incluem duas testemunhas.
 */
export function DocumentSignaturePreview({ document, professional, kind, pageNumber }: { document: SignaturePreviewData; professional: QuotePreviewProfessional; kind: DocumentKind; pageNumber: number }) {
  const info = documentKindInfo(kind);
  const closing = info.closing!;
  const place = [professional.city, professional.state].filter(Boolean).join(" / ");
  const footer = [professional.name, professional.document, websiteForDisplay(professional.website)].filter(Boolean).join(" · ").toUpperCase();
  const clientDetail = [document.client.company, document.client.document].filter(Boolean).join(" · ");
  return <div className="quote-docs-preview" id="quote-preview-closing">
    <PreviewLabel title="FOLHA FINAL" detail="Assinaturas geradas a partir do cliente e do seu perfil profissional." />
    <article className="quote-docs-page quote-docs-closing" aria-label="Folha de assinaturas">
      <div className="quote-closing-sheet">
        <div className="quote-closing-header">
          <div className="quote-closing-brand"><BrandMark className="quote-closing-logo" /><div><strong>{professional.name}</strong>{professional.professionalTitle ? <small>{professional.professionalTitle}</small> : null}</div></div>
          <span className="quote-closing-code">{document.code}</span>
        </div>
        <div className="quote-closing-intro">
          <span>{info.coverLabel}</span>
          <h3>{document.title}</h3>
        </div>
        <div className="quote-closing-body">
          <div className="quote-closing-spacer" />
          <div className="quote-closing-acceptance">
            <strong>{closing.title}</strong>
            <p>{closing.statement}</p>
            <p className="quote-closing-place">{place ? `${place}, ` : ""}{longDate.format(new Date(document.signatureDate))}.</p>
            <div className="quote-closing-signatures">
              <div><i aria-hidden="true" /><b>{professional.name}</b>{professional.document ? <small>{professional.document}</small> : null}<span>{closing.professional.role}</span></div>
              <div><i aria-hidden="true" /><b>{document.client.name}</b>{clientDetail ? <small>{clientDetail}</small> : null}<span>{closing.client.role}</span></div>
            </div>
            {closing.witnesses ? <div className="quote-closing-signatures is-witnesses">
              <div><i aria-hidden="true" /><b>Nome:</b><small>CPF:</small><span>TESTEMUNHA 1</span></div>
              <div><i aria-hidden="true" /><b>Nome:</b><small>CPF:</small><span>TESTEMUNHA 2</span></div>
            </div> : null}
          </div>
        </div>
        <footer className="quote-closing-footer"><span>{footer}</span><span>{pageNumber} / {pageNumber}</span></footer>
      </div>
    </article>
  </div>;
}
