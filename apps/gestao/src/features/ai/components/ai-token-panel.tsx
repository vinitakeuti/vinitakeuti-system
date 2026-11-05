"use client";

import { useActionState } from "react";
import { rotateExternalTokenAction, type TokenState } from "@/features/ai/services/ai-actions";

/** Gera o token de acesso externo e o mostra uma única vez, para copiar. */
export function AiTokenPanel({ hint }: { hint: string | null }) {
  const [state, action, pending] = useActionState<TokenState, FormData>(rotateExternalTokenAction, { token: null, error: null });
  return <form action={action} className="ai-token">
    <div>
      <b>Token de acesso externo.</b>
      <p>Usado pelo servidor MCP e pela entrada de mensagens do WhatsApp, no cabeçalho <code>Authorization: Bearer …</code>. Gerar um novo invalida o anterior.</p>
      {state.token ? <p className="settings-result is-ok"><span>Copie agora: este token não aparece de novo.</span><code>{state.token}</code></p> : hint ? <p>Token atual termina em <code>…{hint}</code>.</p> : <p>Nenhum token gerado.</p>}
    </div>
    <button className="secondary-action" type="submit" disabled={pending}>{pending ? "Gerando…" : hint || state.token ? "Gerar novo token" : "Gerar token"}</button>
  </form>;
}
