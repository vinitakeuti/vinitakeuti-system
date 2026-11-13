"use client";

import { useState } from "react";
import { IconCheck } from "@/components/trafego/icons";
import { trafego } from "@/content/trafego";

/** Serviços: abas Meta Ads / Google Ads e, abaixo, o que é feito em cada plataforma. */
export function TrafficServices() {
  const { label, title, platforms } = trafego.services;
  const [selected, setSelected] = useState<string>(platforms[0].id);
  const platform = platforms.find((item) => item.id === selected) ?? platforms[0];
  return <section id="servicos" className="tf-wrap tf-section tf-services" aria-labelledby="servicos-title">
    <span className="tf-label">{label}</span>
    <h2 id="servicos-title" className="tf-title tf-services-title">{title}</h2>
    <div className="tf-segment" role="tablist" aria-label="Plataforma">
      {platforms.map((item) => <button key={item.id} type="button" role="tab" id={`plataforma-${item.id}`} aria-selected={selected === item.id} aria-controls="servicos-painel" onClick={() => setSelected(item.id)}>{item.label}</button>)}
    </div>
    <div className="tf-services-body" id="servicos-painel" role="tabpanel" aria-labelledby={`plataforma-${platform.id}`}>
      <h3>{platform.title}</h3>
      <p>{platform.text}</p>
      <ul>{platform.items.map((item) => <li key={item}><IconCheck className="tf-check" /><span>{item}</span></li>)}</ul>
    </div>
  </section>;
}
