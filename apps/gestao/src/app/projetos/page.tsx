import Link from "next/link";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { ProgressBar } from "@/features/projects/components/project-progress";
import { listProjects, type ProjectKindFilter, type ProjectListFilter } from "@/features/projects/queries/project-queries";
import { percentOf, projectStatusLabel } from "@/features/projects/types/project";

export const dynamic = "force-dynamic";

const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "America/Maceio" });
const FILTERS: { id: ProjectListFilter; label: string }[] = [{ id: "ativos", label: "Em andamento" }, { id: "entregues", label: "Entregues" }, { id: "todos", label: "Todos" }];
const KINDS: { id: ProjectKindFilter; label: string }[] = [{ id: "todos", label: "Clientes e pessoais" }, { id: "clientes", label: "De clientes" }, { id: "pessoais", label: "Pessoais" }];

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ cursor?: string; filtro?: string; tipo?: string; q?: string; excluido?: string }> }) {
  const params = await searchParams;
  const filter = FILTERS.some((item) => item.id === params.filtro) ? params.filtro as ProjectListFilter : "ativos";
  const kind = KINDS.some((item) => item.id === params.tipo) ? params.tipo as ProjectKindFilter : "todos";
  const { data: projects, nextCursor } = await listProjects({ cursor: params.cursor, filter, kind, query: params.q });
  const href = (changes: Record<string, string | undefined>) => {
    const query = new URLSearchParams(Object.entries({ filtro: filter === "ativos" ? undefined : filter, tipo: kind === "todos" ? undefined : kind, q: params.q, ...changes }).filter((entry): entry is [string, string] => Boolean(entry[1])));
    return query.size ? `/projetos?${query}` : "/projetos";
  };

  return <main className="app-shell"><AppSidebar current="projects" /><div className="workspace"><section className="directory-page projects-page">
    <header className="directory-header"><div><p className="eyebrow">OPERAÇÃO / PROJETOS</p><h1>Projetos.</h1><p>O que está em andamento em cada projeto, de clientes e pessoais, e quanto do plano já foi concluído.</p></div><div className="header-actions"><SidebarToggle location="header" /><Link className="primary-action" href="/projetos/novo">NOVO PROJETO</Link></div></header>
    {params.excluido ? <p className="form-success" role="status">Projeto excluído: {params.excluido.slice(0, 160)}.</p> : null}
    <nav className="client-tabs" aria-label="Situação">{FILTERS.map((item) => <Link key={item.id} className={item.id === filter ? "active" : undefined} aria-current={item.id === filter ? "page" : undefined} href={href({ filtro: item.id === "ativos" ? undefined : item.id, cursor: undefined })}>{item.label}</Link>)}</nav>
    <section className="directory-surface" aria-label="Lista de projetos">
      <form className="client-search projects-search" action="/projetos">{filter !== "ativos" ? <input type="hidden" name="filtro" value={filter} /> : null}<div className="search-control"><label htmlFor="project-query">BUSCAR PROJETO</label><input id="project-query" name="q" defaultValue={params.q ?? ""} placeholder="Projeto ou cliente" /></div><div className="search-control"><label htmlFor="project-kind">TIPO</label><select id="project-kind" name="tipo" defaultValue={kind}>{KINDS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div><button type="submit">BUSCAR</button></form>
      {projects.length ? <>
        <div className="table-scroll projects-table"><table><thead><tr><th>PROJETO</th><th>SITUAÇÃO</th><th>PROGRESSO</th><th>ENTREGA</th><th>ATUALIZADO</th></tr></thead><tbody>
          {projects.map((project) => <tr key={project.id}><td><Link className="client-name" href={`/projetos/${project.id}`}>{project.name}</Link><small>{project.client ? project.client.company ?? project.client.name : "Pessoal"}</small></td><td><span className={`project-status is-${project.status.toLowerCase().replace("_", "-")}`}>{projectStatusLabel[project.status]}</span></td><td>{project._count.tasks ? <ProgressBar percent={percentOf(project.doneWeight, project.totalWeight)} /> : <small className="project-muted">Sem plano</small>}</td><td>{project.deliveryAt ? date.format(project.deliveryAt) : "A definir"}</td><td>{date.format(project.updatedAt)}</td></tr>)}
        </tbody></table></div>
        <div className="client-mobile-list">{projects.map((project) => <Link className="client-mobile-row project-mobile-row" href={`/projetos/${project.id}`} key={project.id}><div className="client-mobile-primary"><b>{project.name}</b><span>{project.client ? project.client.company ?? project.client.name : "Pessoal"}</span><small>{projectStatusLabel[project.status]}{project.deliveryAt ? ` · entrega ${date.format(project.deliveryAt)}` : ""}</small></div>{project._count.tasks ? <ProgressBar percent={percentOf(project.doneWeight, project.totalWeight)} size="small" /> : null}</Link>)}</div>
      </> : <div className="directory-empty"><p>{params.q ? "Nenhum projeto encontrado." : filter === "entregues" ? "Nenhum projeto entregue ainda." : "Nenhum projeto em andamento."}</p><span>Crie um projeto, cole a descrição e a Eliza monta o plano com as funcionalidades e subatividades.</span><Link className="text-link" href="/projetos/novo">CRIAR PROJETO</Link></div>}
      {nextCursor ? <div className="table-footer"><Link className="text-link" href={href({ cursor: nextCursor })}>CARREGAR PRÓXIMOS 50</Link></div> : null}
    </section>
  </section></div></main>;
}
