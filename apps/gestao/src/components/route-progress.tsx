"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Barra fina no topo enquanto a próxima rota carrega. Começa no clique em um link interno e termina quando o
 * endereço muda. Não altera a navegação: só observa cliques e o caminho atual.
 */
export function RouteProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [state, setState] = useState<"idle" | "starting" | "active" | "done">("idle");

  useEffect(() => {
    setState((current) => (current === "active" || current === "starting" ? "done" : current));
  }, [pathname, searchParams]);

  useEffect(() => {
    if (state !== "starting") return;
    const frame = window.requestAnimationFrame(() => setState("active"));
    return () => window.cancelAnimationFrame(frame);
  }, [state]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest("a");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      setState("starting");
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return <div className={`route-progress ${state === "active" ? "is-active" : state === "done" ? "is-done" : ""}`} aria-hidden="true" />;
}
