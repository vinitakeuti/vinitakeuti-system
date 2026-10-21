import Link from "next/link";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { PortalShell } from "@/features/client-portal/components/portal-shell";
import { getPortalContact, getPortalContext, getPortalDocuments, getPortalPaymentOptions, getPortalServices, portalTodayStart } from "@/features/client-portal/queries/portal-queries";
import { buildProjectJourney } from "@/features/client-portal/services/portal-journey";
import { buildPortalReminders } from "@/features/client-portal/services/portal-reminders";
import { BRAND_TITLE } from "@/features/professional-profile/types/brand";

export const dynamic = "force-dynamic";

const longDate = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Maceio" });
const hourNow = () => Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: "America/Maceio" }).format(new Date()));
const toneLabel = { attention: "Importante", soon: "Em breve", info: "Para ver" } as const;

/**
 * Início do portal: boas-vindas, a jornada do projeto (da proposta à entrega), os lembretes e o contato.
 * Valores e listas completas ficam nas áreas do menu.
 */
export default async function PortalHomePage() {
  const context = await getPortalContext();
  const [services, documents, options, contact] = await Promise.all([getPortalServices(context.clientId), getPortalDocuments(context.clientId), getPortalPaymentOptions(), getPortalContact()]);
  const reminders = buildPortalReminders({ context, documents, services, online: options.online, contactName: contact.name, todayStart: portalTodayStart() });
  const journey = buildProjectJourney(services, documents);
  const firstName = (context.client?.name ?? context.user.name).trim().split(/\s+/)[0] || "cliente";
  const initials = contact.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "VR";
  const hour = hourNow();
  const greeting = hour >= 5 && hour < 12 ? "Bom dia" : hour >= 12 && hour < 18 ? "Boa tarde" : "Boa noite";
  const phoneDigits = contact.phone?.replace(/\D/g, "") ?? "";
  const whatsapp = phoneDigits.length >= 10 ? `https://wa.me/${phoneDigits.startsWith("55") ? phoneDigits : `55${phoneDigits}`}` : null;

  const hero = <header className="portal-welcome">
    <div className="portal-welcome-top"><p className="eyebrow">{longDate.format(new Date()).toUpperCase()}</p><SidebarToggle location="header" /></div>
    <h1>{greeting}, {firstName}.</h1>
    <p>Que bom ter você por aqui. {journey ? "Acompanhe abaixo como está o seu projeto e o que precisa da sua atenção." : "Assim que sua proposta for aprovada, você acompanha o projeto por aqui."}</p>
  </header>;

  return <PortalShell context={context} current="home" section="INÍCIO" title={`Olá, ${firstName}.`} hero={hero}>
    <div className="portal-home">
      <div className="portal-home-main">
        {journey ? <section className="settings-panel portal-journey" aria-labelledby="portal-journey-title">
          <div className="settings-panel-heading"><div><p className="eyebrow">SEU PROJETO · {journey.code}</p><h2 id="portal-journey-title">{journey.title}</h2><p>{journey.done} de {journey.steps.length} etapas concluídas{journey.more > 0 ? ` · mais ${journey.more} ${journey.more === 1 ? "contratação" : "contratações"} em Serviços` : ""}.</p></div><Link className="text-link" href="/servicos">VER SERVIÇOS</Link></div>
          <ol className="portal-journey-steps">{journey.steps.map((step, index) => <li key={step.label} className={`is-${step.state}`}>
            <span className="portal-journey-dot" aria-hidden="true">{index + 1}</span>
            <b>{step.label}</b>
            <small>{step.detail}</small>
          </li>)}</ol>
        </section> : null}

        <section className="settings-panel portal-todo" aria-labelledby="portal-todo-title">
          <div className="settings-panel-heading"><div><h2 id="portal-todo-title">Para você.</h2><p>{reminders.length ? "O que pede sua atenção agora." : "Nada pendente no momento."}</p></div></div>
          {reminders.length ? <ul className="portal-todo-list">{reminders.map((reminder) => <li key={reminder.id} className={`is-${reminder.tone}`}>
            <div className="portal-todo-text"><span className="portal-todo-meta"><i aria-hidden="true" />{reminder.category} · {toneLabel[reminder.tone]}</span><b>{reminder.title}</b><small>{reminder.detail}</small></div>
            <Link className="secondary-action" href={reminder.href}>{reminder.action}</Link>
          </li>)}</ul> : <p className="portal-todo-empty">Tudo em dia. Quando houver um vencimento próximo, um documento para assinar ou uma novidade do projeto, ela aparece aqui.</p>}
        </section>
      </div>

      <aside className="portal-contact-card" aria-labelledby="portal-contact-title">
        <div className="portal-contact-person"><span className="portal-contact-mark" aria-hidden="true">{initials}</span><div><p className="eyebrow">SEU CONTATO</p><h2 id="portal-contact-title">{contact.name}</h2><small>{BRAND_TITLE}</small></div></div>
        <p>Dúvidas, pedidos de ajuste ou qualquer ajuda com o seu projeto: é só chamar.</p>
        {contact.email || whatsapp ? <div className="portal-contact-actions">
          {whatsapp ? <a className="primary-action" href={whatsapp} target="_blank" rel="noreferrer">WHATSAPP</a> : null}
          {contact.email ? <a className="secondary-action" href={`mailto:${contact.email}`}>ENVIAR E-MAIL</a> : null}
        </div> : null}
        {contact.email || contact.phone || contact.website ? <dl>
          {contact.email ? <div><dt>E-MAIL</dt><dd>{contact.email}</dd></div> : null}
          {contact.phone ? <div><dt>TELEFONE</dt><dd>{contact.phone}</dd></div> : null}
          {contact.website ? <div><dt>SITE</dt><dd><a href={contact.website} target="_blank" rel="noreferrer">{contact.website.replace(/^https?:\/\//, "")}</a></dd></div> : null}
        </dl> : null}
      </aside>
    </div>
  </PortalShell>;
}
