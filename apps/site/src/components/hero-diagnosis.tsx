"use client";

import { useEffect, useRef, useState } from "react";
import { Arrow } from "@/components/arrow";

export type HeroNeed = { id: string; label: string; diagnosis: string; services: { id: string; title: string; category: string }[]; href: string };

const pad = (value: number) => String(value).padStart(2, "0");

/** Pede à seção de serviços que mostre um serviço (ela escuta este evento, seleciona e rola até lá). */
export function openService(id: string) {
  window.dispatchEvent(new CustomEvent("site:service", { detail: id }));
}

/**
 * Terminal da abertura: o visitante escolhe o que precisa resolver e a resposta aparece linha a linha,
 * com o diagnóstico, o caminho sugerido (serviços clicáveis) e o convite para conversar.
 */
export function HeroDiagnosis({ question, needs, host }: { question: string; needs: readonly HeroNeed[]; host: string }) {
  const [active, setActive] = useState<number | null>(null);
  const [shown, setShown] = useState(0);
  const output = useRef<HTMLDivElement>(null);
  const need = active === null ? null : needs[active];
  const lines = need ? 3 + need.services.length : 0;

  useEffect(() => {
    if (active === null) return;
    if (window.innerWidth < 760) output.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setShown(lines); return; }
    setShown(0);
    const timer = window.setInterval(() => setShown((value) => {
      if (value >= lines) { window.clearInterval(timer); return value; }
      return value + 1;
    }), 320);
    return () => window.clearInterval(timer);
  }, [active, lines]);

  return <figure className="site-console site-diagnosis" aria-label="Diagnóstico: escolha o que você precisa resolver">
    <div className="site-console-bar" aria-hidden="true"><span className="site-console-dots"><i /><i /><i /></span><span>{host}</span><small>DIAGNÓSTICO</small></div>
    <div className="site-diagnosis-body">
      <div className="site-diagnosis-ask">
        <p className="site-console-line"><b>$</b>diagnostico</p>
        <p className="site-console-line site-diagnosis-question" style={{ "--i": 1 } as React.CSSProperties}>{question}</p>
        <div className="site-diagnosis-options" role="group" aria-label={question}>
          {needs.map((item, index) => <button key={item.id} type="button" className="site-console-line" aria-pressed={active === index} style={{ "--i": index + 2 } as React.CSSProperties} onClick={() => setActive(index)}>
            <span>{index + 1}</span>{item.label}<Arrow />
          </button>)}
        </div>
      </div>
      <div className="site-diagnosis-output" ref={output} aria-live="polite">
        {need ? <div key={need.id}>
          {shown > 0 ? <p className="site-diagnosis-echo">&gt; {need.label.toLowerCase()}</p> : null}
          {shown > 1 ? <div className="site-diagnosis-block"><small>DIAGNÓSTICO</small><p>{need.diagnosis}</p></div> : null}
          {shown > 2 ? <div className="site-diagnosis-block"><small>CAMINHO SUGERIDO</small>
            <ol>{need.services.map((service, index) => shown > 2 + index ? <li key={service.id}><button type="button" onClick={() => openService(service.id)}><span>{pad(index + 1)}</span><b>{service.title}</b><em>{service.category}</em><Arrow /></button></li> : null)}</ol>
          </div> : null}
          {shown >= lines ? <div className="site-diagnosis-actions"><a className="site-button" href={need.href}>Conversar sobre isso<Arrow /></a><p><b>$</b><span className="site-cursor" /></p></div> : null}
        </div> : <p className="site-diagnosis-idle"><b>$</b>escolha uma opção<span className="site-cursor" /></p>}
      </div>
    </div>
  </figure>;
}
