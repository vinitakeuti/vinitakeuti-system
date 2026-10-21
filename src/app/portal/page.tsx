import Link from "next/link";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { PortalShell } from "@/features/client-portal/components/portal-shell";
import { getPortalContext, getPortalDocuments, getPortalPaymentOptions, getPortalServices, portalTodayStart } from "@/features/client-portal/queries/portal-queries";
import { buildPortalReminders } from "@/features/client-portal/services/portal-reminders";

export const dynamic = "force-dynamic";

const longDate = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Maceio" });
const hourNow = () => Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: "America/Maceio" }).format(new Date()));

/** Início do portal: boas-vindas, lembretes do que pede atenção e o contato. Os detalhes ficam em cada área do menu. */
export default async function PortalHomePage() {
  const context = await getPortalContext();
  const [services, documents, options] = await Promise.all([getPortalServices(context.clientId), getPortalDocuments(context.clientId), getPortalPaymentOptions()]);
  const { profile } = options;
  const contactName = profile?.name ?? "Vinicius Riudi";
  const reminders = buildPortalReminders({ context, documents, services, online: options.online, contactName, todayStart: portalTodayStart() });
  const firstName = (context.client?.name ?? context.user.name).trim().split(/\s+/)[0] || "cliente";
  const initials = contactName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "VR";
  const hour = hourNow();
  const greeting = hour >= 5 && hour < 12 ? "Bom dia" : hour >= 12 && hour < 18 ? "Boa tarde" : "Boa noite";
  const today = longDate.format(new Date());

  const hero = <header className="portal-welcome">
    <div className="portal-welcome-top"><p className="eyebrow">{today.toUpperCase()}</p><SidebarToggle location="header" /></div>
    <h1>{greeting}, {firstName}.</h1>
    <p>Que bom ter você por aqui. Este é o seu espaço com {contactName}: acompanhe seus serviços, pagamentos e documentos quando quiser.</p>
  </header>;

  return <PortalShell context={context} current="home" section="INÍCIO" title={`Olá, ${firstName}.`} hero={hero}>
    <section className="portal-reminders" aria-labelledby="portal-reminders-title">
      <h2 id="portal-reminders-title">{reminders.length ? (reminders.length === 1 ? "Um lembrete para você" : `${reminders.length} lembretes para você`) : "Tudo em dia"}</h2>
      {reminders.length ? <ul className="portal-reminder-grid">{reminders.map((reminder) => <li key={reminder.id} className={`is-${reminder.tone}`}>
        <span className="portal-reminder-category">{reminder.category}</span>
        <b>{reminder.title}</b>
        <small>{reminder.detail}</small>
        <Link href={reminder.href}>{reminder.action}</Link>
      </li>)}</ul> : <p className="portal-reminder-empty">Nenhuma pendência no momento. Quando houver algo para você ver, como um vencimento próximo ou um documento para assinar, ele aparece aqui.</p>}
    </section>

    <section className="portal-contact-card" aria-labelledby="portal-contact-title">
      <span className="portal-contact-mark" aria-hidden="true">{initials}</span>
      <div><p className="eyebrow">SEU CONTATO</p><h2 id="portal-contact-title">Fale com {contactName}</h2><p>Dúvidas, pedidos de ajuste ou qualquer ajuda com seu projeto.</p></div>
      <dl>
        {profile?.email ? <div><dt>E-MAIL</dt><dd><a href={`mailto:${profile.email}`}>{profile.email}</a></dd></div> : null}
        {profile?.phone ? <div><dt>TELEFONE</dt><dd><a href={`tel:${profile.phone.replace(/[^\d+]/g, "")}`}>{profile.phone}</a></dd></div> : null}
        {profile?.website ? <div><dt>SITE</dt><dd><a href={profile.website} target="_blank" rel="noreferrer">{profile.website.replace(/^https?:\/\//, "")}</a></dd></div> : null}
      </dl>
    </section>
  </PortalShell>;
}
