"use client";

import { useEffect, useRef, useState } from "react";

export type InspectorLayer = { layer: string; tech: readonly string[]; note: string };
export type InspectorMedia = { label: string; src?: string; alt: string; screen: "dashboard" | "site" | "portal" | "landing" };

const pad = (value: number) => String(value).padStart(2, "0");

/** Tela ilustrativa desenhada em CSS, usada enquanto o projeto não tem imagem ou vídeo próprio. */
function ScreenMock({ screen }: { screen: InspectorMedia["screen"] }) {
  const blocks = { dashboard: 14, site: 9, portal: 11, landing: 8 }[screen];
  return <div className={`pf-screen is-${screen}`} aria-hidden="true">{Array.from({ length: blocks }, (_, index) => <i key={index} />)}</div>;
}

/** Imagem, GIF ou vídeo servido direto de public/portfolio (sem o otimizador do Next, para aceitar qualquer formato). */
function MediaFile({ src, alt }: { src: string; alt: string }) {
  if (/\.(mp4|webm)$/i.test(src)) return <video className="pf-media" src={src} aria-label={alt} autoPlay muted loop playsInline preload="metadata" />;
  return <img className="pf-media" src={src} alt={alt} loading="lazy" />;
}

function Screen({ media }: { media: InspectorMedia }) {
  return media.src ? <MediaFile src={media.src} alt={media.alt} /> : <ScreenMock screen={media.screen} />;
}

/**
 * Raio-x do projeto: a tela fica por cima e, ao arrastar a alça para a direita (ou usar "Inspecionar"), a planta da arquitetura
 * se abre a partir da esquerda,
 * com cada camada, suas tecnologias e uma nota. Ao entrar na tela pela primeira vez, a alça dá uma "espiada" sozinha.
 */
/**
 * Com mais de uma tela (ex.: gestão, loja e landing page), a barra da janela ganha abas para alternar entre elas.
 * Com `architectureMedia`, o raio-x revela essa imagem ou vídeo no lugar da planta montada a partir das camadas.
 */
export function ProjectInspector({ title, host, media, architecture, architectureMedia, ratio }: { title: string; host: string; media: readonly InspectorMedia[]; architecture: readonly InspectorLayer[]; architectureMedia?: { src: string; alt: string }; ratio?: string }) {
  const [position, setPosition] = useState(0); // quanto da planta está aberto, em %
  const [dragging, setDragging] = useState(false);
  const [active, setActive] = useState(0);
  const [screen, setScreen] = useState(0);
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = stage.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setPosition((value) => value === 0 ? 42 : value);
      observer.disconnect();
    }, { threshold: 0.6 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  function follow(event: React.PointerEvent) {
    const box = stage.current?.getBoundingClientRect();
    if (!box) return;
    setPosition(Math.min(100, Math.max(0, ((event.clientX - box.left) / box.width) * 100)));
  }

  function onKeyDown(event: React.KeyboardEvent) {
    const steps: Record<string, number> = { ArrowLeft: -5, ArrowDown: -5, ArrowRight: 5, ArrowUp: 5 };
    if (event.key === "Home" || event.key === "End") { event.preventDefault(); setPosition(event.key === "Home" ? 0 : 100); return; }
    if (!(event.key in steps)) return;
    event.preventDefault();
    setPosition((value) => Math.min(100, Math.max(0, value + steps[event.key])));
  }

  const inspecting = position > 50;
  // Proporção como número (ex.: "1 / 1" -> 1), usada no CSS para a janela caber inteira na altura da tela.
  const [ratioWidth, ratioHeight] = (ratio ?? "16 / 10").split("/").map(Number);
  return <div className="pf-inspector" style={{ "--ratio": ratioWidth / ratioHeight } as React.CSSProperties}>
    <div className="pf-inspector-bar">
      <span className="site-console-dots" aria-hidden="true"><i /><i /><i /></span>
      {media.length > 1
        ? <span className="pf-inspector-tabs" role="tablist" aria-label={`Telas de ${title}`}>{media.map((item, index) => <button key={item.label} type="button" role="tab" aria-selected={screen === index} onClick={() => { setScreen(index); setPosition(0); }}>{item.label}</button>)}</span>
        : <span>{host}</span>}
      <button type="button" aria-pressed={inspecting} onClick={() => setPosition(inspecting ? 0 : 100)}>{inspecting ? "Ver a tela" : "Inspecionar"}</button>
    </div>
    <div className={dragging ? "pf-inspector-stage is-dragging" : "pf-inspector-stage"} ref={stage} style={{ "--pos": `${position}%`, ...(ratio ? { aspectRatio: ratio } : {}) } as React.CSSProperties}>
      <div className="pf-inspector-screen" key={screen}><Screen media={media[screen]} /></div>
      {architectureMedia ? <div className="pf-blueprint is-media">
        <MediaFile src={architectureMedia.src} alt={architectureMedia.alt} />
        <ol className="sr-only" aria-label={`Arquitetura de ${title}`}>{architecture.map((item) => <li key={item.layer}>{item.layer}: {item.tech.join(", ")}. {item.note}</li>)}</ol>
      </div> : <div className="pf-blueprint" aria-label={`Arquitetura de ${title}`}>
        <p className="pf-blueprint-title">ARQUITETURA · {title.toUpperCase()}</p>
        {/* Focar uma camada pelo teclado abre a planta, para o foco nunca ficar escondido sob a tela. */}
        <ol onFocus={() => setPosition((value) => value < 50 ? 100 : value)}>{architecture.map((item, index) => <li key={item.layer}>
          <button type="button" aria-pressed={active === index} onMouseEnter={() => setActive(index)} onFocus={() => setActive(index)} onClick={() => setActive(index)}>
            <span>{pad(index + 1)}</span><b>{item.layer}</b><em>{item.tech.join(" · ")}</em>
          </button>
        </li>)}</ol>
        <p className="pf-blueprint-note" aria-live="polite">{architecture[active].note}</p>
      </div>}
      <div className="pf-inspector-handle" role="slider" tabIndex={0} aria-label="Arraste para inspecionar a arquitetura" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(position)}
        onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setDragging(true); follow(event); }}
        onPointerMove={(event) => { if (dragging) follow(event); }}
        onPointerUp={() => setDragging(false)} onPointerCancel={() => setDragging(false)} onKeyDown={onKeyDown}>
        <span aria-hidden="true"><svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 4L2 8l4 4M10 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
      </div>
    </div>
  </div>;
}
