"use client";

import { useEffect, useMemo, useState } from "react";

type PricingMethod = "FIXED" | "HOURLY" | "DAILY" | "CUSTOM";
type BillingType = "ONE_TIME" | "RECURRING";
type CatalogService = { id: string; name: string; billingType: BillingType; pricingMethod: PricingMethod; defaultAmountCents: number; billingCycle: string | null; category: { name: string } };
type SelectedService = CatalogService & { quantity: number; pricingRateCents: number };
type InitialService = Pick<CatalogService, "id" | "name" | "billingType" | "pricingMethod" | "billingCycle" | "category"> & { quantity: number; pricingRateCents: number };

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const billingLabel: Record<BillingType, string> = { ONE_TIME: "Avulso", RECURRING: "Recorrente" };
const pricingLabel: Record<PricingMethod, string> = { FIXED: "Valor fechado", HOURLY: "Por hora", DAILY: "Por dia", CUSTOM: "Definir no orçamento" };
const cycleLabel: Record<string, string> = { MONTHLY: "mensal", QUARTERLY: "trimestral", SEMIANNUAL: "semestral", YEARLY: "anual" };

function quantityLabel(method: PricingMethod) { return method === "HOURLY" ? "HORAS" : method === "DAILY" ? "DIAS" : "QTD."; }
function rateLabel(method: PricingMethod) { return method === "HOURLY" ? "TAXA POR HORA (R$)" : method === "DAILY" ? "TAXA POR DIA (R$)" : method === "FIXED" ? "VALOR FECHADO (R$)" : "VALOR DEFINIDO AGORA (R$)"; }
function pricingHint(method: PricingMethod) { return method === "HOURLY" ? "Defina as horas previstas nesta proposta. Total = horas × taxa por hora." : method === "DAILY" ? "Defina os dias previstos nesta proposta. Total = dias × taxa por dia." : method === "FIXED" ? "O valor fechado do catálogo foi aplicado como ponto de partida." : "Defina o valor e a quantidade para esta proposta."; }
function catalogAmount(service: CatalogService) { if (!service.defaultAmountCents) return "A DEFINIR"; const suffix = service.pricingMethod === "HOURLY" ? " / H" : service.pricingMethod === "DAILY" ? " / DIA" : ""; return `${money.format(service.defaultAmountCents / 100)}${suffix}`; }

