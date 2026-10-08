import Link from "next/link";
import { notFound } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { getClientProfile } from "@/features/clients/queries/client-queries";

export const dynamic = "force-dynamic";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "America/Maceio" });
const sections = ["overview", "quotes", "projects", "subscriptions"] as const;
type ProfileSection = (typeof sections)[number];

const sectionLabels: Record<ProfileSection, string> = {
  overview: "Resumo",
  quotes: "Orçamentos",
  projects: "Serviços",
  subscriptions: "Assinaturas",
};

function isProfileSection(value?: string): value is ProfileSection {
  return Boolean(value && sections.includes(value as ProfileSection));
}

function profileHref(id: string, section: ProfileSection) {
  return section === "overview" ? `/clientes/${id}` : `/clientes/${id}?section=${section}`;
}

export default async function ClientProfilePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ section?: string }> }) {
  const { id } = await params;
  const { section: requestedSection } = await searchParams;
  const activeSection = isProfileSection(requestedSection) ? requestedSection : "overview";
  const client = await getClientProfile(id);
  if (!client) notFound();

  const sectionCounts: Record<Exclude<ProfileSection, "overview">, number> = {
    quotes: client.quotes.length,
    projects: client.projects.length,
    subscriptions: client.subscriptions.length,
  };

  return (
    <main className="app-shell"><AppSidebar current="clients" /><div className="workspace"><section className="directory-page profile-page">
      <header className="directory-header"><div><p className="eyebrow">CLIENTE / PERFIL</p><h1>{client.name}</h1><p>{client.company ?? "Perfil de cliente"}</p></div><div className="header-actions"><SidebarToggle location="header" /><Link className="text-link" href="/clientes">VOLTAR PARA CLIENTES</Link></div></header>
      <nav className="profile-nav" aria-label="Seções do cliente">{sections.map((section) => <Link key={section} className={activeSection === section ? "active" : undefined} href={profileHref(client.id, section)}><span>{sectionLabels[section]}</span>{section === "overview" ? null : <b>{sectionCounts[section]}</b>}</Link>)}</nav>
      {activeSection === "overview" ? <section className="profile-surface"><div className="profile-overview"><div className="profile-identity"><p className="eyebrow">RELACIONAMENTO ATIVO</p><strong>{client.name}</strong><span>{client.company ?? "Pessoa física"}</span><small>Cliente desde {date.format(client.createdAt)}</small></div><div className="profile-stat"><span>ORÇAMENTOS</span><b>{client.quotes.length}</b></div><div className="profile-stat"><span>SERVIÇOS ATIVOS</span><b>{client.projects.length}</b></div><div className="profile-stat"><span>ASSINATURAS</span><b>{client.subscriptions.length}</b></div></div><div className="profile-section"><p className="eyebrow">INFORMAÇÕES DE CONTATO</p><dl className="contact-grid"><div><dt>E-mail</dt><dd>{client.email ?? "Não informado"}</dd></div><div><dt>Telefone</dt><dd>{client.phone ?? "Não informado"}</dd></div><div><dt>Cidade</dt><dd>{client.city ?? "Não informada"}</dd></div><div><dt>CPF / CNPJ</dt><dd>{client.document ?? "Não informado"}</dd></div></dl><dl className="address-line"><div><dt>Endereço</dt><dd>{client.address ?? "Não informado"}</dd></div></dl>{client.notes ? <p className="client-notes">{client.notes}</p> : null}</div></section> : null}
      {activeSection === "quotes" ? <ProfileSection title="ORÇAMENTOS REALIZADOS" description="Todos os orçamentos permanecem vinculados a este perfil."><ProfileTable variant="quotes" columns={["CÓDIGO", "ORÇAMENTO", "VALOR", "STATUS", "EMITIDO"]} empty="Nenhum orçamento registrado para este cliente.">{client.quotes.map((quote) => <tr key={quote.id}><td>{quote.code}</td><td>{quote.title}</td><td>{money.format(quote.amountCents / 100)}</td><td>{quote.status}</td><td>{date.format(quote.createdAt)}</td></tr>)}</ProfileTable></ProfileSection> : null}
      {activeSection === "projects" ? <ProfileSection title="SERVIÇOS ATIVOS" description="Serviços em planejamento, execução ou aguardando retorno."><ProfileTable variant="projects" columns={["SERVIÇO", "STATUS", "ENTREGA", "VALOR"]} empty="Nenhum serviço ativo para este cliente.">{client.projects.map((project) => <tr key={project.id}><td>{project.name}</td><td>{project.status}</td><td>{project.deliveryAt ? date.format(project.deliveryAt) : "A definir"}</td><td>{project.budgetCents ? money.format(project.budgetCents / 100) : "A definir"}</td></tr>)}</ProfileTable></ProfileSection> : null}
      {activeSection === "subscriptions" ? <ProfileSection title="ASSINATURAS" description="Cobranças recorrentes e situação de cada assinatura."><div className="profile-section-actions"><Link className="text-link" href={`/clientes/${client.id}/assinaturas/nova`}>ATRIBUIR SERVIÇO RECORRENTE</Link></div><ProfileTable variant="subscriptions" columns={["ASSINATURA", "STATUS", "PRÓXIMO PAGAMENTO", "VALOR"]} empty="Nenhuma assinatura registrada para este cliente.">{client.subscriptions.map((subscription) => <tr key={subscription.id}><td><span>{subscription.name}</span><small>{subscription.serviceCatalogItem?.category.name ?? "Recorrência avulsa"}</small></td><td>{subscription.status}</td><td>{subscription.nextPaymentAt ? date.format(subscription.nextPaymentAt) : "A definir"}</td><td>{money.format(subscription.amountCents / 100)}</td></tr>)}</ProfileTable></ProfileSection> : null}
    </section></div></main>
  );
}

function ProfileSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <section className="profile-surface profile-data-surface"><div className="profile-section-heading"><div><p className="eyebrow">{title}</p><h2>{title}</h2></div><span className="profile-rule">{description}</span></div>{children}</section>;
}

function ProfileTable({ columns, empty, children, variant }: { columns: string[]; empty: string; children: React.ReactNode; variant: string }) {
  const hasRows = Array.isArray(children) ? children.length > 0 : Boolean(children);
  if (!hasRows) return <div className="profile-empty"><p>{empty}</p></div>;
  return <div className={`table-scroll profile-table profile-table-${variant}`}><table><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
}
