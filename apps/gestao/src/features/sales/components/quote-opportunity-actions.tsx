"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";

type QuoteAction = (formData: FormData) => void | Promise<void>;
/** Item do menu: a ação do servidor, a pergunta de confirmação e se é destrutiva. */
export type QuoteMenuItem = { label: string; action: QuoteAction; confirm: string; danger?: boolean };

export function QuoteOpportunityActions({ quoteId, items }: { quoteId: string; items: readonly QuoteMenuItem[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function updateMenuPosition() {
    const trigger = containerRef.current?.querySelector("button");
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    setMenuPosition({ top: rect.bottom + 5, left: Math.max(8, rect.right - 184) });
  }

  function toggleMenu() {
    if (!isOpen) updateMenuPosition();
    setIsOpen((open) => !open);
  }

  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      const target = event.target as Node;
      if (!containerRef.current?.contains(target) && !menuRef.current?.contains(target)) setIsOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, []);

  return <div className="quote-opportunity-actions" ref={containerRef}>
    <button className="quote-opportunity-trigger" type="button" aria-expanded={isOpen} aria-haspopup="menu" onClick={toggleMenu}>Ações</button>
    {isOpen ? createPortal(<div className="quote-opportunity-menu" ref={menuRef} role="menu" aria-label="Ações do orçamento" style={menuPosition}>
      {items.map((item) => <form key={item.label} action={item.action} onSubmit={(event) => { if (!window.confirm(item.confirm)) event.preventDefault(); }}>
        <input type="hidden" name="quoteId" value={quoteId} />
        <button className={item.danger ? "is-danger" : undefined} type="submit" role="menuitem">{item.label}</button>
      </form>)}
    </div>, document.body) : null}
  </div>;
}
