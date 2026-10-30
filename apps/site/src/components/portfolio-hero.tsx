"use client";

import { useRef } from "react";

/** Traços do logo VR (mesmos de public/logo-vr.svg), no sistema de coordenadas original. */
const MARK = ["M316 233H451L817 678L659 829L316 415Z", "M595 212L1021 213L1151 357V617L928 361H716Z", "M804 428H899L1156 738V825H994L735 499Z"];
const TOP = 192;
const BOTTOM = 849;
const RUN = ((BOTTOM - TOP) * 501) / 445; // mesma inclinação das hastes do logo

/** Linhas paralelas na inclinação do logo cobrindo todo o desenho; cada forma recorta as suas. */
const HATCH = Array.from({ length: Math.ceil((1176 - 296 + RUN) / 13) }, (_, index) => {
  const x = 296 - RUN + index * 13;
  return `M${x.toFixed(1)} ${TOP}L${(x + RUN).toFixed(1)} ${BOTTOM}`;
});
/** Profundidade de cada forma no parallax (px por unidade de deslocamento do ponteiro). */
const DEPTH = [26, 14, 38];

/**
 * Abertura do portfólio: o logo VR enorme, desenhado em hachura (as linhas se desenham ao abrir), com as três formas
 * em profundidades diferentes seguindo o ponteiro; sem ponteiro, flutuam devagar. O nome fica por cima, em tipografia editorial.
 */
export function PortfolioHero({ eyebrow, name }: { eyebrow: string; name: string }) {
  const hero = useRef<HTMLElement>(null);
  const frame = useRef(0);
  const [first, ...rest] = name.split(" ");

  function move(event: React.PointerEvent) {
    if (event.pointerType !== "mouse" || !hero.current) return;
    const box = hero.current.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width - 0.5) * 2;
    const y = ((event.clientY - box.top) / box.height - 0.5) * 2;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      hero.current?.style.setProperty("--mx", x.toFixed(3));
      hero.current?.style.setProperty("--my", y.toFixed(3));
    });
  }

  return <section className="pf-hero" ref={hero} aria-label="Apresentação" onPointerMove={move} onPointerLeave={() => { hero.current?.style.setProperty("--mx", "0"); hero.current?.style.setProperty("--my", "0"); }}>
    <svg className="pf-mark" viewBox="0 0 880 657" aria-hidden="true">
      <defs>{MARK.map((d, index) => <clipPath key={d} id={`pf-mark-${index}`}><path d={d} /></clipPath>)}</defs>
      <g transform="translate(-296 -192)">
        {MARK.map((d, shape) => <g key={d} className="pf-mark-float" style={{ "--i": shape } as React.CSSProperties}>
          <g className={`pf-mark-layer is-${shape}`} style={{ "--depth": DEPTH[shape] } as React.CSSProperties}>
            <path className="pf-mark-outline" d={d} pathLength={1} />
            <g clipPath={`url(#pf-mark-${shape})`}>{HATCH.map((line, index) => <path key={line} d={line} pathLength={1} style={{ "--d": shape * 260 + index * 7 } as React.CSSProperties} />)}</g>
          </g>
        </g>)}
      </g>
    </svg>
    <div className="pf-hero-top"><p className="site-tag">{eyebrow}</p></div>
    <h1 className="pf-hero-name"><span>{first}</span><span>{rest.join(" ")}</span></h1>
    <div className="pf-hero-bottom">
      <a className="pf-scroll" href="#trajetoria"><span>CONHEÇA</span><i aria-hidden="true" /></a>
    </div>
  </section>;
}
