import Link from "next/link";
import { PortalShell } from "@/features/client-portal/components/portal-shell";
import { day, money } from "@/features/client-portal/components/portal-format";
import { getPortalContext, getPortalServices } from "@/features/client-portal/queries/portal-queries";
import { monitoringStatusLabel } from "@/features/monitoring/types/monitoring-labels";

export const dynamic = "force-dynamic";

const cycle: Record<string, string> = { MONTHLY: "mensal", QUARTERLY: "trimestral", SEMIANNUAL: "semestral", YEARLY: "anual" };
const saleStatus: Record<string, string> = { CONFIRMED: "Em andamento", PAID: "Quitado" };
const subscriptionStatus: Record<string, string> = { ACTIVE: "Ativa", PAST_DUE: "Pagamento pendente", PAUSED: "Pausada" };
const projectStatus: Record<string, string> = { PROPOSAL: "Proposta", PLANNING: "Planejamento", IN_PROGRESS: "Em execução", WAITING_CLIENT: "Aguardando você", DELIVERED: "Entregue", PAUSED: "Pausado" };
const systemTone: Record<string, string> = { OPERATIONAL: "is-ok", DEGRADED: "is-soon", DOWN: "is-late", UNKNOWN: "" };

export default async function PortalServicesPage() {
  const context = await getPortalContext();
  const { sales, subscriptions, projects, systems } = await getPortalServices(context.clientId);
  const empty = !sales.length && !subscriptions.length && !projects.length && !systems.length;

  return <PortalShell context={context} current="services" section="SERVIÇOS" title="Serviços contratados." description="O que foi contratado, o andamento dos projetos e a situação dos seus sistemas.">
    {empty ? <section className="settings-panel"><p className="settings-empty">Nenhum serviço contratado ainda. Quando uma proposta for aprovada, os serviços aparecem aqui.</p></section> : null}

    {sales.length ? <section className="settings-panel" aria-labelledby="portal-sales-title">
      <div className="settings-panel-heading"><div><h2 id="portal-sales-title">Contratações.</h2><p>Cada proposta aprovada, com os serviços incluídos.</p></div><Link className="text-link" href="/pagamentos">VER PAGAMENTOS</Link></div>
      <ul className="portal-plan">{sales.map((sale) => <li key={sale.id}>
        <div className="portal-sale-heading"><div><b>{sale.title}</b><small>{sale.quote?.code ?? sale.code}{sale.confirmedAt ? ` · contratado em ${day(sale.confirmedAt)}` : ""}</small></div><div className="portal-sale-meta"><strong>{money(sale.amountCents)}</strong><span className={`portal-tag ${sale.status === "PAID" ? "is-ok" : ""}`}>{saleStatus[sale.status]}</span></div></div>
        {sale.quote?.items.length ? <ul className="portal-items">{sale.quote.items.map((item) => <li key={item.id}><span>{item.name}{item.quantity > 1 ? ` × ${item.quantity}` : ""}</span><small>{item.categoryName} · {item.billingType === "RECURRING" ? `recorrente${item.billingCycle && cycle[item.billingCycle] ? ` ${cycle[item.billingCycle]}` : ""}` : "entrega única"}</small></li>)}</ul> : null}
      </li>)}</ul>
    </section> : null}

    {subscriptions.length ? <section className="settings-panel" aria-labelledby="portal-subscriptions-title">
      <div className="settings-panel-heading"><div><h2 id="portal-subscriptions-title">Assinaturas.</h2><p>Serviços cobrados de forma recorrente.</p></div></div>
      <ul className="portal-list">{subscriptions.map((subscription) => <li className="portal-row is-compact" key={subscription.id}><div className="portal-row-main"><b>{subscription.name}</b><small>{money(subscription.amountCents)} {cycle[subscription.billingCycle] ?? ""}{subscription.nextPaymentAt ? ` · próximo pagamento em ${day(subscription.nextPaymentAt)}` : ""}</small></div><span className={`portal-tag ${subscription.status === "ACTIVE" ? "is-ok" : subscription.status === "PAST_DUE" ? "is-late" : ""}`}>{subscriptionStatus[subscription.status] ?? subscription.status}</span></li>)}</ul>
    </section> : null}

    {projects.length ? <section className="settings-panel" aria-labelledby="portal-projects-title">
      <div className="settings-panel-heading"><div><h2 id="portal-projects-title">Projetos.</h2><p>Andamento das entregas.</p></div></div>
      <ul className="portal-list">{projects.map((project) => <li className="portal-row is-compact" key={project.id}><div className="portal-row-main"><b>{project.name}</b><small>{project.deliveryAt ? `${project.status === "DELIVERED" ? "Entregue" : "Entrega prevista"} em ${day(project.deliveryAt)}` : project.startedAt ? `Iniciado em ${day(project.startedAt)}` : "Sem data de entrega definida"}</small></div><span className={`portal-tag ${project.status === "DELIVERED" ? "is-ok" : project.status === "WAITING_CLIENT" ? "is-soon" : ""}`}>{projectStatus[project.status] ?? project.status}</span></li>)}</ul>
    </section> : null}

    {systems.length ? <section className="settings-panel" aria-labelledby="portal-systems-title">
      <div className="settings-panel-heading"><div><h2 id="portal-systems-title">Seus sistemas.</h2><p>Monitorados automaticamente; você é avisado se algo sair do normal.</p></div></div>
      <ul className="portal-list">{systems.map((system) => <li className="portal-row is-compact" key={system.id}><div className="portal-row-main"><b>{system.name}</b><small>{system.url ? system.url.replace(/^https?:\/\//, "") : "—"}{system.lastCheckedAt ? ` · verificado em ${day(system.lastCheckedAt)} às ${system.lastCheckedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Maceio" })}` : ""}</small></div><span className={`portal-tag ${systemTone[system.status]}`}>{monitoringStatusLabel[system.status]}</span></li>)}</ul>
    </section> : null}
  </PortalShell>;
}
