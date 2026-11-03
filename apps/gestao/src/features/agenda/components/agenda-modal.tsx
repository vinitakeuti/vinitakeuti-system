"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

/**
 * Pop-up da agenda (detalhe e formulário do evento). Aberto pela URL (?evento=, ?novo=, ?editar=): fechar volta para a
 * tela de origem sem rolar a página. No computador fica centralizado; no celular, sobe do rodapé. Fecha no Esc, no
 * fundo escurecido e no X, com animação de saída.
 */
export function AgendaModal({ closeHref, labelledBy, size = "normal", children }: { closeHref: string; labelledBy: string; size?: "normal" | "wide"; children: ReactNode }) {
  const router = useRouter();
  const [closing, setClosing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const closingRef = useRef(false);

  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(() => router.push(closeHref, { scroll: false }), reduced ? 0 : 190);
  }, [closeHref, router]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); close(); return; }
      if (event.key !== "Tab" || !panelRef.current) return;
      // Mantém o Tab dentro do pop-up.
      const items = [...panelRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input:not([type=hidden]):not([disabled]), select, textarea")];
      if (!items.length) return;
      const first = items[0];
      const last = items.at(-1)!;
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.({ preventScroll: true });
    };
  }, [close]);

  return <div className={`agenda-modal${closing ? " is-closing" : ""}`}>
    <div className="agenda-modal-backdrop" onClick={close} aria-hidden="true" />
    <div className={`agenda-modal-panel is-${size}`} role="dialog" aria-modal="true" aria-labelledby={labelledBy} ref={panelRef} tabIndex={-1}>
      <span className="agenda-modal-grip" aria-hidden="true" />
      <button type="button" className="agenda-modal-close" onClick={close} aria-label="Fechar"><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" /></svg></button>
      {children}
    </div>
  </div>;
}

/** Botão de envio que mostra o andamento (e não aceita dois cliques) enquanto a ação do servidor roda. */
export function PendingButton({ className, children, label, title }: { className?: string; children: ReactNode; label?: string; title?: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" className={`${className ?? ""}${pending ? " is-pending" : ""}`} disabled={pending} aria-label={label} title={title} aria-busy={pending}>{children}</button>;
}
