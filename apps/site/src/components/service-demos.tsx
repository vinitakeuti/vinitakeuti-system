"use client";

import { useEffect, useRef, useState } from "react";
import { seeded } from "@/lib/seeded";

/**
 * Demonstrações interativas de cada serviço. São ilustrações (marcadas como EXEMPLO), com dados fictícios,
 * para mostrar na prática o que o cliente recebe. Nada aqui chama APIs.
 */
export type DemoKind = "software" | "payment" | "report" | "ads" | "funnel" | "tracking" | "landing" | "server";


const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function ServiceDemo({ kind }: { kind: DemoKind }) {
  const labels: Record<DemoKind, string> = { software: "app.suaempresa.com.br", payment: "checkout · cobrança #1042", landing: "suaempresa.com.br", server: "servidor · painel", report: "parecer-tecnico.pdf", ads: "campanhas · resultados", funnel: "funil · do anúncio à venda", tracking: "eventos · tempo real" };
  return <div className={`site-demo is-${kind}`}>
    <div className="site-demo-bar"><span className="site-console-dots" aria-hidden="true"><i /><i /><i /></span><span>{labels[kind]}</span><small>EXEMPLO</small></div>
    <div className="site-demo-body">
      {kind === "software" ? <SoftwareDemo /> : null}
      {kind === "payment" ? <PaymentDemo /> : null}
      {kind === "ads" ? <AdsDemo /> : null}
      {kind === "funnel" ? <FunnelDemo /> : null}
      {kind === "tracking" ? <TrackingDemo /> : null}
      {kind === "landing" ? <LandingDemo /> : null}
      {kind === "server" ? <ServerDemo /> : null}
      {kind === "report" ? <ReportDemo /> : null}
    </div>
  </div>;
}

/* Software personalizado: um sistema de gestão com módulos clicáveis. */
type Tone = "ok" | "wait" | "muted";
const MODULES: { name: string; summary: string; rows: [string, string, Tone][] }[] = [
  { name: "Clientes", summary: "4 clientes ativos", rows: [["Ana Ribeiro · Plano de treino", "Ativo", "ok"], ["Juliana e Pedro · Casamento", "Ativo", "ok"], ["Família Souza · Reforma", "Ativo", "ok"], ["Carlos Mendes · Compra de imóvel", "Em proposta", "wait"]] },
  { name: "Propostas", summary: "2 aguardando resposta", rows: [["Educação física · Plano de treino trimestral", "Aprovada", "ok"], ["Fotografia · Ensaio de casamento", "Enviada", "wait"], ["Construtora · Reforma de cozinha", "Em negociação", "wait"], ["Corretor · Apartamento de 3 quartos", "Rascunho", "muted"]] },
  { name: "Contratos", summary: "1 aguardando assinatura", rows: [["Educação física · Plano de treino trimestral", "Assinado", "ok"], ["Fotografia · Ensaio de casamento", "Aguardando assinatura", "wait"], ["Construtora · Obra residencial", "Encerrado", "muted"]] },
  { name: "Financeiro", summary: "R$ 12.480,00 a receber no mês", rows: [["Parcela 2/4 · Reforma de cozinha", "Paga", "ok"], ["Sinal · Ensaio de casamento", "Vence em 3 dias", "wait"], ["Mensalidade · Plano de treino", "Recorrente", "muted"]] },
];

function SoftwareDemo() {
  const [active, setActive] = useState(0);
  const module = MODULES[active];
  return <div className="site-demo-app">
    <nav aria-label="Módulos do exemplo">{MODULES.map((item, index) => <button key={item.name} type="button" aria-pressed={index === active} onClick={() => setActive(index)}>{item.name}</button>)}</nav>
    <div className="site-demo-app-main" key={module.name}>
      <div className="site-demo-app-head"><div><b>{module.name}</b><small>{module.summary}</small></div><span>+ Novo</span></div>
      <ul>{module.rows.map(([label, status, tone], index) => <li key={label} style={{ animationDelay: `${index * 60}ms` }}><span>{label}</span><em className={`is-${tone}`}>{status}</em></li>)}</ul>
    </div>
  </div>;
}

/* Gateway de pagamento: escolher o meio, simular o pagamento e ver o webhook confirmar sozinho. */
type Method = "pix" | "card" | "boleto";
const METHODS: { id: Method; label: string }[] = [{ id: "pix", label: "Pix" }, { id: "card", label: "Cartão" }, { id: "boleto", label: "Boleto" }];
const METHOD_EVENT: Record<Method, string> = { pix: "PAYMENT_RECEIVED", card: "PAYMENT_CONFIRMED", boleto: "PAYMENT_RECEIVED" };

