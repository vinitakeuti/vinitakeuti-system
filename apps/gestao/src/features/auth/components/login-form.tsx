import Link from "next/link";
import { AuthFrame } from "@/features/auth/components/auth-frame";
import { loginAction } from "@/features/auth/services/auth-actions";
import type { SessionAudience } from "@/features/auth/types/auth";

const messages = {
  acesso: "Esta conta não possui acesso a este portal.",
  configuracao: "O acesso ainda não foi configurado. Defina AUTH_SECRET no ambiente do sistema.",
  credenciais: "E-mail ou senha inválidos.",
} as const;

export function LoginForm({ portal, error }: { portal: SessionAudience; error?: string }) {
  const client = portal === "client";
  const greeting = client
    ? { title: "Que bom ter você aqui.", description: "Este é o seu espaço para acompanhar cada etapa com mais clareza e tranquilidade." }
    : { title: "Bem-vindo de volta.", description: "Um espaço para transformar ideias em soluções digitais com clareza e intenção." };
  const message = error && error in messages ? messages[error as keyof typeof messages] : null;

  return <AuthFrame portal={portal} title={greeting.title} description={greeting.description}>
    <form className="auth-form" action={loginAction}>
      <label>E-mail<input name="email" type="email" autoComplete="username" inputMode="email" maxLength={254} required /></label>
      <div className="auth-field">
        <div className="auth-field-head"><label htmlFor="login-password">Senha</label><Link className="auth-link" href="/esqueci-senha">Esqueci minha senha</Link></div>
        <input id="login-password" name="password" type="password" autoComplete="current-password" maxLength={512} required />
      </div>
      {message ? <p className="auth-error" role="alert">{message}</p> : null}
      <button className="primary-action" type="submit">Entrar</button>
    </form>
  </AuthFrame>;
}
