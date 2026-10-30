"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Menu (celular na home; barra lateral no portfólio). O painel fica sempre no documento e só muda de estado,
 * para abrir e fechar com transição. Fecha ao escolher um link, apertar Esc ou tocar fora dele.
 */
export function MobileMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);

  return <div className={open ? "site-menu is-open" : "site-menu"} ref={root}>
    <button type="button" className="site-menu-toggle" aria-expanded={open} aria-controls="site-menu-panel" aria-label={open ? "Fechar menu" : "Abrir menu"} onClick={() => setOpen((value) => !value)}><i /><i /></button>
    <div className="site-menu-backdrop" aria-hidden="true" onPointerDown={() => setOpen(false)} />
    <nav id="site-menu-panel" aria-label="Menu" inert={!open} onClick={(event) => { if ((event.target as HTMLElement).closest("a")) setOpen(false); }}>{children}</nav>
  </div>;
}
