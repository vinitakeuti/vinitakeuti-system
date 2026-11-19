"use client";

import { useActionState } from "react";
import { resetPasswordAction, type PasswordResetState } from "@/features/auth/services/password-reset-actions";

/** Nova senha pelo link do e-mail. O e-mail fica visível (e serve para o gerenciador de senhas salvar a conta certa). */
export function PasswordResetForm({ token, email }: { token: string; email: string }) {
  const [state, action, pending] = useActionState<PasswordResetState, FormData>(resetPasswordAction, { status: "idle" });
  return <form className="auth-form" action={action}>
    <input type="hidden" name="token" value={token} />
    <label>Conta<input name="username" type="email" autoComplete="username" value={email} readOnly /></label>
    <label>Nova senha<input name="next" type="password" autoComplete="new-password" minLength={8} maxLength={512} required aria-describedby="reset-hint" /></label>
    <label>Confirmar nova senha<input name="confirm" type="password" autoComplete="new-password" minLength={8} maxLength={512} required /></label>
    <p className="auth-hint" id="reset-hint">Pelo menos 8 caracteres. Ao salvar, você já entra, e os outros aparelhos conectados precisam entrar de novo.</p>
    {state.status === "error" ? <p className="auth-error" role="alert">{state.message}</p> : null}
    <button className="primary-action" type="submit" disabled={pending}>{pending ? "Salvando..." : "Salvar e entrar"}</button>
  </form>;
}
