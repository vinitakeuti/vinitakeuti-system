import { PasswordChangeForm } from "@/features/auth/components/password-change-form";
import { PortalShell } from "@/features/client-portal/components/portal-shell";
import { getPortalContext, getPortalPaymentOptions } from "@/features/client-portal/queries/portal-queries";

export const dynamic = "force-dynamic";

export default async function PortalSettingsPage() {
  const context = await getPortalContext();
  const { profile } = await getPortalPaymentOptions();
  const { client, user } = context;

  return <PortalShell context={context} current="settings" section="CONFIGURAÇÕES" title="Configurações." description="Seus dados de acesso e a senha da área do cliente.">
    <section className="settings-panel" aria-labelledby="portal-account-title">
      <div className="settings-panel-heading"><div><h2 id="portal-account-title">Sua conta.</h2><p>Para corrigir algum dado cadastral, fale com {profile?.name ?? "Vinicius Riudi"}.</p></div></div>
      <div className="settings-panel-body"><dl className="settings-facts">
        <div><dt>NOME</dt><dd>{client?.name ?? user.name}</dd></div>
        <div><dt>E-MAIL DE ACESSO</dt><dd>{user.email}</dd></div>
        <div><dt>EMPRESA</dt><dd>{client?.company || "—"}</dd></div>
        <div><dt>CPF / CNPJ</dt><dd>{client?.document || "—"}</dd></div>
      </dl></div>
    </section>
    <section className="settings-panel" aria-labelledby="portal-password-title">
      <div className="settings-panel-heading"><div><h2 id="portal-password-title">Senha de acesso.</h2><p>No primeiro acesso, troque a senha provisória por uma sua. Ao trocar, os outros aparelhos conectados precisam entrar de novo.</p></div></div>
      <div className="settings-panel-body"><PasswordChangeForm className="settings-password" /></div>
    </section>
    {profile?.email || profile?.phone || profile?.website ? <section className="settings-panel" aria-labelledby="portal-contact-title">
      <div className="settings-panel-heading"><div><h2 id="portal-contact-title">Contato.</h2><p>Dúvidas, pedidos e suporte.</p></div></div>
      <div className="settings-panel-body"><dl className="settings-facts portal-contact-facts">
        <div><dt>RESPONSÁVEL</dt><dd>{profile.name}</dd></div>
        {profile.email ? <div><dt>E-MAIL</dt><dd><a className="text-link-inline" href={`mailto:${profile.email}`}>{profile.email}</a></dd></div> : null}
        {profile.phone ? <div><dt>TELEFONE</dt><dd><a className="text-link-inline" href={`tel:${profile.phone.replace(/[^\d+]/g, "")}`}>{profile.phone}</a></dd></div> : null}
        {profile.website ? <div><dt>SITE</dt><dd><a className="text-link-inline" href={profile.website} target="_blank" rel="noreferrer">{profile.website.replace(/^https?:\/\//, "")}</a></dd></div> : null}
      </dl></div>
    </section> : null}
  </PortalShell>;
}
