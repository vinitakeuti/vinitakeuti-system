import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthFrame } from "@/features/auth/components/auth-frame";
import { portalForRequest } from "@/features/auth/services/auth-host";
import { requestPasswordResetAction } from "@/features/auth/services/password-reset-actions";
import { RESET_TOKEN_MINUTES } from "@/features/auth/services/password-reset";
import { emailProfessional } from "@/features/notifications/services/email-outbox";
import { emailConfigStatus } from "@/lib/integrations/email";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Esqueci minha senha | Vinicius Riudi", robots: { index: false } };

/** Pedido do link de redefinição. Aberta com ou sem sessão: quem está conectado e esqueceu a senha atual também usa. */
export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ enviado?: string; erro?: string }> }) {
  const portal = portalForRequest(await headers());
  if (portal === "landing") redirect("/");
  const params = await searchParams;
  const back = <p className="auth-alt"><Link className="auth-link" href="/entrar">Voltar para o login</Link></p>;

  // Sem SMTP o link não tem como chegar: a tela diz isso em vez de fingir que enviou.
  if (!emailConfigStatus().configured) {
    if (portal === "client") {
      const professional = await emailProfessional();
      return <AuthFrame portal={portal} title="Esqueceu a senha?" description="A redefinição por e-mail está indisponível no momento.">
        <div className="auth-form"><p className="auth-hint">Peça uma nova senha a {professional.name}. Você entra com ela e cria a sua no primeiro acesso.</p>{back}</div>
      </AuthFrame>;
    }
    return <AuthFrame portal={portal} title="Esqueceu a senha?" description="O envio de e-mails ainda não está configurado neste servidor, então o link não tem como chegar.">
      <div className="auth-form">
        <p className="auth-hint">Para redefinir agora, abra o terminal do container da gestão e rode o comando abaixo com o seu e-mail. Ele mostra um link que vale por {RESET_TOKEN_MINUTES} minutos.</p>
        <code className="auth-command">node scripts/redefinir-senha.mjs seu@email.com</code>
        <p className="auth-hint">Sem o e-mail, o mesmo comando sem nada depois lista as contas da gestão.</p>
        {back}
      </div>
    </AuthFrame>;
  }

  if (params.enviado) {
    return <AuthFrame portal={portal} title="Confira seu e-mail." description="Se o endereço informado tiver acesso, o link para criar uma nova senha chega em alguns minutos.">
      <div className="auth-form">
        <p className="auth-hint">O link vale por {RESET_TOKEN_MINUTES} minutos e funciona uma única vez. Não chegou? Confira a caixa de spam ou <Link className="auth-link" href="/esqueci-senha">peça outro link</Link>.</p>
        <Link className="primary-action" href="/entrar">Voltar para o login</Link>
      </div>
    </AuthFrame>;
  }

  return <AuthFrame portal={portal} title="Esqueceu a senha?" description="Informe o e-mail da sua conta. Enviamos um link para você criar uma nova senha.">
    <form className="auth-form" action={requestPasswordResetAction}>
      <label>E-mail<input name="email" type="email" autoComplete="username" inputMode="email" maxLength={254} required /></label>
      {params.erro === "email" ? <p className="auth-error" role="alert">Informe um e-mail válido.</p> : null}
      <button className="primary-action" type="submit">Enviar link</button>
      {back}
    </form>
  </AuthFrame>;
}
