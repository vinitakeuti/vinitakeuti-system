"use client";

import { useEffect, useId, useRef, useState } from "react";

export type QuoteDiscountMode = "fixed" | "percent";

export type QuoteSummaryDiscount = {
  mode: QuoteDiscountMode;
  draft: string;
  amountCents: number;
  effectivePercentBps: number;
  disabled: boolean;
  onModeChange: (mode: QuoteDiscountMode) => void;
  onDraftChange: (value: string) => void;
  onCommit: () => void;
};

type Props = {
  serviceCount: number;
  oneTimeCents: number;
  recurringCents: number;
  totalCents: number;
  discount: QuoteSummaryDiscount;
};

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const COMPACT_QUERY = "(max-width: 1279px)";
const TOP_GAP = 24;

function percentText(bps: number) {
  return (bps / 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

/**
 * Resumo do orçamento. A partir de 1280px: caixa fixa no alto da coluna livre à direita, aberta por padrão.
 * Começa alinhada ao topo do conteúdo (abaixo do cabeçalho da página) e, ao rolar, fica presa a 24px do topo da tela.
 * Abaixo disso: barra fixa no rodapé, fechada por padrão. O botão inverte o padrão da tela atual.
 */
export function QuoteSummaryPanel({ serviceCount, oneTimeCents, recurringCents, totalCents, discount }: Props) {
  const detailsId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const [isCompact, setIsCompact] = useState(false);
  const [expanded, setExpanded] = useState<boolean | null>(null);

  useEffect(() => {
    const query = window.matchMedia(COMPACT_QUERY);
    const sync = () => setIsCompact(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const panel = panelRef.current;
    const pageRoot = panel?.closest(".directory-page");
    const anchor = pageRoot?.querySelector<HTMLElement>(":scope > :not(.directory-header)");
    if (!panel || !anchor) return;
    let frame = 0;
    const place = () => {
      frame = 0;
      panel.style.setProperty("--quote-summary-top", `${Math.max(TOP_GAP, Math.round(anchor.getBoundingClientRect().top))}px`);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(place); };
    place();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => { window.removeEventListener("scroll", schedule); window.removeEventListener("resize", schedule); cancelAnimationFrame(frame); };
  }, []);

  const detailsVisible = expanded ?? !isCompact;
  const stateClass = expanded === null ? "" : expanded ? " is-expanded" : " is-collapsed";

  return <aside ref={panelRef} className={`quote-summary-panel${stateClass}`} aria-label="Resumo do orçamento">
    <div className="quote-summary-panel-head">
      <div><span>RESUMO DO ORÇAMENTO</span><small>{serviceCount} {serviceCount === 1 ? "serviço selecionado" : "serviços selecionados"}</small></div>
      <button className="quote-summary-panel-toggle" type="button" aria-expanded={detailsVisible} aria-controls={detailsId} onClick={() => setExpanded(!detailsVisible)}>{detailsVisible ? "OCULTAR" : "DETALHES"}</button>
    </div>
    <dl className="quote-summary-panel-details" id={detailsId}>
      <div><dt>Implantação e avulsos</dt><dd>{money.format(oneTimeCents / 100)}</dd></div>
      <div><dt>Recorrências</dt><dd>{money.format(recurringCents / 100)}</dd></div>
      <div className="quote-summary-panel-discount">
        <dt><label htmlFor="quote-discount">Desconto</label></dt>
        <dd>
          <div className="quote-summary-panel-mode" role="group" aria-label="Tipo de desconto">
            <button type="button" aria-pressed={discount.mode === "fixed"} disabled={discount.disabled} onClick={() => discount.onModeChange("fixed")}>R$</button>
            <button type="button" aria-pressed={discount.mode === "percent"} disabled={discount.disabled} onClick={() => discount.onModeChange("percent")}>%</button>
          </div>
          <input id="quote-discount" type="number" min="0" max={discount.mode === "percent" ? "100" : undefined} step="0.01" inputMode="decimal" value={discount.draft} disabled={discount.disabled} onChange={(event) => discount.onDraftChange(event.target.value)} onBlur={discount.onCommit} aria-label={discount.mode === "percent" ? "Desconto em porcentagem" : "Desconto em reais"} />
        </dd>
      </div>
      {discount.amountCents > 0 ? <div className="quote-summary-panel-equivalent"><dt>Equivale a</dt><dd>{discount.mode === "percent" ? `- ${money.format(discount.amountCents / 100)}` : `${percentText(discount.effectivePercentBps)}% do subtotal`}</dd></div> : null}
    </dl>
    <div className="quote-summary-panel-total"><span>TOTAL DA PROPOSTA</span><strong>{money.format(totalCents / 100)}</strong></div>
  </aside>;
}
