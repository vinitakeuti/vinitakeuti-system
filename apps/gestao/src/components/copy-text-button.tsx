"use client";

import { useState } from "react";

/** Copia um texto para a área de transferência e confirma por alguns segundos. */
export function CopyTextButton({ text, label = "Copiar texto", className = "secondary-action" }: { text: string; label?: string; className?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
    window.setTimeout(() => setState("idle"), 2500);
  }
  return <button type="button" className={className} onClick={copy} aria-live="polite">{state === "copied" ? "Texto copiado" : state === "failed" ? "Não foi possível copiar" : label}</button>;
}
