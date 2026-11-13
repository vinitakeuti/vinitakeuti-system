"use client";

import { useState } from "react";
import { trafego } from "@/content/trafego";

/** Perguntas frequentes: uma aberta por vez (a primeira começa aberta); tocar na aberta fecha. */
export function TrafficFaq() {
  const { title, items } = trafego.faq;
  const [open, setOpen] = useState(0);
  return <section id="duvidas" className="tf-section tf-faq" aria-labelledby="duvidas-title">
    <h2 id="duvidas-title" className="tf-title">{title}</h2>
    <div className="tf-faq-list">
      {items.map((item, index) => {
        const isOpen = open === index;
        return <div key={item.question} className={isOpen ? "tf-faq-item is-open" : "tf-faq-item"}>
          <button type="button" id={`duvida-${index}`} aria-expanded={isOpen} aria-controls={`duvida-resposta-${index}`} onClick={() => setOpen(isOpen ? -1 : index)}>
            <span>{item.question}</span><i aria-hidden="true" />
          </button>
          <p id={`duvida-resposta-${index}`} role="region" aria-labelledby={`duvida-${index}`} hidden={!isOpen}>{item.answer}</p>
        </div>;
      })}
    </div>
  </section>;
}
