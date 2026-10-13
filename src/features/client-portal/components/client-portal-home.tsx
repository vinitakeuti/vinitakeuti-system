import { logoutAction } from "@/features/auth/services/auth-actions";
import { requireClientUser } from "@/features/auth/services/auth-session";

export async function ClientPortalHome() {
  const user = await requireClientUser();
  const firstName = user.name.trim().split(/\s+/)[0] || "cliente";

  return <main className="client-portal-shell">
    <header className="client-portal-header"><div className="client-portal-brand"><img src="/assets/images/logo-vr.svg" alt="" aria-hidden="true" /><span className="client-portal-brand-copy"><strong>Vinicius Riudi</strong><small>Desenvolvedor de Software</small></span></div><form action={logoutAction}><button className="text-link" type="submit">SAIR</button></form></header>
    <section className="client-portal-intro"><p className="eyebrow">ÁREA DO CLIENTE</p><h1>Olá, {firstName}.</h1><p>Seu portal está sendo preparado para concentrar pagamentos, serviços ativos e o andamento das suas entregas.</p></section>
    <section className="client-portal-next" aria-label="Próximas funcionalidades"><div><span>01</span><b>Pagamentos</b><small>Consulte cobranças e histórico de pagamentos.</small></div><div><span>02</span><b>Serviços ativos</b><small>Acompanhe o que está contratado e em execução.</small></div><div><span>03</span><b>Relacionamento</b><small>Encontre documentos e atualizações importantes.</small></div></section>
  </main>;
}
