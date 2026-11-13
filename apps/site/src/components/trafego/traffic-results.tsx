"use client";

import { useEffect, useRef, useState } from "react";
import { IconArrowRight, IconChevron } from "@/components/trafego/icons";
import { trafego, type TrafficArea, type TrafficCase } from "@/content/trafego";

/** Formatação fixa (sem Intl), para o texto ser idêntico no servidor e no navegador. */
const thousands = (text: string) => text.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const money = (value: number) => {
  const [whole, cents] = value.toFixed(2).split(".");
  return `R$ ${thousands(whole)},${cents}`;
};
const count = (value: number) => thousands(String(Math.round(value)));

/**
 * Resultados: abas por área e um carrossel com os casos (retorno, investido e faturado, métricas do relatório).
 * Áreas sem caso detalhado mostram os números gerais, com o da área escolhida primeiro e em destaque.
 * O título entra palavra por palavra quando a seção aparece; sem JavaScript ou com movimento reduzido, já aparece pronto.
 * As setas e a dica de deslizar só aparecem quando os cartões não cabem na largura (no computador, eles preenchem a linha).
 */
export function TrafficResults() {
  const { label, title, text, swipe, areas, cases, stats } = trafego.results;
  const [area, setArea] = useState<TrafficArea>("eventos");
  const [ready, setReady] = useState(false);
  const [seen, setSeen] = useState(false);
  const [scrollable, setScrollable] = useState(false);
  const section = useRef<HTMLElement>(null);
  const row = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setReady(true);
    const node = section.current;
    if (!node || !("IntersectionObserver" in window)) { setSeen(true); return; }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { setSeen(true); observer.disconnect(); }
    }, { threshold: 0.25 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Mede se a linha de cartões transborda: ao abrir, ao trocar de área e quando a largura muda.
  useEffect(() => {
    const node = row.current;
    if (!node) return;
    const measure = () => setScrollable(node.scrollWidth > node.clientWidth + 1);
    measure();
    if (!("ResizeObserver" in window)) return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [area]);

  function choose(next: TrafficArea) {
    setArea(next);
    row.current?.scrollTo({ left: 0, behavior: "smooth" });
  }

  const inArea = cases.filter((item) => item.area === area);
  const focus = area === "mkt" ? "mkt" : "produtos";
  const ordered = [...stats.filter((item) => item.id === focus), ...stats.filter((item) => item.id !== focus)];

  return <section id="resultados" ref={section} className={`tf-results${ready ? " is-ready" : ""}${seen ? " is-seen" : ""}`} aria-labelledby="resultados-title">
    <div className="tf-wrap tf-results-head">
      <div className="tf-heading">
        <span className="tf-label">{label}</span>
        <h2 id="resultados-title" aria-label={title.join(" ")}>{title.map((word, index) => <span key={word} className={index === title.length - 1 ? "tf-word is-accent" : "tf-word"} aria-hidden="true" style={{ transitionDelay: `${index * 0.12}s` }}>{word}</span>)}</h2>
        <p className="tf-results-sub">{text}</p>
      </div>
      <div className="tf-results-bar">
        <div className="tf-tabs tf-hscroll" role="tablist" aria-label="Área">
          {areas.map((item) => <button key={item.id} type="button" role="tab" id={`area-${item.id}`} aria-selected={area === item.id} aria-controls="resultados-lista" onClick={() => choose(item.id)}>{item.label}</button>)}
        </div>
        {scrollable ? <div className="tf-results-arrows">
          <button type="button" className="tf-arrow" aria-label="Anterior" onClick={() => row.current?.scrollBy({ left: -340, behavior: "smooth" })}><IconChevron direction="left" /></button>
          <button type="button" className="tf-arrow is-solid" aria-label="Próximo" onClick={() => row.current?.scrollBy({ left: 340, behavior: "smooth" })}><IconChevron direction="right" /></button>
        </div> : null}
      </div>
    </div>

    <div className="tf-results-row tf-hscroll" id="resultados-lista" role="tabpanel" aria-labelledby={`area-${area}`} ref={row}>
      {inArea.length ? inArea.map((item, index) => <CaseCard key={`${item.area}-${index}`} item={item} />) : ordered.map((item) => {
        const highlight = item.id === focus;
        return <article key={item.id} className={highlight ? "tf-stat is-highlight" : "tf-stat"}>
          <span className="tf-stat-value">{item.value}</span>
          <span className="tf-stat-label">{item.label}</span>
        </article>;
      })}
    </div>
    {scrollable ? <p className="tf-wrap tf-swipe"><IconArrowRight size={16} width={2} />{swipe}</p> : null}
  </section>;
}

function CaseCard({ item }: { item: TrafficCase }) {
  const metrics: [string, string][] = [
    ["Vendas", count(item.sales)],
    ["Custo por venda", money(item.costPerSale)],
    ["Alcance", `${count(item.reach)} pessoas`],
    ["Impressões", count(item.impressions)],
    [item.clicksLabel, `${count(item.clicks)} (CTR ${item.ctr})`],
    ["CPC / CPM", `${money(item.cpc)} / ${money(item.cpm)}`],
    ["Seguidores no início", count(item.followers)],
  ];
  return <article className="tf-case">
    <span className="tf-case-days">{item.days} dias de divulgação</span>
    <div>
      <strong className="tf-case-title">{item.title}</strong>
      <p className="tf-case-roas"><span>{item.roas.toFixed(1).replace(".", ",")}x</span>de retorno</p>
    </div>
    <div className="tf-case-flow">
      <div><small>Investido</small><strong>{money(item.invested)}</strong></div>
      <IconArrowRight className="tf-case-flow-arrow" />
      <div className="is-dark"><small>Faturado</small><strong>{money(item.revenue)}</strong></div>
    </div>
    <dl className="tf-case-metrics">{metrics.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl>
  </article>;
}
