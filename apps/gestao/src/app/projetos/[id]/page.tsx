import Link from "next/link";
import { notFound } from "next/navigation";
import { UserRole } from "@prisma/client";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { prisma } from "@/lib/prisma";
import { loadAiRuntime } from "@/features/ai/services/ai-settings";
import { ConfirmSubmitButton } from "@/features/finance/components/confirm-submit-button";
import { ProjectClient } from "@/features/projects/components/project-client";
import { ProjectDiary } from "@/features/projects/components/project-diary";
import { ProjectFields } from "@/features/projects/components/project-form";
import { ProjectPlan } from "@/features/projects/components/project-plan";
import { ProgressBar } from "@/features/projects/components/project-progress";
import { getProject, getProjectTotals, latestProjectJobs, listLinkableQuotes, listProjectLogs, listProjectUpdates } from "@/features/projects/queries/project-queries";
import { deleteProjectAction, updateProjectAction } from "@/features/projects/services/project-actions";
import { hoursLabel, percentOf, projectStatusLabel } from "@/features/projects/types/project";

export const dynamic = "force-dynamic";

const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "America/Maceio" });
const TABS = [{ id: "plano", label: "Plano" }, { id: "diario", label: "Diário" }, { id: "cliente", label: "Cliente" }, { id: "dados", label: "Dados" }] as const;
type Tab = (typeof TABS)[number]["id"];

function notice(code: string | undefined, total: string | undefined) {
  const notices: Record<string, string> = {
    criado: "Projeto criado. Agora descreva o projeto para a Eliza montar o plano, ou crie as funcionalidades.",
    salvo: "Dados do projeto salvos.",
    eliza: "Enviado para a Eliza. O rascunho do plano aparece aqui assim que ficar pronto.",
    plano: `Rascunho aplicado: ${total ?? "as"} ${total === "1" ? "subatividade entrou" : "subatividades entraram"} no plano.`,
    descartado: "Rascunho descartado.",
    "eliza-dia": "Enviado para a Eliza. Confirme as marcações quando elas aparecerem.",
    dia: "Dia registrado no diário.",
    "eliza-atualizacao": "A Eliza está escrevendo a atualização. Ela aparece como rascunho para você revisar.",
    rascunho: "Rascunho salvo. O cliente ainda não vê.",
    publicada: "Atualização publicada: já aparece na área do cliente e o e-mail foi para a fila de envio.",
    "publicada-sem-email": "Atualização publicada. O cliente não tem acesso ao portal, então nenhum e-mail foi enviado.",
    "atualizacao-excluida": "Atualização excluída.",
  };
  return code ? notices[code] ?? null : null;
}

