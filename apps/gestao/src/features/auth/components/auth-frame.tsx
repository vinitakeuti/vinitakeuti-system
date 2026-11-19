import type { ReactNode } from "react";
import type { SessionAudience } from "@/features/auth/types/auth";

/** Moldura das telas de acesso (entrar, esqueci a senha, nova senha): marca, portal, título e o conteúdo da tela. */
export function AuthFrame({ portal, title, description, children }: { portal: SessionAudience; title: string; description: ReactNode; children: ReactNode }) {
  return <main className="auth-shell">
    <section className="auth-surface" aria-labelledby="auth-title">
      <header className="auth-header">
        <div className="auth-brand" aria-label="Vinicius Riudi"><img src="/assets/images/logo-vr.svg" alt="" aria-hidden="true" /><span className="auth-brand-copy"><strong>Vinicius Riudi</strong><small>Desenvolvedor de Software</small></span></div>
        <p className="auth-portal">{portal === "client" ? "Área do cliente" : "Gestão"}</p>
      </header>
      <div className="auth-copy"><h1 id="auth-title">{title}</h1><p>{description}</p></div>
      {children}
    </section>
  </main>;
}
