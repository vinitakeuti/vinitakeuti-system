"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Arrow, ArrowDown } from "@/components/arrow";
import { ServiceDemo, type DemoKind } from "@/components/service-demos";

export type ExplorerService = { id: string; title: string; summary: string; detail: string; demo: DemoKind; billing: string; includes: readonly string[]; href: string };
export type ExplorerCategory = { id: string; title: string; label: string; short: string; description: string; services: readonly ExplorerService[] };

const pad = (value: number) => String(value).padStart(2, "0");

/** Navegação por teclado entre abas: setas, Home e End, com foco acompanhando a seleção. */
function useTabKeys(count: number, select: (index: number) => void, refs: React.RefObject<(HTMLButtonElement | null)[]>) {
  return (event: React.KeyboardEvent, index: number) => {
    const moves: Record<string, number> = { ArrowDown: index + 1, ArrowRight: index + 1, ArrowUp: index - 1, ArrowLeft: index - 1, Home: 0, End: count - 1 };
    if (!(event.key in moves)) return;
    event.preventDefault();
    const next = (moves[event.key] + count) % count;
    select(next);
    refs.current[next]?.focus();
  };
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d={direction === "left" ? "M10 3L5 8l5 5" : "M6 3l5 5-5 5"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

/** Serviços em 3 categorias. Escolhida a categoria, a lista mostra os serviços dela e, ao lado, a demonstração do serviço ativo. */
export function ServicesExplorer({ categories }: { categories: readonly ExplorerCategory[] }) {
  const [categoryIndex, setCategoryIndex] = useState(0);
  const [serviceIndex, setServiceIndex] = useState(0);
  const [fade, setFade] = useState("");
  const categoryTabs = useRef<(HTMLButtonElement | null)[]>([]);
  const serviceTabs = useRef<(HTMLButtonElement | null)[]>([]);
  const strip = useRef<HTMLDivElement>(null);
  const category = categories[categoryIndex];
  const service = category.services[serviceIndex] ?? category.services[0];
  const count = category.services.length;

  /** Esmaece a borda da faixa de serviços quando há mais itens para aquele lado (celular). */
  const updateFade = useCallback(() => {
    const node = strip.current;
    if (!node) return;
    const start = node.scrollLeft > 4;
    const end = node.scrollLeft + node.clientWidth < node.scrollWidth - 4;
    setFade([start ? "start" : "", end ? "end" : ""].filter(Boolean).join(" "));
  }, []);
  /** O diagnóstico da abertura pede um serviço: seleciona a categoria e o serviço e rola até a seção. */
  useEffect(() => {
    function onService(event: Event) {
      const id = (event as CustomEvent<string>).detail;
      const nextCategory = categories.findIndex((item) => item.services.some((entry) => entry.id === id));
      if (nextCategory < 0) return;
      setCategoryIndex(nextCategory);
      setServiceIndex(categories[nextCategory].services.findIndex((entry) => entry.id === id));
      document.getElementById("servicos-explorer")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    window.addEventListener("site:service", onService);
    return () => window.removeEventListener("site:service", onService);
  }, [categories]);

  useEffect(() => {
    updateFade();
    window.addEventListener("resize", updateFade);
    return () => window.removeEventListener("resize", updateFade);
  }, [categoryIndex, updateFade]);

  function selectCategory(index: number) {
    setCategoryIndex(index);
    setServiceIndex(0);
  }
  function selectService(index: number) {
    setServiceIndex(index);
    serviceTabs.current[index]?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }
  const categoryKeys = useTabKeys(categories.length, selectCategory, categoryTabs);
  const serviceKeys = useTabKeys(count, selectService, serviceTabs);

  return <div className="site-explorer-wrap" id="servicos-explorer">
    <div>
      <p className="site-explorer-label" aria-hidden="true"><span>CATEGORIAS</span><i /></p>
      <div className="site-categories" role="tablist" aria-label="Categorias de serviço">
        {categories.map((item, index) => <button key={item.id} ref={(node) => { categoryTabs.current[index] = node; }} type="button" role="tab" id={`categoria-${item.id}`} aria-selected={index === categoryIndex} aria-controls="categoria-painel" tabIndex={index === categoryIndex ? 0 : -1} onClick={() => selectCategory(index)} onKeyDown={(event) => categoryKeys(event, index)}>
          <i aria-hidden="true" /><b>{item.title}</b><strong>{item.label}</strong><span>{item.services.length} {item.services.length === 1 ? "serviço" : "serviços"}</span><small>{item.description}</small>
        </button>)}
      </div>
    </div>
    <div className="site-explorer" role="tabpanel" id="categoria-painel" aria-labelledby={`categoria-${category.id}`} key={category.id}>
      <div className="site-explorer-nav">
        <div className="site-explorer-label"><span aria-hidden="true">SERVIÇOS</span><i /><em aria-hidden="true">{pad(serviceIndex + 1)} / {pad(count)}</em>
          <button type="button" aria-label="Serviço anterior" disabled={serviceIndex === 0} onClick={() => selectService(serviceIndex - 1)}><Chevron direction="left" /></button>
          <button type="button" aria-label="Próximo serviço" disabled={serviceIndex === count - 1} onClick={() => selectService(serviceIndex + 1)}><Chevron direction="right" /></button>
        </div>
        <div className="site-explorer-tabs" role="tablist" aria-label={`Serviços de ${category.title}`} ref={strip} data-fade={fade} onScroll={updateFade}>
          {category.services.map((item, index) => <button key={item.id} ref={(node) => { serviceTabs.current[index] = node; }} type="button" role="tab" id={`servico-${item.id}`} aria-selected={item.id === service.id} aria-controls="servico-painel" tabIndex={item.id === service.id ? 0 : -1} style={{ "--i": index } as React.CSSProperties} onClick={() => selectService(index)} onKeyDown={(event) => serviceKeys(event, index)}>
            <span>{pad(index + 1)}</span><b>{item.title}</b><small>{item.billing}</small>
          </button>)}
        </div>
      </div>
      <div className="site-explorer-panel" role="tabpanel" id="servico-painel" aria-labelledby={`servico-${service.id}`} key={service.id}>
        <div className="site-explorer-head">
          <div><p className="site-tag">{category.short} · {service.billing.toUpperCase()}</p><h3>{service.title}</h3><p>{service.summary} {service.detail}</p></div>
          <div className="site-explorer-price"><small>Orçamento sem compromisso</small><div><a className="site-button" href={service.href}>Solicitar orçamento<Arrow /></a><a className="site-button is-ghost" href="#servico-demo">Ver demonstração<ArrowDown /></a></div></div>
        </div>
        <div className="site-explorer-demo" id="servico-demo">
          <ServiceDemo kind={service.demo} />
        </div>
        <ul className="site-explorer-includes" aria-label="O que inclui">{service.includes.map((item) => <li key={item}>{item}</li>)}</ul>
      </div>
    </div>
  </div>;
}
