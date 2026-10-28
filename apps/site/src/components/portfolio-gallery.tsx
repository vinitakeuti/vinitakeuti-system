"use client";

import { useState } from "react";
import { Arrow } from "@/components/arrow";
import { ProjectInspector, type InspectorLayer, type InspectorMedia } from "@/components/portfolio-inspector";

export type GalleryProject = {
  id: string; sample?: boolean; title: string; category: string; year: string; client: string; ratio?: string;
  media: readonly InspectorMedia[]; architectureMedia?: { src: string; alt: string };
  stack?: readonly { group: string; items: readonly string[] }[]; link?: { href: string; label: string };
  summary: string; problem: string; solution: string; result: string; architecture: readonly InspectorLayer[];
};

const pad = (value: number) => String(value).padStart(2, "0");
const TABS = [["problem", "Problema"], ["solution", "Solução"], ["result", "Resultado"], ["stack", "Tecnologia"]] as const;
type Tab = (typeof TABS)[number][0];

/** Um projeto da galeria: informações com abas (problema, solução, resultado e tecnologia) e o raio-x da arquitetura. */
function Panel({ project, index }: { project: GalleryProject; index: number }) {
  const [tab, setTab] = useState<Tab>("problem");
  const stack = project.stack ?? project.architecture.map((layer) => ({ group: layer.layer, items: layer.tech }));
  const technologies = stack.reduce((total, group) => total + group.items.length, 0);
  return <article className="pf-panel reveal" aria-labelledby={`projeto-${project.id}`}>
    <div className="pf-panel-info">
      <span className="pf-panel-index" aria-hidden="true">{pad(index + 1)}</span>
      {project.sample ? <p className="pf-sample">PROJETO ILUSTRATIVO</p> : null}
      <p className="site-tag">{[project.category.toUpperCase(), project.year].filter(Boolean).join(" · ")}</p>
      <h3 id={`projeto-${project.id}`}>{project.title}</h3>
      <p className="pf-panel-client">{project.client}</p>
      <p className="pf-panel-summary">{project.summary}</p>
      <div className="pf-panel-tabs" role="tablist" aria-label={`Sobre ${project.title}`}>
        {TABS.map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}>{label}</button>)}
      </div>
      {tab === "stack"
        ? <dl className="pf-panel-stack" role="tabpanel" aria-label={`Stack de ${project.title}`}>{stack.map((group) => <div key={group.group}><dt>{group.group}</dt><dd>{group.items.map((name) => <span key={name}>{name}</span>)}</dd></div>)}</dl>
        : <p className="pf-panel-text" role="tabpanel" key={tab}>{project[tab]}</p>}
      <p className="pf-panel-stats"><b>{project.architecture.length}</b> camadas<span>·</span><b>{technologies}</b> tecnologias</p>
      {project.link ? <a className="pf-panel-link" href={project.link.href} target="_blank" rel="noreferrer">Conhecer o site<span>{project.link.label}</span><Arrow /></a> : null}
    </div>
    <ProjectInspector title={project.title} host={`${project.id}.app`} media={project.media} architecture={project.architecture} architectureMedia={project.architectureMedia} ratio={project.ratio} />
  </article>;
}

/** Projetos empilhados na rolagem normal da página, alternando o lado da tela e da descrição. */
export function PortfolioGallery({ projects }: { projects: readonly GalleryProject[] }) {
  return <section className="pf-gallery" id="projetos" aria-labelledby="projetos-title">
    <div className="pf-gallery-head">
      <h2 id="projetos-title">Projetos</h2>
      <p>{pad(projects.length)} projetos</p>
    </div>
    <div className="pf-gallery-list">
      {projects.map((project, index) => <Panel key={project.id} project={project} index={index} />)}
    </div>
  </section>;
}
