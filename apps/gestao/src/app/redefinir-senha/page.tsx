import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthFrame } from "@/features/auth/components/auth-frame";
import { PasswordResetForm } from "@/features/auth/components/password-reset-form";
import { portalForRequest } from "@/features/auth/services/auth-host";
import { accountFitsPortal, findValidResetToken, RESET_TOKEN_MINUTES } from "@/features/auth/services/password-reset";

export const dynamic = "force-dynamic";
// O token vai no endereço: nenhum pedido desta página leva o endereço adiante.
export const metadata: Metadata = { title: "Nova senha | Vinicius Riudi", referrer: "no-referrer", robots: { index: false } };

/** Destino do link do e-mail: nova senha, ou o aviso de que o link venceu ou já foi usado. */
export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const portal = portalForRequest(await headers());
  if (portal === "landing") redirect("/");
  const { token = "" } = await searchParams;
  const found = token ? await findValidResetToken(token) : null;

  if (!found || !accountFitsPortal(found.user, portal)) {
    return <AuthFrame portal={portal} title="Este link não vale mais." description={`Os links de redefinição valem por ${RESET_TOKEN_MINUTES} minutos e funcionam uma única vez. Peça um novo para continuar.`}>
      <div className="auth-form">
        <Link className="primary-action" href="/esqueci-senha">Pedir um novo link</Link>
        <p className="auth-alt"><Link className="auth-link" href="/entrar">Voltar para o login</Link></p>
      </div>
    </AuthFrame>;
  }

  return <AuthFrame portal={portal} title="Crie uma nova senha." description="Ela substitui a senha anterior, que deixa de valer.">
    <PasswordResetForm token={token} email={found.user.email} />
  </AuthFrame>;
}
