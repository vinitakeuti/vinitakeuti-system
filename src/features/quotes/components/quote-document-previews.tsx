import Link from "next/link";
import type { ReactNode } from "react";
import { BRAND_MARK_PATHS, BRAND_MARK_TRANSFORM, BRAND_MARK_VIEWBOX, coverTitleLayout, pointsToCoverCqw } from "@/features/quotes/types/brand-mark";

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

/** Réplica somente leitura da capa do PDF, em medidas proporcionais à largura da página. */
export function QuoteCoverPreview({ quote, professional }: { quote: QuotePreviewData; professional: QuotePreviewProfessional }) {
  const website = websiteForDisplay(professional.website);
  const titleLayout = coverTitleLayout(quote.title);
  return <div className="quote-docs-preview" id="quote-preview-cover">
    <article className="quote-docs-page quote-docs-cover" aria-label="Capa da proposta">
      <div className="quote-cover-sheet">
        <BrandMark className="quote-cover-mark" />
        <div className="quote-cover-brand"><BrandMark className="quote-cover-logo" /><div><strong>{professional.name}</strong>{professional.professionalTitle ? <small>{professional.professionalTitle}</small> : null}</div></div>
        <div className="quote-cover-headline" style={{ top: pointsToCoverCqw(titleLayout.top) }}>
          <span className="quote-cover-kicker">{quote.code} / {yearOf.format(new Date(quote.issuedAt))}</span>
          <span className="quote-cover-label">PROPOSTA COMERCIAL</span>
          <h2 style={{ maxWidth: pointsToCoverCqw(titleLayout.maxWidth), fontSize: pointsToCoverCqw(titleLayout.fontSize) }}>{quote.title}</h2>
        </div>
        <dl className="quote-cover-details">
          <div><dt>CLIENTE</dt><dd>{quote.client.name}</dd></div>
          <div><dt>EMPRESA</dt><dd>{quote.client.company ?? "Não informado"}</dd></div>
          <div><dt>PROPOSTA</dt><dd>{quote.code}</dd></div>
          <div><dt>VALIDADE</dt><dd>{quote.validUntil ? longDate.format(new Date(quote.validUntil)) : "Conforme proposta"}</dd></div>
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
  const place = [professional.city, professional.state].filter(Boolean).join(" / ") || "Local";
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
            <p className="quote-closing-place">{place}, ______ de ____________________ de __________.</p>
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
