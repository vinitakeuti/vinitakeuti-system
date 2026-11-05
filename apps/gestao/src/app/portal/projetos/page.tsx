import { PortalShell } from "@/features/client-portal/components/portal-shell";
import { day } from "@/features/client-portal/components/portal-format";
import { getPortalContext, getPortalProjects } from "@/features/client-portal/queries/portal-queries";
import { ProgressBar } from "@/features/projects/components/project-progress";
import { percentOf } from "@/features/projects/types/project";

export const dynamic = "force-dynamic";

const projectStatus: Record<string, string> = { PROPOSAL: "Proposta", PLANNING: "Planejamento", IN_PROGRESS: "Em execução", WAITING_CLIENT: "Aguardando você", DELIVERED: "Entregue", PAUSED: "Pausado" };

/** Andamento dos projetos do cliente: percentual, funcionalidades e as atualizações publicadas. */
export default async function PortalProjectsPage() {
  const context = await getPortalContext();
  const projects = await getPortalProjects(context.clientId);

  return <PortalShell context={context} current="projects" section="Projetos" title="Andamento dos projetos" description="Quanto de cada projeto já foi concluído, as partes que o compõem e as novidades de cada etapa.">
    {!projects.length ? <section className="settings-panel"><p className="settings-empty">Nenhum projeto em andamento. Quando um projeto começar, você acompanha o andamento por aqui.</p></section> : null}

    {projects.map((project) => {
      const percent = percentOf(project.doneWeight, project.totalWeight);
      return <section className="settings-panel portal-project" key={project.id} aria-labelledby={`portal-project-${project.id}`}>
        <div className="settings-panel-heading"><div><h2 id={`portal-project-${project.id}`}>{project.name}</h2><p>{project.deliveryAt ? `${project.status === "DELIVERED" ? "Entregue" : "Entrega prevista"} em ${day(project.deliveryAt)}` : project.startedAt ? `Iniciado em ${day(project.startedAt)}` : "Data de entrega a definir"}{project.description ? ` · ${project.description}` : ""}</p></div><span className={`portal-tag ${project.status === "DELIVERED" ? "is-ok" : project.status === "WAITING_CLIENT" ? "is-soon" : ""}`}>{projectStatus[project.status] ?? project.status}</span></div>
        {project.totalWeight ? <div className="portal-project-progress"><span>Concluído</span><ProgressBar percent={percent} label={`Concluído em ${project.name}`} /></div> : <p className="settings-empty">O planejamento das etapas está sendo preparado.</p>}
        {project.features.length ? <ul className="portal-project-features">{project.features.map((feature) => <li key={feature.id}><div><b>{feature.title}</b>{feature.description ? <small>{feature.description}</small> : null}</div><ProgressBar percent={percentOf(feature.doneWeight, feature.totalWeight)} size="small" label={`Andamento de ${feature.title}`} /></li>)}</ul> : null}
        {project.updates.length ? <div className="portal-project-updates"><p className="eyebrow">Atualizações</p><ol>{project.updates.map((update) => <li key={update.id}><div className="portal-project-update-meta"><b>{update.title}</b><span>{update.publishedAt ? day(update.publishedAt) : ""}{update.progressPercent !== null ? ` · ${update.progressPercent}% concluído` : ""}</span></div><p>{update.body}</p></li>)}</ol></div> : null}
      </section>;
    })}
  </PortalShell>;
}
