"use client";

import { useState } from "react";

/** Copia o e-mail de contato, para quem não usa um aplicativo de e-mail no navegador. */
export function CopyEmail({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      window.location.href = `mailto:${email}`;
    }
  }

  return <button type="button" className="site-button is-large is-ghost" onClick={copy}><span aria-live="polite">{copied ? "E-mail copiado" : "Copiar e-mail"}</span></button>;
}
