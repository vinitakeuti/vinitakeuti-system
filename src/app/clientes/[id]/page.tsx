import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { formatCnpj, formatCpf } from "@/lib/br-documents";
import { clientPortalUrl } from "@/features/auth/services/auth-host";
import { PortalAccessPanel } from "@/features/client-portal/components/portal-access-panel";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { getClientProfile } from "@/features/clients/queries/client-queries";
import { DOCUMENT_KINDS, documentKindFromEnum } from "@/features/documents/types/document-kinds";
import { monitoringEnvironmentLabel, monitoringStatusClass, monitoringStatusLabel } from "@/features/monitoring/types/monitoring-labels";

export const dynamic = "force-dynamic";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "America/Maceio" });
const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Maceio" });
const sections = ["overview", "documents", "projects", "subscriptions", "systems"] as const;
type ProfileSection = (typeof sections)[number];

const sectionLabels: Record<ProfileSection, string> = {
  overview: "Resumo",
  documents: "Documentos",
  projects: "Serviços",
  subscriptions: "Assinaturas",
  systems: "Sistemas",
};

const projectStatusLabels: Record<string, string> = { LEAD: "Contato inicial", PROPOSAL: "Proposta", PLANNING: "Planejamento", IN_PROGRESS: "Em execução", WAITING_CLIENT: "Aguardando cliente", DELIVERED: "Entregue", PAUSED: "Pausado", CANCELLED: "Cancelado" };
const subscriptionStatusLabels: Record<string, string> = { ACTIVE: "Ativa", PAST_DUE: "Em atraso", PAUSED: "Pausada", CANCELLED: "Cancelada" };

function isProfileSection(value?: string): value is ProfileSection {
  return Boolean(value && sections.includes(value as ProfileSection));
}

function profileHref(id: string, section: ProfileSection) {
  return section === "overview" ? `/clientes/${id}` : `/clientes/${id}?section=${section}`;
}

function initialsOf(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words.length > 1 ? words.at(-1)![0] : words[0]?.[1] ?? "")).toUpperCase();
}

/** Link do WhatsApp para telefones brasileiros com DDD. */
function whatsappHref(phone: string | null) {
  const digits = phone?.replace(/\D/g, "") ?? "";
  if (digits.length === 10 || digits.length === 11) return `https://wa.me/55${digits}`;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) return `https://wa.me/${digits}`;
  return null;
}

