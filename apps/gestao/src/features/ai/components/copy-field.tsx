"use client";

import { useState } from "react";

/** Código para copiar, com botão COPIAR. */
export function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return <div className="ai-copy">
    <code aria-label={label}>{value}</code>
    <button type="button" className="secondary-action" onClick={async () => { try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { setCopied(false); } }}>{copied ? "Copiado" : "Copiar"}</button>
  </div>;
}
