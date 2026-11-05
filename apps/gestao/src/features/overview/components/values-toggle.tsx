"use client";

import { useState } from "react";

export const VALUES_COOKIE = "vr-valores";

/**
 * Olho que oculta e mostra os valores em dinheiro da tela. A escolha fica num cookie (só preferência de interface),
 * para a página já abrir no estado escolhido, sem mostrar os valores por um instante antes de esconder.
 */
export function ValuesToggle({ initialHidden, targetId }: { initialHidden: boolean; targetId: string }) {
  const [hidden, setHidden] = useState(initialHidden);

  function toggle() {
    const next = !hidden;
    setHidden(next);
    document.getElementById(targetId)?.setAttribute("data-values", next ? "hidden" : "visible");
    document.cookie = `${VALUES_COOKIE}=${next ? "ocultos" : "visiveis"}; path=/; max-age=31536000; samesite=lax`;
  }

  const label = hidden ? "Mostrar valores" : "Ocultar valores";
  return <button className="values-toggle" type="button" onClick={toggle} aria-pressed={hidden} aria-label={label} title={label}>
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M1.8 10S4.8 4.5 10 4.5 18.2 10 18.2 10 15.2 15.5 10 15.5 1.8 10 1.8 10Z" />
      <circle cx="10" cy="10" r="2.6" />
      {hidden ? <path d="M3.5 16.5 16.5 3.5" /> : null}
    </svg>
  </button>;
}
