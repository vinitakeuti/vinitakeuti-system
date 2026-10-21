"use client";

import { useActionState } from "react";
import { changeOwnPasswordAction, type PasswordChangeState } from "@/features/auth/services/password-actions";

/** Troca da própria senha (portal do cliente e Configurações da gestão). */
export function PasswordChangeForm({ className = "client-portal-password" }: { className?: string }) {
  const [state, action, pending] = useActionState<PasswordChangeState, FormData>(changeOwnPasswordAction, { status: "idle" });
  return <form action={action} className={className}>
    {state.status === "error" ? <p className="form-error" role="alert">{state.message}</p> : null}
    {state.status === "ok" ? <p className="form-success" role="status">{state.message}</p> : null}
    <label>Senha atual<input name="current" type="password" autoComplete="current-password" required /></label>
    <label>Nova senha<input name="next" type="password" autoComplete="new-password" minLength={8} required /></label>
    <label>Confirmar nova senha<input name="confirm" type="password" autoComplete="new-password" minLength={8} required /></label>
    <button className="primary-action" type="submit" disabled={pending}>{pending ? "SALVANDO..." : "ALTERAR SENHA"}</button>
  </form>;
}
