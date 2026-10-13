"use client";

import { useEffect, useMemo, useState } from "react";
import { QUOTE_TOTAL_CHANGE_EVENT } from "@/features/quotes/types/quote-events";
import { QuoteSummaryPanel, type QuoteDiscountMode } from "@/features/quotes/components/quote-summary-panel";

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
function lineFormula(service: { pricingMethod: PricingMethod; quantity: number; pricingRateCents: number }) {
  const rate = money.format(service.pricingRateCents / 100);
  if (service.pricingMethod === "HOURLY") return `${service.quantity} ${service.quantity === 1 ? "hora" : "horas"} × ${rate}`;
  if (service.pricingMethod === "DAILY") return `${service.quantity} ${service.quantity === 1 ? "dia" : "dias"} × ${rate}`;
  return `${service.quantity} ${service.quantity === 1 ? "unidade" : "unidades"} × ${rate}`;
}
function catalogAmount(service: CatalogService) { if (!service.defaultAmountCents) return "A DEFINIR"; const suffix = service.pricingMethod === "HOURLY" ? " / H" : service.pricingMethod === "DAILY" ? " / DIA" : ""; return `${money.format(service.defaultAmountCents / 100)}${suffix}`; }

type DiscountMode = QuoteDiscountMode;


export function QuoteServicePicker({ initialServices = [], initialDiscountCents = 0, initialDiscountPercentBps = null }: { initialServices?: InitialService[]; initialDiscountCents?: number; initialDiscountPercentBps?: number | null }) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<CatalogService[]>([]);
  const [selected, setSelected] = useState<SelectedService[]>(() => initialServices.map((service) => ({ ...service, defaultAmountCents: service.pricingRateCents })));
  const [discountMode, setDiscountMode] = useState<DiscountMode>(initialDiscountPercentBps !== null ? "percent" : "fixed");
  const [fixedDiscountCents, setFixedDiscountCents] = useState(initialDiscountPercentBps !== null ? 0 : initialDiscountCents);
  const [discountPercentBps, setDiscountPercentBps] = useState(initialDiscountPercentBps ?? 0);
  const [discountDraft, setDiscountDraft] = useState(() => initialDiscountPercentBps !== null ? String(initialDiscountPercentBps / 100) : (initialDiscountCents / 100).toFixed(2));
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
  const safeDiscountCents = discountMode === "percent" ? Math.round((subtotalCents * discountPercentBps) / 10_000) : Math.min(fixedDiscountCents, subtotalCents);
  const effectivePercentBps = subtotalCents ? Math.round((safeDiscountCents / subtotalCents) * 10_000) : 0;
  const totalCents = subtotalCents - safeDiscountCents;

  useEffect(() => { window.dispatchEvent(new CustomEvent(QUOTE_TOTAL_CHANGE_EVENT, { detail: totalCents })); }, [totalCents]);
  function add(service: CatalogService) { setSelected((items) => [...items, { ...service, quantity: 1, pricingRateCents: service.defaultAmountCents }]); setQuery(""); setIsOpen(false); }
  function update(id: string, patch: Partial<Pick<SelectedService, "pricingMethod" | "quantity" | "pricingRateCents">>) { setSelected((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item)); }
  function updateQuantity(id: string, value: string) { setQuantityDrafts((drafts) => ({ ...drafts, [id]: value })); if (!value.trim()) return; const numeric = Number(value); if (!Number.isFinite(numeric) || numeric < 1) return; update(id, { quantity: Math.max(1, Math.min(10_000, Math.round(numeric))) }); }
  function commitQuantity(service: SelectedService) { const draft = quantityDrafts[service.id]; if (draft === undefined) return; const numeric = Number(draft); const quantity = Number.isFinite(numeric) && numeric >= 1 ? Math.max(1, Math.min(10_000, Math.round(numeric))) : service.quantity; update(service.id, { quantity }); setQuantityDrafts((drafts) => ({ ...drafts, [service.id]: String(quantity) })); }
  function updateRate(id: string, value: string) { setRateDrafts((drafts) => ({ ...drafts, [id]: value })); if (!value.trim()) return; const numeric = Number(value.replace(",", ".")); if (!Number.isFinite(numeric) || numeric < 0) return; update(id, { pricingRateCents: Math.round(numeric * 100) }); }
  function commitRate(service: SelectedService) { const draft = rateDrafts[service.id]; if (draft === undefined) return; const numeric = Number(draft.replace(",", ".")); const rateCents = Number.isFinite(numeric) && numeric >= 0 ? Math.round(numeric * 100) : service.pricingRateCents; update(service.id, { pricingRateCents: rateCents }); setRateDrafts((drafts) => ({ ...drafts, [service.id]: (rateCents / 100).toFixed(2) })); }
  function updateDiscount(value: string) {
    setDiscountDraft(value);
    const numeric = Number(value.replace(",", "."));
    if (!value.trim() || !Number.isFinite(numeric)) return;
    if (discountMode === "percent") setDiscountPercentBps(Math.max(0, Math.min(10_000, Math.round(numeric * 100))));
    else setFixedDiscountCents(Math.max(0, Math.round(numeric * 100)));
  }
  function commitDiscount() {
    if (discountMode === "percent") setDiscountDraft(String(discountPercentBps / 100));
    else { setFixedDiscountCents(safeDiscountCents); setDiscountDraft((safeDiscountCents / 100).toFixed(2)); }
  }
  /** Ao trocar o tipo, o desconto atual é convertido para a nova unidade, sem mudar o total. */
  function switchDiscountMode(mode: DiscountMode) {
    if (mode === discountMode) return;
    if (mode === "percent") { setDiscountPercentBps(effectivePercentBps); setDiscountDraft(String(effectivePercentBps / 100)); }
    else { setFixedDiscountCents(safeDiscountCents); setDiscountDraft((safeDiscountCents / 100).toFixed(2)); }
    setDiscountMode(mode);
  }

  return <div className="quote-service-picker" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false); }}>
    <div className="quote-service-search"><label htmlFor="quote-service-query">BUSCAR E ADICIONAR SERVIÇO <em>OBRIGATÓRIO</em></label><input id="quote-service-query" value={query} onChange={(event) => setQuery(event.target.value)} onFocus={() => setIsOpen(true)} placeholder="Clique aqui e pesquise: landing page, cloud ou tráfego" autoComplete="off" aria-describedby="quote-service-help" /><small id="quote-service-help">O catálogo sugere a regra de preço. Você pode ajustá-la somente nesta proposta.</small></div>
    {isOpen ? <div className="quote-service-results">{isLoading ? <p>Buscando serviços...</p> : available.length ? available.map((service) => <button type="button" key={service.id} onClick={() => add(service)}><span><b>{service.name}</b><small>{service.category.name} · {billingLabel[service.billingType]} · {pricingLabel[service.pricingMethod]}</small></span><div><strong>{catalogAmount(service)}</strong><em>ADICIONAR</em></div></button>) : <p>{query ? "Nenhum serviço encontrado. Tente outro termo ou cadastre-o em Serviços." : "Todos os serviços sugeridos já foram adicionados."}</p>}</div> : null}
    <div className="quote-selected-services quote-pricing-lines" aria-live="polite">{selected.length ? selected.map((service) => {
      const itemTotal = service.quantity * service.pricingRateCents;
      const cycle = service.billingType === "RECURRING" ? ` · ${cycleLabel[service.billingCycle ?? "MONTHLY"] ?? service.billingCycle ?? "mensal"}` : "";
      return <div className="quote-line" key={service.id}>
        <input type="hidden" name="serviceId" value={service.id} />
        <div className="quote-line-head">
          <div className="quote-line-title"><b>{service.name}</b><small>{service.category.name} · {billingLabel[service.billingType]}{cycle}</small></div>
          <button className="quote-line-remove" type="button" aria-label={`Remover ${service.name} da proposta`} onClick={() => setSelected((items) => items.filter((item) => item.id !== service.id))}>REMOVER</button>
        </div>
        <div className="quote-line-fields">
          <label className="quote-line-rule">REGRA<select name="servicePricingMethod" value={service.pricingMethod} onChange={(event) => update(service.id, { pricingMethod: event.target.value as PricingMethod })}>{Object.entries(pricingLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>{quantityLabel(service.pricingMethod)}<input name="serviceQuantity" type="number" min="1" max="10000" inputMode="numeric" value={quantityDrafts[service.id] ?? String(service.quantity)} onChange={(event) => updateQuantity(service.id, event.target.value)} onBlur={() => commitQuantity(service)} /></label>
          <label>{rateLabel(service.pricingMethod)}<input name="serviceRate" type="number" min="0" step="0.01" inputMode="decimal" value={rateDrafts[service.id] ?? (service.pricingRateCents / 100).toFixed(2)} onChange={(event) => updateRate(service.id, event.target.value)} onBlur={() => commitRate(service)} /></label>
        </div>
        <p className="quote-line-hint">{pricingHint(service.pricingMethod)}</p>
        <div className="quote-line-total"><div><span>SUBTOTAL</span><small>{lineFormula(service)}</small></div><strong>{money.format(itemTotal / 100)}</strong></div>
      </div>;
    }) : <div className="quote-items-empty"><b>Nenhum serviço adicionado.</b><span>Selecione no catálogo ao menos um serviço para montar a proposta.</span></div>}</div>
    <QuoteSummaryPanel serviceCount={selected.length} oneTimeCents={oneTimeCents} recurringCents={recurringCents} totalCents={totalCents} discount={{ mode: discountMode, draft: discountDraft, amountCents: safeDiscountCents, effectivePercentBps, disabled: subtotalCents === 0, onModeChange: switchDiscountMode, onDraftChange: updateDiscount, onCommit: commitDiscount }} />
    <input type="hidden" name="discountType" value={discountMode} />
    <input type="hidden" name="discountAmount" value={(safeDiscountCents / 100).toFixed(2)} />
    <input type="hidden" name="discountPercent" value={discountMode === "percent" ? String(discountPercentBps / 100) : ""} />
    <input type="hidden" name="amount" value={(totalCents / 100).toFixed(2)} />
  </div>;
}