function QrCode() {
  const size = 25;
  const next = seeded(42);
  const finder = (x: number, y: number) => [[0, 0], [size - 7, 0], [0, size - 7]].some(([fx, fy]) => x >= fx && x < fx + 7 && y >= fy && y < fy + 7);
  const cells: [number, number][] = [];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!finder(x, y) && next() < 0.48) cells.push([x, y]);
  return <svg viewBox={`-1 -1 ${size + 2} ${size + 2}`} shapeRendering="crispEdges" aria-hidden="true">
    {cells.map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" />)}
    {[[0, 0], [size - 7, 0], [0, size - 7]].map(([x, y]) => <g key={`${x}-${y}`}><rect x={x + 0.5} y={y + 0.5} width="6" height="6" fill="none" stroke="currentColor" /><rect x={x + 2} y={y + 2} width="3" height="3" /></g>)}
  </svg>;
}

function Barcode() {
  const next = seeded(9);
  const bars: [number, number][] = [];
  for (let x = 0; x < 196;) { const width = 1 + Math.floor(next() * 3); bars.push([x, width]); x += width + 1 + Math.floor(next() * 2); }
  return <svg viewBox="0 0 200 44" preserveAspectRatio="none" aria-hidden="true">{bars.map(([x, width]) => <rect key={x} x={x} y="0" width={width} height="44" />)}</svg>;
}

