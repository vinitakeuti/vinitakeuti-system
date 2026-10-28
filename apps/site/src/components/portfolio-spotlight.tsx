"use client";

import { useRef, useState } from "react";

/**
 * Nome em tipografia enorme, apagado, revelado por um "holofote" que segue o ponteiro.
 * Sem ponteiro (celular) ou parado, o holofote passeia sozinho pelo nome (animação em CSS).
 */
export function PortfolioSpotlight({ name }: { name: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [tracking, setTracking] = useState(false);

  function move(event: React.PointerEvent) {
    if (event.pointerType !== "mouse" || !box.current) return;
    const rect = box.current.getBoundingClientRect();
    box.current.style.setProperty("--x", `${event.clientX - rect.left}px`);
    box.current.style.setProperty("--y", `${event.clientY - rect.top}px`);
    if (!tracking) setTracking(true);
  }

  return <div className={tracking ? "pf-spot is-tracking" : "pf-spot"} ref={box} onPointerMove={move} onPointerLeave={() => setTracking(false)}>
    <h1>{name}</h1>
    <span className="pf-spot-light" aria-hidden="true">{name}</span>
  </div>;
}
