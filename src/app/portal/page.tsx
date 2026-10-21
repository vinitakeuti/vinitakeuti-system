import Link from "next/link";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { PortalShell } from "@/features/client-portal/components/portal-shell";
import { getPortalContext, getPortalDocuments, getPortalPaymentOptions, getPortalServices, portalTodayStart } from "@/features/client-portal/queries/portal-queries";
import { buildPortalReminders } from "@/features/client-portal/services/portal-reminders";

export const dynamic = "force-dynamic";

const longDate = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Maceio" });
const hourNow = () => Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: "America/Maceio" }).format(new Date()));

const shortcuts = [
  { code: "02", href: "/servicos", title: "Serviços", detail: "O que foi contratado e o andamento dos projetos." },
  { code: "03", href: "/pagamentos", title: "Pagamentos", detail: "Parcelas, pagamento online e histórico." },
  { code: "04", href: "/documentos", title: "Documentos", detail: "Propostas e contratos para baixar e assinar." },
  { code: "05", href: "/configuracoes", title: "Sua conta", detail: "Dados de acesso, senha e contato." },
];

/** Início do portal: boas-vindas, lembretes do que pede atenção e atalhos. Os detalhes ficam em cada área. */
export default async function PortalHomePage() {
  const context = await getPortalContext();
  const [services, documents, options] = await Promise.all([getPortalServices(context.clientId), getPortalDocuments(context.clientId), getPortalPaymentOptions()]);
  const { profile } = options;
  const contactName = profile?.name ?? "Vinicius Riudi";
  const reminders = buildPortalReminders({ context, documents, services, online: options.online, contactName, todayStart: portalTodayStart() });
  const firstName = (context.client?.name ?? context.user.name).trim().split(/\s+/)[0] || "cliente";
  const hour = hourNow();
  const greeting = hour >= 5 && hour < 12 ? "Bom dia" : hour >= 12 && hour < 18 ? "Boa tarde" : "Boa noite";
  const today = longDate.format(new Date());

  const hero = <header className="portal-welcome">
    <div className="portal-welcome-top"><p className="eyebrow">{today.toUpperCase()}</p><SidebarToggle location="header" /></div>
    <h1>{greeting}, {firstName}.</h1>
    <p>Que bom ter você por aqui. Este é o seu espaço com {contactName}: acompanhe seus serviços, pagamentos e documentos quando quiser.</p>
    {profile?.email || profile?.phone ? <p className="portal-welcome-contact">Precisa de algo? {profile.email ? <a href={`mailto:${profile.email}`}>{profile.email}</a> : null}{profile.email && profile.phone ? " · " : null}{profile.phone ? <a href={`tel:${profile.phone.replace(/[^\d+]/g, "")}`}>{profile.phone}</a> : null}</p> : null}
  </header>;

  return <PortalShell context={context} current="home" section="INÍCIO" title={`Olá, ${firstName}.`} hero={hero}>
    <section className="settings-panel portal-reminders" aria-labelledby="portal-reminders-title">
      <div className="settings-panel-heading"><div><h2 id="portal-reminders-title">Lembretes.</h2><p>{reminders.length ? "O que pede sua atenção agora." : "Nada pendente por aqui."}</p></div></div>
      {reminders.length ? <ul className="portal-reminder-list">{reminders.map((reminder) => <li key={reminder.id} className={`is-${reminder.tone}`}>
        <span className="portal-reminder-mark" aria-hidden="true" />
        <div><b>{reminder.title}</b><small>{reminder.detail}</small></div>
        <Link className="text-link" href={reminder.href}>{reminder.action}</Link>
      </li>)}</ul> : <p className="portal-reminder-empty">Tudo em dia. Quando houver algo para você ver, como um vencimento próximo ou um documento para assinar, ele aparece aqui.</p>}
    </section>

    <nav className="portal-shortcuts" aria-label="Áreas do portal">
      {shortcuts.map((item) => <Link key={item.href} href={item.href}><span>{item.code}</span><b>{item.title}</b><small>{item.detail}</small></Link>)}
    </nav>
  </PortalShell>;
}
