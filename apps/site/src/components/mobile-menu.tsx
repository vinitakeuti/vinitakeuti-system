"use client";

import { useRef } from "react";

/** Menu do celular: abre sem JavaScript (details) e fecha ao escolher um link ou apertar Esc. */
export function MobileMenu({ children }: { children: React.ReactNode }) {
  const menu = useRef<HTMLDetailsElement>(null);
  const close = () => menu.current?.removeAttribute("open");
  return <details className="site-menu" ref={menu} onKeyDown={(event) => { if (event.key === "Escape") close(); }}>
    <summary aria-label="Abrir menu"><i /><i /></summary>
    <nav aria-label="Menu" onClick={(event) => { if ((event.target as HTMLElement).closest("a")) close(); }}>{children}</nav>
  </details>;
}