function PaymentDemo() {
  const [method, setMethod] = useState<Method>("pix");
  const [stage, setStage] = useState(0);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  function choose(next: Method) { timers.current.forEach(window.clearTimeout); setMethod(next); setStage(0); }
  function simulate() {
    timers.current.forEach(window.clearTimeout);
    const step = reducedMotion() ? 0 : 650;
    setStage(1);
    timers.current = [2, 3, 4, 5].map((value, index) => window.setTimeout(() => setStage(value), step * (index + 1)));
  }

  const status = stage === 0 ? "Aguardando pagamento" : stage < 3 ? "Processando" : "Pago";
  const finished = stage === 5;
  const log = [
    "cobrança criada · R$ 249,90 · vence 10/11",
    stage >= 2 ? `cliente pagou via ${METHODS.find((item) => item.id === method)!.label}` : null,
    stage >= 3 ? `webhook ${METHOD_EVENT[method]} · 200 OK` : null,
    stage >= 4 ? "parcela 1/3 marcada como paga no sistema" : null,
  ].filter(Boolean) as string[];

  return <div className="site-demo-pay">
    <div className="site-demo-pay-checkout">
      <div className="site-demo-segment" role="group" aria-label="Meio de pagamento">{METHODS.map((item) => <button key={item.id} type="button" aria-pressed={item.id === method} onClick={() => choose(item.id)}>{item.label}</button>)}</div>
      <div className="site-demo-pay-method" key={method}>
        {method === "pix" ? <><QrCode /><small>Pix copia e cola · 00020126...5204</small></> : null}
        {method === "card" ? <div className="site-demo-card"><span>Número do cartão</span><b>•••• •••• •••• 4242</b><div><span>Validade<b>12/29</b></span><span>Parcelas<b>3x sem juros</b></span></div></div> : null}
        {method === "boleto" ? <><Barcode /><small>34191.79001 01043.510047 91020.150008 1 10420000024990</small></> : null}
      </div>
      <div className="site-demo-pay-foot"><div><small>Total</small><b>R$ 249,90</b></div><button type="button" className="site-button" onClick={simulate} disabled={stage > 0 && !finished}>{finished ? "Simular de novo" : "Simular pagamento"}</button></div>
    </div>
    <div className="site-demo-pay-log">
      <p className={`site-demo-status is-${stage >= 4 ? "ok" : stage > 0 ? "wait" : "muted"}`} aria-live="polite"><i />{status}</p>
      <ol>{log.map((line) => <li key={line}>{line}</li>)}</ol>
      {finished ? <p className="site-demo-ok" role="status"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" pathLength={1} /><path d="M7.5 12.4l3 3 6-6.4" pathLength={1} /></svg>Cliente em dia</p> : null}
      <small>Confirmação automática: o pagamento é confirmado diretamente pelo seu banco.</small>
    </div>
  </div>;
}

/* Tráfego pago: resultados por plataforma e período, com leads por dia e as campanhas ativas. */
type Platform = "google" | "meta";
const PLATFORMS: Record<Platform, { label: string; seed: number; spend: number; cpc: number; leads: number; campaigns: [string, string, Tone][] }> = {
  google: { label: "Google Ads", seed: 11, spend: 48, cpc: 1.9, leads: 3.4, campaigns: [["Pesquisa · seu serviço + cidade", "Ativa", "ok"], ["Pesquisa · nome da empresa", "Ativa", "ok"], ["Remarketing · visitantes", "Em aprendizado", "wait"]] },
  meta: { label: "Meta Ads", seed: 23, spend: 39, cpc: 0.8, leads: 4.1, campaigns: [["Instagram · cadastro", "Ativa", "ok"], ["Facebook · público semelhante", "Ativa", "ok"], ["Stories · remarketing", "Pausada", "muted"]] },
};
/** Formatação fixa (sem Intl) para o texto ser idêntico no servidor e no navegador. */
const thousands = (text: string) => text.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const money = (value: number) => `R$ ${thousands(value.toFixed(2).replace(".", ","))}`;

function AdsDemo() {
  const [platform, setPlatform] = useState<Platform>("google");
  const [days, setDays] = useState<7 | 30>(30);
  const config = PLATFORMS[platform];
  const next = seeded(config.seed + days);
  const series = Array.from({ length: days }, () => Math.max(1, Math.round(config.leads * (0.55 + next() * 0.9))));
  const leads = series.reduce((sum, value) => sum + value, 0);
  const spend = config.spend * days * (0.92 + next() * 0.16);
  const clicks = Math.round(spend / config.cpc);
  const peak = Math.max(...series);
  const kpis = [["Investimento", money(spend)], ["Cliques", thousands(String(clicks))], ["Leads", String(leads)], ["Custo por lead", money(spend / leads)]];
  return <div className="site-demo-ads">
    <div className="site-demo-ads-controls">
      <div className="site-demo-segment" role="group" aria-label="Plataforma">{(Object.keys(PLATFORMS) as Platform[]).map((item) => <button key={item} type="button" aria-pressed={platform === item} onClick={() => setPlatform(item)}>{PLATFORMS[item].label}</button>)}</div>
      <div className="site-demo-segment" role="group" aria-label="Período">{([7, 30] as const).map((item) => <button key={item} type="button" aria-pressed={days === item} onClick={() => setDays(item)}>{item} dias</button>)}</div>
    </div>
    <dl className="site-demo-kpis">{kpis.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <div className="site-demo-bars" aria-hidden="true"><small>Leads por dia</small><p>{series.map((value, index) => <i key={index} style={{ height: `${(value / peak) * 100}%` }} />)}</p></div>
    <ul className="site-demo-campaigns">{config.campaigns.map(([name, status, tone]) => <li key={name}><span>{name}</span><em className={`is-${tone}`}>{status}</em></li>)}</ul>
  </div>;
}

/**
 * Funil de vendas: as etapas com quantas pessoas passam por cada uma, antes e depois de otimizar.
 * shape é a largura da barra (%) no cenário "Antes"; depois de otimizar, cada barra cresce na mesma proporção do ganho da etapa.
 */
const FUNNEL: { label: string; text: string; before: number; after: number; shape: number }[] = [
  { label: "Anúncio", text: "Público e criativos testados para atrair quem tem interesse real.", before: 10000, after: 10000, shape: 100 },
  { label: "Página", text: "Página rápida, com uma oferta clara e um único próximo passo.", before: 820, after: 1140, shape: 38 },
  { label: "Cadastro", text: "Formulário curto ou WhatsApp para captar o contato.", before: 96, after: 188, shape: 22 },
  { label: "Conversa", text: "Mensagens automáticas de acompanhamento até o atendimento.", before: 41, after: 94, shape: 15 },
  { label: "Venda", text: "Cada venda volta para o relatório e orienta as próximas campanhas.", before: 9, after: 23, shape: 9 },
];
const percent = (value: number) => `${(value * 100).toFixed(1).replace(".", ",")}%`;

function FunnelDemo() {
  const [optimized, setOptimized] = useState(false);
  const [active, setActive] = useState(2);
  const values = FUNNEL.map((stage) => optimized ? stage.after : stage.before);
  const stage = FUNNEL[active];
  return <div className="site-demo-funnel">
    <div className="site-demo-segment" role="group" aria-label="Cenário">{[false, true].map((item) => <button key={String(item)} type="button" aria-pressed={optimized === item} onClick={() => setOptimized(item)}>{item ? "Depois de otimizar" : "Antes"}</button>)}</div>
    <ol>{FUNNEL.map((item, index) => <li key={item.label}>
      <button type="button" aria-pressed={active === index} onClick={() => setActive(index)}>
        <span>{item.label}</span>
        <i><b style={{ width: `${Math.min(100, item.shape * (values[index] / item.before))}%` }} /></i>
        <em>{thousands(String(values[index]))}</em>
        <small>{index === 0 ? "alcance" : percent(values[index] / values[index - 1])}</small>
      </button>
    </li>)}</ol>
    <div className="site-demo-funnel-detail" key={`${active}-${optimized}`}><b>{stage.label}</b><p>{stage.text}</p><span>{optimized ? `${FUNNEL[4].before} vendas viraram ${FUNNEL[4].after} com o mesmo alcance.` : "Toque em uma etapa para ver o que é feito nela."}</span></div>
  </div>;
}

/* Traqueamento: uma visita disparando eventos, cada um enviado ao GA4 e aos outros apps, até a conversão atribuída à origem. */
type Source = "google" | "meta" | "organic";
const SOURCES: Record<Source, { label: string; utm: string; campaign: string }> = {
  google: { label: "Google Ads", utm: "google / cpc", campaign: "pesquisa-servico" },
  meta: { label: "Meta Ads", utm: "meta / paid", campaign: "instagram-cadastro" },
  organic: { label: "Orgânico", utm: "google / organic", campaign: "sem campanha" },
};
const DESTINATIONS = ["GA4", "Meta", "CRM"] as const;
const EVENTS: { name: string; params: string; to: (typeof DESTINATIONS)[number][] }[] = [
  { name: "page_view", params: "página: /", to: ["GA4", "Meta"] },
  { name: "scroll", params: "rolagem: 75%", to: ["GA4"] },
  { name: "click_cta", params: "botão: Fale conosco", to: ["GA4", "Meta"] },
  { name: "generate_lead", params: "canal: whatsapp", to: ["GA4", "Meta", "CRM"] },
  { name: "purchase", params: "valor: R$ 249,90", to: ["GA4", "Meta", "CRM"] },
];

function TrackingDemo() {
  const [source, setSource] = useState<Source>("google");
  const [fired, setFired] = useState(0);
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);
  const running = fired > 0 && fired < EVENTS.length;

  function choose(next: Source) { timers.current.forEach(window.clearTimeout); setSource(next); setFired(0); }
  function simulate() {
    timers.current.forEach(window.clearTimeout);
    const step = reducedMotion() ? 0 : 600;
    setFired(1);
    timers.current = EVENTS.slice(1).map((_, index) => window.setTimeout(() => setFired(index + 2), step * (index + 1)));
  }

  const origin = SOURCES[source];
  return <div className="site-demo-tracking">
    <div className="site-demo-tracking-controls">
      <div className="site-demo-segment" role="group" aria-label="Origem da visita">{(Object.keys(SOURCES) as Source[]).map((item) => <button key={item} type="button" aria-pressed={source === item} onClick={() => choose(item)}>{SOURCES[item].label}</button>)}</div>
      <button type="button" className="site-button" onClick={simulate} disabled={running}>{fired === EVENTS.length ? "Simular de novo" : "Simular visita"}</button>
    </div>
    <p className="site-demo-tracking-origin">utm_source / medium: <b>{origin.utm}</b> · campanha: <b>{origin.campaign}</b></p>
    <ol>{EVENTS.map((event, index) => {
      const done = index < fired;
      return <li key={event.name} className={done ? "is-fired" : undefined}>
        <span>{done ? `00:0${index * 2}` : "--:--"}</span>
        <div><b>{event.name}</b><small>{event.params}</small></div>
        <p>{DESTINATIONS.map((destination) => <em key={destination} className={done && event.to.includes(destination) ? "is-on" : undefined}>{destination}</em>)}</p>
      </li>;
    })}</ol>
    <p className={fired === EVENTS.length ? "site-demo-tracking-result is-visible" : "site-demo-tracking-result"} aria-live="polite">{fired === EVENTS.length ? `Venda atribuída a ${origin.label} · ${origin.campaign}` : "Escolha a origem e simule uma visita."}</p>
  </div>;
}

/* Landing page: a mesma página no computador e no celular. */
function LandingDemo() {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  return <div className="site-demo-landing">
    <div className="site-demo-segment" role="group" aria-label="Dispositivo">{(["desktop", "mobile"] as const).map((item) => <button key={item} type="button" aria-pressed={device === item} onClick={() => setDevice(item)}>{item === "desktop" ? "Computador" : "Celular"}</button>)}</div>
    <div className="site-demo-stage">
      <div className={`site-demo-page is-${device}`}>
        <div className="site-demo-page-nav"><i /><span /><span /><span /><b /></div>
        <div className="site-demo-page-hero"><span className="is-tag" /><span className="is-title" /><span className="is-title is-short" /><span className="is-text" /><b>Fale conosco</b></div>
        <div className="site-demo-page-grid"><span /><span /><span /></div>
        <div className="site-demo-page-cta"><span /><b>WhatsApp</b></div>
      </div>
    </div>
  </div>;
}

/* Servidor: métricas que oscilam como num painel real, disponibilidade dos últimos 30 dias e eventos. */
function ServerDemo() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (reducedMotion()) return;
    const timer = window.setInterval(() => setTick((value) => value + 1), 1400);
    return () => window.clearInterval(timer);
  }, []);
  const wave = (t: number, base: number, amplitude: number, phase: number) => Math.round(base + amplitude * Math.sin(t * 0.9 + phase) + amplitude * 0.5 * Math.sin(t * 2.3 + phase * 2));
  const history = Array.from({ length: 28 }, (_, index) => wave(tick - 27 + index, 24, 9, 0));
  const points = history.map((value, index) => `${(index / 27) * 100},${40 - (value / 50) * 40}`).join(" ");
  const metrics = [["CPU", `${history[27]}%`, history[27]], ["Memória", `${wave(tick, 58, 4, 1)}%`, wave(tick, 58, 4, 1)], ["Disco", "31%", 31]] as const;
  return <div className="site-demo-server">
    <div className="site-demo-server-chart">
      <div><small>CPU · tempo real</small><b>{history[27]}%</b></div>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true"><polyline points={points} /></svg>
    </div>
    <ul className="site-demo-meters">{metrics.map(([label, value, percent]) => <li key={label}><span>{label}</span><i><b style={{ width: `${percent}%` }} /></i><em>{value}</em></li>)}</ul>
    <div className="site-demo-uptime"><div><small>Disponibilidade · 30 dias</small><b>99,9%</b></div><p aria-hidden="true">{Array.from({ length: 30 }, (_, index) => <i key={index} className={index === 17 ? "is-slow" : undefined} />)}</p></div>
    <ol className="site-demo-events">
      <li><span>agora</span>verificação HTTPS · 200 OK · {140 + (tick % 5) * 9} ms</li>
      <li><span>2 h</span>atualização publicada · versão 1.4.2</li>
      <li><span>12 d</span>certificado HTTPS renovado</li>
    </ol>
  </div>;
}

