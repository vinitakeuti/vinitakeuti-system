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

  return <main className="auth-shell">
    <section className="auth-surface" aria-labelledby="login-title">
      <header className="auth-header">
        <div className="auth-brand" aria-label="Vinicius Riudi"><img src="/assets/images/logo-vr.svg" alt="" aria-hidden="true" /><span className="auth-brand-copy"><strong>Vinicius Riudi</strong><small>Desenvolvedor de Software</small></span></div>
      </header>
      <div className="auth-copy"><h1 id="login-title">{greeting.title}</h1><p>{greeting.description}</p></div>
      <form className="auth-form" action={loginAction}>
        <label>E-MAIL<input name="email" type="email" autoComplete="username" inputMode="email" maxLength={254} required /></label>
        <label>SENHA<input name="password" type="password" autoComplete="current-password" maxLength={512} required /></label>
        {message ? <p className="auth-error" role="alert">{message}</p> : null}
        <button className="primary-action" type="submit">ENTRAR</button>
      </form>
    </section>
  </main>;
}