export function QuoteServicePicker({ initialServices = [], initialDiscountCents = 0 }: { initialServices?: InitialService[]; initialDiscountCents?: number }) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<CatalogService[]>([]);
  const [selected, setSelected] = useState<SelectedService[]>(() => initialServices.map((service) => ({ ...service, defaultAmountCents: service.pricingRateCents })));
  const [discountCents, setDiscountCents] = useState(initialDiscountCents);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>({});
  const [rateDrafts, setRateDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/servicos/catalogo?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        if (!response.ok) return;
        const payload = await response.json() as { data: CatalogService[] };
        setResults(payload.data);
      } catch { if (!controller.signal.aborted) setResults([]); }
      finally { if (!controller.signal.aborted) setIsLoading(false); }
    }, 180);
    return () => { controller.abort(); window.clearTimeout(timeout); };
  }, [isOpen, query]);

  const available = useMemo(() => results.filter((service) => !selected.some((item) => item.id === service.id)), [results, selected]);
  const oneTimeCents = selected.filter((service) => service.billingType === "ONE_TIME").reduce((total, service) => total + service.quantity * service.pricingRateCents, 0);
  const recurringCents = selected.filter((service) => service.billingType === "RECURRING").reduce((total, service) => total + service.quantity * service.pricingRateCents, 0);
  const subtotalCents = oneTimeCents + recurringCents;
  const safeDiscountCents = Math.min(discountCents, subtotalCents);
  const totalCents = subtotalCents - safeDiscountCents;

  useEffect(() => setDiscountCents((current) => Math.min(current, subtotalCents)), [subtotalCents]);
  function add(service: CatalogService) { setSelected((items) => [...items, { ...service, quantity: 1, pricingRateCents: service.defaultAmountCents }]); setQuery(""); setIsOpen(false); }
  function update(id: string, patch: Partial<Pick<SelectedService, "pricingMethod" | "quantity" | "pricingRateCents">>) { setSelected((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item)); }
  function updateQuantity(id: string, value: string) { setQuantityDrafts((drafts) => ({ ...drafts, [id]: value })); if (!value.trim()) return; const numeric = Number(value); if (!Number.isFinite(numeric) || numeric < 1) return; update(id, { quantity: Math.max(1, Math.min(10_000, Math.round(numeric))) }); }
  function commitQuantity(service: SelectedService) { const draft = quantityDrafts[service.id]; if (draft === undefined) return; const numeric = Number(draft); const quantity = Number.isFinite(numeric) && numeric >= 1 ? Math.max(1, Math.min(10_000, Math.round(numeric))) : service.quantity; update(service.id, { quantity }); setQuantityDrafts((drafts) => ({ ...drafts, [service.id]: String(quantity) })); }
  function updateRate(id: string, value: string) { setRateDrafts((drafts) => ({ ...drafts, [id]: value })); if (!value.trim()) return; const numeric = Number(value.replace(",", ".")); if (!Number.isFinite(numeric) || numeric < 0) return; update(id, { pricingRateCents: Math.round(numeric * 100) }); }
  function commitRate(service: SelectedService) { const draft = rateDrafts[service.id]; if (draft === undefined) return; const numeric = Number(draft.replace(",", ".")); const rateCents = Number.isFinite(numeric) && numeric >= 0 ? Math.round(numeric * 100) : service.pricingRateCents; update(service.id, { pricingRateCents: rateCents }); setRateDrafts((drafts) => ({ ...drafts, [service.id]: (rateCents / 100).toFixed(2) })); }
  function updateDiscount(value: string) { const numeric = Number(value.replace(",", ".")); if (!Number.isFinite(numeric)) return; setDiscountCents(Math.max(0, Math.min(subtotalCents, Math.round(numeric * 100)))); }

  return <div className="quote-service-picker" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false); }}>
    <div className="quote-service-search"><label htmlFor="quote-service-query">BUSCAR E ADICIONAR SERVIÇO <em>OBRIGATÓRIO</em></label><input id="quote-service-query" value={query} onChange={(event) => setQuery(event.target.value)} onFocus={() => setIsOpen(true)} placeholder="Clique aqui e pesquise: landing page, cloud ou tráfego" autoComplete="off" aria-describedby="quote-service-help" /><small id="quote-service-help">O catálogo sugere a regra de preço. Você pode ajustá-la somente nesta proposta.</small></div>
    {isOpen ? <div className="quote-service-results">{isLoading ? <p>Buscando serviços...</p> : available.length ? available.map((service) => <button type="button" key={service.id} onClick={() => add(service)}><span><b>{service.name}</b><small>{service.category.name} · {billingLabel[service.billingType]} · {pricingLabel[service.pricingMethod]}</small></span><div><strong>{catalogAmount(service)}</strong><em>ADICIONAR</em></div></button>) : <p>{query ? "Nenhum serviço encontrado. Tente outro termo ou cadastre-o em Serviços." : "Todos os serviços sugeridos já foram adicionados."}</p>}</div> : null}
    <div className="quote-selected-services quote-pricing-lines" aria-live="polite">{selected.length ? selected.map((service) => {
      const itemTotal = service.quantity * service.pricingRateCents;
      const cycle = service.billingType === "RECURRING" ? ` · ${cycleLabel[service.billingCycle ?? "MONTHLY"] ?? service.billingCycle ?? "mensal"}` : "";
      return <div className="quote-selected-service" key={service.id}><div><input type="hidden" name="serviceId" value={service.id} /><b>{service.name}</b><small>{service.category.name} · {billingLabel[service.billingType]}{cycle}</small><small className="quote-service-pricing-hint">{pricingHint(service.pricingMethod)}</small></div><label>REGRA<select name="servicePricingMethod" value={service.pricingMethod} onChange={(event) => update(service.id, { pricingMethod: event.target.value as PricingMethod })}>{Object.entries(pricingLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>{quantityLabel(service.pricingMethod)}<input name="serviceQuantity" type="number" min="1" max="10000" value={quantityDrafts[service.id] ?? String(service.quantity)} onChange={(event) => updateQuantity(service.id, event.target.value)} onBlur={() => commitQuantity(service)} /></label><label>{rateLabel(service.pricingMethod)}<input name="serviceRate" type="number" min="0" step="0.01" value={rateDrafts[service.id] ?? (service.pricingRateCents / 100).toFixed(2)} onChange={(event) => updateRate(service.id, event.target.value)} onBlur={() => commitRate(service)} /></label><strong>{money.format(itemTotal / 100)}</strong><button className="quote-remove-service" type="button" onClick={() => setSelected((items) => items.filter((item) => item.id !== service.id))}>REMOVER</button></div>;
    }) : <div className="quote-items-empty"><b>Nenhum serviço adicionado.</b><span>Selecione no catálogo ao menos um serviço para montar a proposta.</span></div>}</div>
    <div className={`quote-items-total${isSummaryOpen ? " is-summary-open" : ""}`} aria-live="polite"><div className="quote-summary-heading"><span>RESUMO DO ORÇAMENTO</span><small>{selected.length} {selected.length === 1 ? "serviço selecionado" : "serviços selecionados"}</small></div><button className="quote-summary-toggle" type="button" aria-expanded={isSummaryOpen} aria-controls="quote-summary-details" onClick={() => setIsSummaryOpen((open) => !open)}>{isSummaryOpen ? "FECHAR" : "VER RESUMO"}</button><dl className="quote-summary-lines" id="quote-summary-details"><div><dt>Implantação e avulsos</dt><dd>{money.format(oneTimeCents / 100)}</dd></div><div><dt>Recorrências</dt><dd>{money.format(recurringCents / 100)}</dd></div><div><dt><label htmlFor="quote-discount">Desconto</label></dt><dd><input id="quote-discount" name="discountAmount" type="number" min="0" max={(subtotalCents / 100).toFixed(2)} step="0.01" inputMode="decimal" value={(safeDiscountCents / 100).toFixed(2)} onChange={(event) => updateDiscount(event.target.value)} disabled={subtotalCents === 0} aria-label="Desconto em reais" /></dd></div></dl><div className="quote-summary-total"><span>TOTAL DA PROPOSTA</span><strong>{money.format(totalCents / 100)}</strong></div><input type="hidden" name="amount" value={(totalCents / 100).toFixed(2)} /></div>
  </div>;
}
