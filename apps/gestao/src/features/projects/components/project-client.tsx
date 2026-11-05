import Link from "next/link";
import { ConfirmSubmitButton } from "@/features/finance/components/confirm-submit-button";
import { JobRefresher } from "@/features/projects/components/job-refresher";
import { ProgressBar } from "@/features/projects/components/project-progress";
import type { ProjectDetail } from "@/features/projects/queries/project-queries";
import { createUpdateAction, deleteUpdateAction, requestUpdateAction, saveUpdateAction } from "@/features/projects/services/project-actions";
import { percentOf } from "@/features/projects/types/project";

type Job = { id: string; status: string; error: string | null } | null;
type Update = { id: string; title: string; body: string; status: string; progressPercent: number | null; publishedAt: Date | null; emailedAt: Date | null; createdAt: Date };

const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Maceio" });

/** O que o cliente vê no portal (funcionalidades e percentual) e as atualizações: rascunhos para aprovar e publicadas. */
export function ProjectClient({ project, job, aiReady, updates, hasPortalAccess }: { project: ProjectDetail; job: Job; aiReady: boolean; updates: Update[]; hasPortalAccess: boolean }) {
  const drafts = updates.filter((update) => update.status === "DRAFT");
  const published = updates.filter((update) => update.status === "PUBLISHED");
  const working = job && (job.status === "PENDING" || job.status === "RUNNING");

  return <>
    <section className="settings-panel" aria-labelledby="project-portal-title">
      <div className="settings-panel-heading"><div><h2 id="project-portal-title">O que o cliente vê</h2><p>Na área do cliente, em Projetos: a situação, o percentual e as funcionalidades com o andamento de cada uma. As subatividades e o diário nunca aparecem para ele.</p></div>{hasPortalAccess ? null : <Link className="text-link" href={`/clientes/${project.client?.id ?? ""}`}>Criar acesso ao portal</Link>}</div>
      {!hasPortalAccess ? <p className="project-callout">Este cliente ainda não tem acesso à área do cliente. As atualizações publicadas ficam guardadas, mas só chegam a ele (portal e e-mail) depois que o acesso for criado no perfil do cliente.</p> : null}
      {project.features.length ? <ul className="project-portal-preview">{project.features.map((feature) => {
        const total = feature.tasks.reduce((sum, task) => sum + task.weight, 0);
        const done = feature.tasks.filter((task) => task.status === "DONE").reduce((sum, task) => sum + task.weight, 0);
        return <li key={feature.id}><span>{feature.title}</span><ProgressBar percent={percentOf(done, total)} size="small" label={`Andamento de ${feature.title}`} /></li>;
      })}</ul> : <p className="settings-empty">O plano ainda não tem funcionalidades.</p>}
    </section>

    <section className="settings-panel" aria-labelledby="project-updates-title">
      <div className="settings-panel-heading"><div><h2 id="project-updates-title">Atualizações</h2><p>Nada chega ao cliente sem a sua aprovação. Toda sexta, a partir das 16 h, a Eliza prepara um rascunho com o que entrou no diário na semana.</p></div></div>
      {working ? <div className="project-callout is-working" aria-live="polite"><JobRefresher /><span className="project-working" aria-hidden="true"><i /><i /><i /></span>A Eliza está escrevendo a atualização a partir do diário. Em instantes ela aparece aqui como rascunho.</div> : null}
      {job?.status === "FAILED" ? <p className="form-error project-callout">A Eliza não concluiu a última atualização: {job.error ?? "erro desconhecido"}.</p> : null}

      {drafts.map((update) => <form key={update.id} action={saveUpdateAction} className="project-update-draft">
        <input type="hidden" name="projectId" value={project.id} /><input type="hidden" name="updateId" value={update.id} />
        <p className="eyebrow">Rascunho · {dateTime.format(update.createdAt)}</p>
        <label>Título<input name="title" defaultValue={update.title} required maxLength={160} /></label>
        <label>Texto para o cliente<textarea name="body" defaultValue={update.body} required maxLength={4_000} rows={7} /></label>
        <div className="project-form-actions"><ConfirmSubmitButton className="text-link project-danger-link" formAction={deleteUpdateAction} message="Excluir este rascunho?">Excluir</ConfirmSubmitButton><span><button className="secondary-action" type="submit">Salvar rascunho</button><button className="primary-action" type="submit" name="publish" value="1">{hasPortalAccess ? "Publicar e avisar o cliente" : "PUBLICAR"}</button></span></div>
      </form>)}

      {!working && !drafts.length ? <div className="project-update-new">
        {aiReady ? <form action={requestUpdateAction} className="project-inline-form"><input type="hidden" name="projectId" value={project.id} /><label>Orientação para a Eliza (opcional)<input name="guidance" maxLength={1_000} placeholder="Ex.: destacar que o painel já pode ser testado" /></label><button className="primary-action" type="submit">Gerar com a Eliza</button></form> : null}
        <details className="project-eliza-more"><summary><span><b>Escrever a atualização</b><small>Sem a Eliza: você escreve e publica quando quiser.</small></span><i aria-hidden="true" /></summary>
          <form action={createUpdateAction} className="project-update-draft"><input type="hidden" name="projectId" value={project.id} /><label>Título<input name="title" required maxLength={160} placeholder="Ex.: Cadastro de clientes concluído" /></label><label>Texto para o cliente<textarea name="body" required maxLength={4_000} rows={6} /></label><div className="project-form-actions"><span /><button className="secondary-action" type="submit">Salvar rascunho</button></div></form>
        </details>
      </div> : null}

      {published.length ? <ol className="project-updates">{published.map((update) => <li key={update.id}>
        <div className="project-diary-meta"><b>{update.title}</b><span>{update.publishedAt ? dateTime.format(update.publishedAt) : ""}{update.progressPercent !== null ? ` · ${update.progressPercent}% concluído` : ""} · {update.emailedAt ? "e-mail enviado" : "sem e-mail"}</span></div>
        <p>{update.body}</p>
        <form><input type="hidden" name="projectId" value={project.id} /><input type="hidden" name="updateId" value={update.id} /><ConfirmSubmitButton className="text-link project-danger-link" formAction={deleteUpdateAction} message="Excluir esta atualização? Ela some da área do cliente (o e-mail já enviado não volta).">Excluir</ConfirmSubmitButton></form>
      </li>)}</ol> : !drafts.length ? <p className="settings-empty">Nenhuma atualização publicada ainda.</p> : null}
    </section>
  </>;
}
