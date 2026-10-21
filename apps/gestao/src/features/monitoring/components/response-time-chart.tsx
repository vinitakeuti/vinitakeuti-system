"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";

type Point = { checkedAt: string; responseMs: number; status: "OPERATIONAL" | "DEGRADED" | "DOWN" | "UNKNOWN" };

const HEIGHT = 190;
const PAD = { top: 14, right: 14, bottom: 26, left: 48 };
const GAP_MS = 20 * 60 * 1000;
const STEPS = [100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000, 20000];
const STATUS_LABEL = { OPERATIONAL: "Operacional", DEGRADED: "Degradado", DOWN: "Fora do ar", UNKNOWN: "Não verificado" } as const;
const time = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Maceio" });

/** Teto "redondo" do eixo e o passo das linhas de grade (0, 250, 500...). */
function niceScale(max: number) {
  const step = STEPS.find((candidate) => candidate * 4 >= max) ?? Math.ceil(max / 4 / 10_000) * 10_000;
  return { step, top: Math.max(step * Math.ceil(max / step), step) };
}

function formatMs(value: number) {
  return value >= 1000 ? `${(value / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} s` : `${value} ms`;
}

/**
 * Tempo de resposta das últimas 24 horas (uma série): linha de 2px com preenchimento leve, grade discreta,
 * pontos só nas verificações degradadas ou fora do ar e um balão ao passar o mouse.
 */
export function ResponseTimeChart({ points, now }: { points: Point[]; now: string }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [hover, setHover] = useState<number | null>(null);

  useLayoutEffect(() => {
    const element = wrapperRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.round(entry.contentRect.width))));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const end = new Date(now).getTime();
  const start = end - 24 * 60 * 60 * 1000;
  const plotWidth = width - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  // A escala vem das respostas reais; quedas (que esperam o limite de tempo) ficam como pontos no topo.
  const answered = points.filter((point) => point.status !== "DOWN");
  const { step, top } = niceScale(Math.max(...answered.map((point) => point.responseMs), 100) * 1.1);
  const x = (value: number) => PAD.left + ((value - start) / (end - start)) * plotWidth;
  const y = (value: number) => PAD.top + plotHeight - (Math.min(value, top) / top) * plotHeight;

  const geometry = useMemo(() => {
    const placed = points.map((point) => ({ ...point, time: new Date(point.checkedAt).getTime() })).map((point) => ({ ...point, px: x(point.time), py: point.status === "DOWN" ? PAD.top : y(point.responseMs) }));
    // A linha é interrompida nas quedas e onde não há verificações por mais de 20 minutos (não inventa dados).
    const segments: Array<typeof placed> = [];
    let previous: (typeof placed)[number] | null = null;
    for (const point of placed) {
      if (point.status === "DOWN") { previous = null; continue; }
      if (!previous || point.time - previous.time > GAP_MS) segments.push([point]);
      else segments.at(-1)!.push(point);
      previous = point;
    }
    const baseline = PAD.top + plotHeight;
    const line = segments.map((segment) => segment.map((point, index) => `${index ? "L" : "M"}${point.px.toFixed(1)},${point.py.toFixed(1)}`).join("")).join("");
    const area = segments.filter((segment) => segment.length > 1).map((segment) => `M${segment[0].px.toFixed(1)},${baseline}${segment.map((point) => `L${point.px.toFixed(1)},${point.py.toFixed(1)}`).join("")}L${segment.at(-1)!.px.toFixed(1)},${baseline}Z`).join("");
    return { placed, line, area };
  }, [points, width, top, start, end]);

  if (!points.length) return <p className="monitor-chart-empty">Sem verificações nas últimas 24 horas.</p>;

  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, index) => index * step);
  const hours = Array.from({ length: 5 }, (_, index) => start + index * 6 * 60 * 60 * 1000);
  const active = hover !== null ? geometry.placed[hover] : null;

  function onPointerMove(event: React.PointerEvent<SVGRectElement>) {
    const bounds = event.currentTarget.ownerSVGElement!.getBoundingClientRect();
    const pointerX = event.clientX - bounds.left;
    let nearest = 0;
    geometry.placed.forEach((point, index) => { if (Math.abs(point.px - pointerX) < Math.abs(geometry.placed[nearest].px - pointerX)) nearest = index; });
    setHover(nearest);
  }

  return <div className="monitor-chart" ref={wrapperRef}>
    <svg width={width} height={HEIGHT} role="img" aria-label={`Tempo de resposta nas últimas 24 horas: ${points.length} verificações, ${points.length - answered.length} fora do ar, resposta máxima de ${formatMs(Math.max(...answered.map((point) => point.responseMs), 0))}.`}>
      {ticks.map((tick) => <g key={tick}><line x1={PAD.left} x2={width - PAD.right} y1={y(tick)} y2={y(tick)} className="monitor-chart-grid" /><text x={PAD.left - 8} y={y(tick) + 3} textAnchor="end" className="monitor-chart-axis">{formatMs(tick)}</text></g>)}
      {hours.map((hour) => <text key={hour} x={x(hour)} y={HEIGHT - 6} textAnchor={hour === start ? "start" : hour === end ? "end" : "middle"} className="monitor-chart-axis">{time.format(new Date(hour))}</text>)}
      <path d={geometry.area} className="monitor-chart-area" />
      <path d={geometry.line} className="monitor-chart-line" />
      {geometry.placed.filter((point) => point.status === "DOWN" || point.status === "DEGRADED").map((point) => <circle key={point.checkedAt} cx={point.px} cy={point.py} r={4} className={`monitor-chart-dot is-${point.status.toLowerCase()}`} />)}
      {active ? <g><line x1={active.px} x2={active.px} y1={PAD.top} y2={PAD.top + plotHeight} className="monitor-chart-crosshair" /><circle cx={active.px} cy={active.py} r={5} className={`monitor-chart-dot is-${active.status.toLowerCase()} is-active`} /></g> : null}
      <rect x={PAD.left} y={PAD.top} width={plotWidth} height={plotHeight} fill="transparent" onPointerMove={onPointerMove} onPointerLeave={() => setHover(null)} />
    </svg>
    {active ? <div className="monitor-chart-tooltip" style={{ left: Math.min(Math.max(active.px - 80, 4), width - 164), top: Math.max(active.py - 64, 0) }}><b>{active.status === "DOWN" ? "Sem resposta" : formatMs(active.responseMs)}</b><span>{time.format(new Date(active.checkedAt))} · {STATUS_LABEL[active.status]}</span></div> : null}
  </div>;
}