export default async function ProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ aba?: string; aviso?: string; erro?: string; total?: string; dias?: string }> }) {
  const { id } = await params;
  const query = await searchParams;
  const project = await getProject(id);
  if (!project) notFound();
  const tabs = TABS.filter((tab) => tab.id !== "cliente" || project.client);
  const tab: Tab = tabs.some((item) => item.id === query.aba) ? query.aba as Tab : "plano";
  const [totals, jobs, ai] = await Promise.all([getProjectTotals(project.id), latestProjectJobs(project.id), loadAiRuntime()]);
  const percent = percentOf(project.doneWeight, project.totalWeight);
  const taskTotal = Object.values(totals.byStatus).reduce<number>((sum, count) => sum + (count ?? 0), 0);
  const message = notice(query.aviso, query.total);
  const tabHref = (target: Tab) => `/projetos/${project.id}${target === "plano" ? "" : `?aba=${target}`}`;

  let content: React.ReactNode = null;
  if (tab === "plano") content = <ProjectPlan project={project} job={jobs.plan} aiReady={ai.ok} />;
  else if (tab === "diario") {
    const { data: logs, nextCursor } = await listProjectLogs(project.id, query.dias);
    content = <ProjectDiary project={project} job={jobs.day} aiReady={ai.ok} logs={logs} nextHref={nextCursor ? `/projetos/${project.id}?aba=diario&dias=${nextCursor}` : null} />;
  } else if (tab === "cliente" && project.client) {
    const [updates, access] = await Promise.all([listProjectUpdates(project.id), prisma.user.count({ where: { clientId: project.client.id, role: UserRole.CLIENT, isActive: true } })]);
    content = <ProjectClient project={project} job={jobs.update} aiReady={ai.ok} updates={updates} hasPortalAccess={access > 0} />;
  } else if (tab === "dados") {
    const quotes = project.client ? await listLinkableQuotes(project.client.id, project.id) : [];
    content = <>
      <form className="client-form settings-panel project-data-form" action={updateProjectAction}>
        <input type="hidden" name="projectId" value={project.id} />
        <section><p className="eyebrow">DADOS DO PROJETO</p><ProjectFields values={{ name: project.name, description: project.description, status: project.status, startedAt: project.startedAt, deliveryAt: project.deliveryAt, client: project.client, quoteId: project.quotes[0]?.id ?? null }} quotes={quotes} /></section>
        <div className="form-actions"><span /><button className="primary-action" type="submit">SALVAR DADOS</button></div>
      </form>
      <section className="settings-panel"><div className="settings-panel-heading"><div><h2>Excluir projeto.</h2><p>Apaga o plano, o diário e as atualizações (inclusive da área do cliente). Orçamentos, vendas e cobranças ligados a ele continuam existindo.</p></div><form><input type="hidden" name="projectId" value={project.id} /><ConfirmSubmitButton className="danger-action" formAction={deleteProjectAction} message={`Excluir o projeto "${project.name}"? Esta ação não pode ser desfeita.`}>EXCLUIR PROJETO</ConfirmSubmitButton></form></div></section>
    </>;
  }

  return <main className="app-shell"><AppSidebar current="projects" /><div className="workspace"><section className="directory-page project-page">
    <header className="directory-header"><div><p className="eyebrow">PROJETOS / {project.client ? (project.client.company ?? project.client.name).toUpperCase() : "PESSOAL"}</p><h1>{project.name}</h1><p><span className={`project-status is-${project.status.toLowerCase().replace("_", "-")}`}>{projectStatusLabel[project.status]}</span>{project.client ? <> · <Link className="text-link-inline" href={`/clientes/${project.client.id}`}>{project.client.name}</Link></> : " · Projeto pessoal"}{project.quotes[0] ? <> · <Link className="text-link-inline" href={`/orcamentos/${project.quotes[0].id}`}>{project.quotes[0].code}</Link></> : null}</p></div><div className="header-actions"><SidebarToggle location="header" /><Link className="text-link" href="/projetos">VOLTAR PARA PROJETOS</Link></div></header>

    <section className="project-summary" aria-label="Resumo do projeto">
      <div className="project-summary-progress"><span>CONCLUÍDO</span><ProgressBar percent={percent} label="Concluído no projeto" /><small>{taskTotal ? `${totals.byStatus.DONE ?? 0} de ${taskTotal} subatividades · peso ${project.doneWeight} de ${project.totalWeight}` : "Sem plano ainda"}</small></div>
      <div><span>EM ANDAMENTO</span><strong>{totals.byStatus.DOING ?? 0}</strong><small>{(totals.byStatus.WAITING_CLIENT ?? 0) + (totals.byStatus.BLOCKED ?? 0) ? `${totals.byStatus.WAITING_CLIENT ?? 0} aguardando cliente · ${totals.byStatus.BLOCKED ?? 0} bloqueadas` : "Nada parado"}</small></div>
      <div><span>ENTREGA PREVISTA</span><strong>{project.deliveryAt ? date.format(project.deliveryAt) : "A definir"}</strong><small>{project.startedAt ? `Início em ${date.format(project.startedAt)}` : "Ainda não iniciado"}</small></div>
      <div><span>HORAS REGISTRADAS</span><strong>{totals.minutes ? hoursLabel(totals.minutes) : "0 h"}</strong><small>{totals.logs} {totals.logs === 1 ? "dia no diário" : "dias no diário"}</small></div>
    </section>

    <nav className="client-tabs" aria-label="Seções do projeto">{tabs.map((item) => <Link key={item.id} className={item.id === tab ? "active" : undefined} aria-current={item.id === tab ? "page" : undefined} href={tabHref(item.id)}>{item.label}</Link>)}</nav>
    {message ? <p className="form-success" role="status">{message}</p> : null}
    {query.erro ? <p className="form-error project-error" role="alert">{query.erro.slice(0, 300)}</p> : null}
    {content}
  </section></div></main>;
}
