import Link from "next/link";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { listClients } from "@/features/clients/queries/client-queries";

export const dynamic = "force-dynamic";

type ClientsPageProps = { searchParams: Promise<{ cursor?: string; q?: string }> };

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  const { cursor, q } = await searchParams;
  const { data: clients, nextCursor } = await listClients({ cursor, query: q });
  const nextHref = nextCursor ? `/clientes?${new URLSearchParams({ ...(q ? { q } : {}), cursor: nextCursor })}` : null;

  return (
    <main className="app-shell"><AppSidebar current="clients" /><div className="workspace"><section className="directory-page">
      <header className="directory-header"><div><p className="eyebrow">RELACIONAMENTO / BASE</p><h1>Clientes.</h1><p>Perfis que concentram serviços, orçamentos, assinaturas e pagamentos.</p></div><div className="header-actions"><SidebarToggle location="header" /><Link className="primary-action" href="/clientes/novo">NOVO CLIENTE</Link></div></header>
      <section className="directory-surface" aria-label="Lista de clientes">
        <form className="client-search" action="/clientes"><div className="search-control"><label htmlFor="client-query">BUSCAR CLIENTE</label><input id="client-query" name="q" defaultValue={q ?? ""} placeholder="Nome, empresa ou e-mail" /></div><button type="submit">BUSCAR</button></form>
        {clients.length ? <div className="table-scroll"><table><thead><tr><th>CLIENTE</th><th>CONTATO</th><th>ORÇAMENTOS</th><th>SERVIÇOS</th><th>ASSINATURAS</th><th /></tr></thead><tbody>
          {clients.map((client) => <tr key={client.id}><td><Link className="client-name" href={`/clientes/${client.id}`}>{client.name}</Link><small>{client.company ?? "Pessoa física"}</small></td><td><span>{client.email ?? "E-mail não informado"}</span><small>{client.phone ?? "Telefone não informado"}</small></td><td>{client._count.quotes}</td><td>{client._count.projects}</td><td>{client._count.subscriptions}</td><td><Link className="table-link" href={`/clientes/${client.id}`}>ABRIR</Link></td></tr>)}
        </tbody></table></div> : null}
        {clients.length ? <div className="client-mobile-list">{clients.map((client) => <Link className="client-mobile-row" href={`/clientes/${client.id}`} key={client.id}><div className="client-mobile-primary"><b>{client.name}</b><span>{client.company ?? "Pessoa física"}</span><small>{client.email ?? client.phone ?? "Contato não informado"}</small></div><div className="client-mobile-counts"><div><b>{client._count.quotes}</b><span>ORÇ.</span></div><div><b>{client._count.projects}</b><span>SERV.</span></div><div><b>{client._count.subscriptions}</b><span>ASS.</span></div></div></Link>)}</div> : <div className="directory-empty"><p>Nenhum cliente encontrado.</p><span>Cadastre o primeiro perfil para centralizar orçamentos, serviços e cobranças.</span><Link className="text-link" href="/clientes/novo">CADASTRAR CLIENTE</Link></div>}
        {nextHref ? <div className="table-footer"><Link className="text-link" href={nextHref}>CARREGAR PRÓXIMOS 50</Link></div> : null}
      </section>
    </section></div></main>
  );
}