/* Parecer técnico: o documento sendo analisado item a item até a conclusão. */
const REPORT_ITEMS: [string, string, "ok" | "warn"][] = [
  ["Funcionamento", "Fluxos principais executados e comparados ao esperado", "ok"],
  ["Qualidade", "Código, arquitetura e segurança", "warn"],
  ["Conformidade", "O que foi contratado frente ao que foi entregue", "ok"],
  ["Capacidade", "Desempenho e limites de uso do sistema", "ok"],
];

function ReportDemo() {
  const [step, setStep] = useState(0);
  const [run, setRun] = useState(0);
  useEffect(() => {
    if (reducedMotion()) { setStep(REPORT_ITEMS.length + 1); return; }
    setStep(0);
    const timer = window.setInterval(() => setStep((value) => { if (value > REPORT_ITEMS.length) { window.clearInterval(timer); return value; } return value + 1; }), 750);
    return () => window.clearInterval(timer);
  }, [run]);
  const done = step > REPORT_ITEMS.length;
  return <div className="site-demo-report">
    <div className={done ? "site-demo-paper" : "site-demo-paper is-scanning"}>
      <header><small>PARECER TÉCNICO Nº 014/2026</small><b>Análise do sistema de gestão</b><span>Objeto: plataforma web · versão 2.3</span></header>
      <ol>{REPORT_ITEMS.map(([title, text, result], index) => {
        const state = step > index + 1 || done ? result : step === index + 1 ? "running" : "pending";
        return <li key={title} className={`is-${state}`}><div><b>{index + 1}. {title}</b><span>{text}</span></div><em>{state === "ok" ? "Conforme" : state === "warn" ? "Com ressalvas" : state === "running" ? "Analisando" : "Pendente"}</em></li>;
      })}</ol>
      <footer className={done ? "is-visible" : undefined}><span>Conclusão: sistema funcional, com ressalvas de qualidade descritas no item 2.</span><i /><small>Vinicius Riudi · Desenvolvedor de software</small></footer>
    </div>
    <button type="button" className="site-button is-ghost" onClick={() => setRun((value) => value + 1)} disabled={!done}>{done ? "Refazer análise" : "Analisando..."}</button>
  </div>;
}