export default async function ClientProfilePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ section?: string; updated?: string }> }) {
  const { id } = await params;
  const { section: requestedSection, updated } = await searchParams;
  // "quotes" era o nome antigo da seção de documentos.
  const activeSection = requestedSection === "quotes" ? "documents" : isProfileSection(requestedSection) ? requestedSection : "overview";
  const client = await getClientProfile(id);
  if (!client) notFound();

  const sectionCounts: Record<Exclude<ProfileSection, "overview">, number> = {
    documents: client.quotes.length + client.documents.length,
    projects: client.projects.length,
    subscriptions: client.subscriptions.length,
    systems: client.monitoredApps.length,
  };
  const whatsapp = whatsappHref(client.phone);
  const recentDocuments = [
    ...client.quotes.map((quote) => ({ id: quote.id, title: quote.title, code: quote.code, kind: "Proposta", done: Boolean(quote.completedAt), date: quote.createdAt, href: `/orcamentos/${quote.id}/editor` })),
    ...client.documents.map((document) => ({ id: document.id, title: document.title, code: document.code, kind: documentKindFromEnum(document.kind).shortName, done: Boolean(document.completedAt), date: document.updatedAt, href: `/documentos/${document.id}/editor` })),
  ].sort((left, right) => right.date.getTime() - left.date.getTime()).slice(0, 4);
  const contact: Array<{ label: string; value: ReactNode }> = [
    { label: "E-mail", value: client.email ? <a href={`mailto:${client.email}`}>{client.email}</a> : null },
    { label: "Telefone", value: client.phone ? <><a href={`tel:${client.phone.replace(/[^\d+]/g, "")}`}>{client.phone}</a>{whatsapp ? <a className="client-fact-action" href={whatsapp} target="_blank" rel="noreferrer">WHATSAPP</a> : null}</> : null },
    { label: "CPF", value: client.cpf ? formatCpf(client.cpf) : null },
    { label: "CNPJ", value: client.cnpj ? formatCnpj(client.cnpj) : null },
    // Cadastro antigo que não era CPF nem CNPJ completo: mostra como foi digitado.
    ...(!client.cpf && !client.cnpj && client.document ? [{ label: "Documento", value: client.document }] : []),
    { label: "Cidade", value: client.city },
    { label: "Endereço", value: client.address },
  ];

  return (
    <main className="app-shell"><AppSidebar current="clients" /><div className="workspace"><section className="directory-page client-profile">
      <header className="client-hero">
        <div className="client-hero-bar"><nav aria-label="Caminho"><Link href="/clientes">CLIENTES</Link><span aria-hidden="true">/</span><span>PERFIL</span></nav><SidebarToggle location="header" /></div>
        <div className="client-hero-main">
          <span className="client-hero-mark" aria-hidden="true">{initialsOf(client.name)}</span>
          <div className="client-hero-identity"><h1>{client.name}</h1><p>{client.company ?? "Pessoa física"}<span aria-hidden="true"> · </span>Cliente desde {date.format(client.createdAt)}</p></div>
          <div className="client-hero-actions"><Link className="primary-action" href={`/documentos?clientId=${client.id}`}>PRODUZIR DOCUMENTO</Link><Link className="secondary-action" href={`/clientes/${client.id}/editar`}>EDITAR CADASTRO</Link>{whatsapp ? <a className="secondary-action" href={whatsapp} target="_blank" rel="noreferrer">WHATSAPP</a> : null}</div>
        </div>
      </header>
      {updated ? <p className="form-success" role="status">Cadastro atualizado.</p> : null}
      <nav className="client-tabs" aria-label="Seções do cliente">{sections.map((section) => <Link key={section} className={activeSection === section ? "active" : undefined} aria-current={activeSection === section ? "page" : undefined} href={profileHref(client.id, section)}>{sectionLabels[section]}{section === "overview" ? null : <b>{sectionCounts[section]}</b>}</Link>)}</nav>
      {activeSection === "overview" ? <section className="client-panel client-overview">
        <div className="client-stats">{(["documents", "projects", "subscriptions", "systems"] as const).map((section) => <Link key={section} className="client-stat" href={profileHref(client.id, section)}><b>{sectionCounts[section]}</b><span>{section === "projects" ? "Serviços ativos" : sectionLabels[section]}</span></Link>)}</div>
        <div className="client-overview-grid">
          <section className="client-block" aria-labelledby="client-contact-title">
            <h2 id="client-contact-title">Contato</h2>
            <dl className="client-facts">{contact.map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd className={fact.value ? undefined : "is-empty"}>{fact.value ?? "Não informado"}</dd></div>)}</dl>
            {client.notes ? <div className="client-notes-block"><h3>Observações</h3><p>{client.notes}</p></div> : null}
          </section>
          <section className="client-block" aria-labelledby="client-recent-title">
            <div className="client-block-heading"><h2 id="client-recent-title">Documentos recentes</h2>{recentDocuments.length ? <Link className="text-link" href={profileHref(client.id, "documents")}>VER TODOS</Link> : null}</div>
            {recentDocuments.length ? <ul className="client-recent">{recentDocuments.map((document) => <li key={document.id}><Link href={document.href}><b>{document.title}</b><small>{document.kind} · {document.code} · {date.format(document.date)}</small></Link><span className={document.done ? "documents-status is-done" : "documents-status"}>{document.done ? "Concluído" : "Pendente"}</span></li>)}</ul> : <div className="client-recent-empty"><p>Nenhum documento ainda.</p><Link className="text-link" href={`/documentos?clientId=${client.id}`}>PRODUZIR O PRIMEIRO DOCUMENTO</Link></div>}
          </section>
        </div>
        <PortalAccessPanel clientId={client.id} clientName={client.name} clientEmail={client.email} portalUrl={clientPortalUrl()} access={client.portalUsers[0] ? { ...client.portalUsers[0], lastLoginAt: client.portalUsers[0].lastLoginAt?.toISOString() ?? null, createdAt: client.portalUsers[0].createdAt.toISOString() } : null} />
      </section> : null}
      {activeSection === "documents" ? <ProfileSection title="Documentos" description="Proposta comercial, contrato, cessão e memorial técnico produzidos para este cliente."><div className="client-documents">{DOCUMENT_KINDS.map((info) => {
        const rows = info.kind === "proposal"
          ? client.quotes.map((quote) => ({ id: quote.id, code: quote.code, title: quote.title, done: Boolean(quote.completedAt), date: quote.createdAt, detail: money.format(quote.amountCents / 100), href: `/orcamentos/${quote.id}/editor`, pdf: `/api/orcamentos/${quote.id}/pdf` }))
          : client.documents.filter((document) => documentKindFromEnum(document.kind).kind === info.kind).map((document) => ({ id: document.id, code: document.code, title: document.title, done: Boolean(document.completedAt), date: document.updatedAt, detail: null, href: `/documentos/${document.id}/editor`, pdf: `/api/documentos/${document.id}/pdf` }));
        return <section className="client-documents-group" key={info.kind} aria-label={info.name}>
          <div className="client-documents-heading"><div><b>{info.name}</b><small>{rows.length ? `${rows.length} ${rows.length === 1 ? "documento" : "documentos"}` : "Nenhum documento ainda"}</small></div><Link className="text-link" href={`/documentos?tipo=${info.slug}&clientId=${client.id}`}>PRODUZIR</Link></div>
          {rows.length ? <ul className="client-doc-list">{rows.map((row) => <li key={row.id}>
            <div className="client-doc-main"><Link href={row.href}>{row.title}</Link><small>{[row.code, row.detail, date.format(row.date)].filter(Boolean).join(" · ")}</small></div>
            <span className={row.done ? "documents-status is-done" : "documents-status"}>{row.done ? "Concluído" : "Pendente"}</span>
            <div className="client-doc-actions"><Link className="table-link" href={row.href}>EDITAR</Link><a className="table-link" href={row.pdf}>PDF</a></div>
          </li>)}</ul> : null}
        </section>;
      })}</div></ProfileSection> : null}
      {activeSection === "projects" ? <ProfileSection title="Serviços ativos" description="Serviços em planejamento, execução ou aguardando retorno."><ProfileTable variant="projects" columns={["SERVIÇO", "SITUAÇÃO", "ENTREGA", "VALOR"]} empty="Nenhum serviço ativo para este cliente.">{client.projects.map((project) => <tr key={project.id}><td>{project.name}</td><td>{projectStatusLabels[project.status] ?? project.status}</td><td>{project.deliveryAt ? date.format(project.deliveryAt) : "A definir"}</td><td>{project.budgetCents ? money.format(project.budgetCents / 100) : "A definir"}</td></tr>)}</ProfileTable></ProfileSection> : null}
      {activeSection === "subscriptions" ? <ProfileSection title="Assinaturas" description="Cobranças recorrentes e situação de cada assinatura." action={<Link className="text-link" href={`/clientes/${client.id}/assinaturas/nova`}>ATRIBUIR SERVIÇO RECORRENTE</Link>}><ProfileTable variant="subscriptions" columns={["ASSINATURA", "SITUAÇÃO", "PRÓXIMO PAGAMENTO", "VALOR"]} empty="Nenhuma assinatura registrada para este cliente.">{client.subscriptions.map((subscription) => <tr key={subscription.id}><td><span>{subscription.name}</span><small>{subscription.serviceCatalogItem?.category.name ?? "Recorrência avulsa"}</small></td><td>{subscriptionStatusLabels[subscription.status] ?? subscription.status}</td><td>{subscription.nextPaymentAt ? date.format(subscription.nextPaymentAt) : "A definir"}</td><td>{money.format(subscription.amountCents / 100)}</td></tr>)}</ProfileTable></ProfileSection> : null}
      {activeSection === "systems" ? <ProfileSection title="Sistemas" description="Sistemas do cliente cadastrados no Monitoramento e o último status de cada um." action={<><Link className="text-link" href="/monitoramento">VINCULAR EXISTENTE</Link><Link className="text-link" href={`/monitoramento/novo?cliente=${client.id}`}>CADASTRAR SISTEMA</Link></>}><ProfileTable variant="systems" columns={["SISTEMA", "AMBIENTE", "STATUS", "ÚLTIMA VERIFICAÇÃO"]} empty="Nenhum sistema vinculado a este cliente.">{client.monitoredApps.map((app) => <tr key={app.id}><td><Link className="client-name" href={`/monitoramento/${app.id}`}>{app.name}</Link><small>{app.url ?? app.healthEndpoint ?? "Endpoint não configurado"}</small></td><td>{monitoringEnvironmentLabel(app.environment)}</td><td><span className={`monitoring-status monitoring-status-${monitoringStatusClass[app.status]}`}><i />{monitoringStatusLabel[app.status]}</span></td><td>{app.lastCheckedAt ? dateTime.format(app.lastCheckedAt) : "Nunca verificado"}</td></tr>)}</ProfileTable></ProfileSection> : null}
    </section></div></main>
  );
}

function ProfileSection({ title, description, action, children }: { title: string; description: string; action?: ReactNode; children: ReactNode }) {
  return <section className="client-panel"><div className="client-panel-heading"><div><h2>{title}</h2><p>{description}</p></div>{action ? <div className="client-panel-actions">{action}</div> : null}</div><div className="client-panel-body">{children}</div></section>;
}

function ProfileTable({ columns, empty, children, variant }: { columns: string[]; empty: string; children: ReactNode; variant: string }) {
  const hasRows = Array.isArray(children) ? children.length > 0 : Boolean(children);
  if (!hasRows) return <div className="client-panel-empty"><p>{empty}</p></div>;
  return <div className={`table-scroll profile-table profile-table-${variant}`}><table><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
}
