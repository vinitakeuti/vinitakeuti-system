import Link from "next/link";
import { ConfirmSubmitButton } from "@/features/finance/components/confirm-submit-button";
import { JobRefresher } from "@/features/projects/components/job-refresher";
import type { ProjectDetail } from "@/features/projects/queries/project-queries";
import { applyDayAction, discardJobAction, registerDayAction } from "@/features/projects/services/project-actions";
import type { DayDraft } from "@/features/projects/services/project-ai";
import { PROJECT_LIMITS, hoursLabel, todayKey } from "@/features/projects/types/project";

type Job = { id: string; status: string; input: string; day: Date | null; minutes: number | null; result: unknown; error: string | null } | null;
type Log = { id: string; day: Date; summary: string; minutes: number | null; tasks: unknown; source: string };

const longDay = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const hoursInput = (minutes: number | null) => minutes ? String(Math.round((minutes / 60) * 100) / 100).replace(".", ",") : "";

/** Diário: registrar o dia (com ou sem a Eliza), revisar as marcações propostas e o histórico. */
export function ProjectDiary({ project, job, aiReady, logs, nextHref }: { project: ProjectDetail; job: Job; aiReady: boolean; logs: Log[]; nextHref: string | null }) {
  const taskById = new Map(project.features.flatMap((feature) => feature.tasks.map((task) => [task.id, { title: task.title, feature: feature.title }] as const)));
  const hasOpenTasks = project.features.some((feature) => feature.tasks.some((task) => task.status !== "DONE"));
  const working = job && (job.status === "PENDING" || job.status === "RUNNING");

  let review = null;
  if (working) review = <section className="settings-panel project-eliza is-working" aria-live="polite"><JobRefresher /><div className="settings-panel-heading"><div><h2>A Eliza está lendo o seu dia</h2><p>Ela compara o resumo com as subatividades em aberto. Em instantes as marcações aparecem aqui para você confirmar.</p></div><span className="project-working" aria-hidden="true"><i /><i /><i /></span></div></section>;
  else if (job?.status === "READY") {
    const draft = job.result as DayDraft;
    const row = (id: string, name: string) => {
      const task = taskById.get(id);
      return task ? <li key={`${name}-${id}`}><label><input type="checkbox" name={`${name}-${id}`} defaultChecked /><span>{task.title}<small>{task.feature}</small></span></label></li> : null;
    };
    review = <section className="settings-panel project-eliza is-draft">
      <div className="settings-panel-heading"><div><p className="eyebrow">Marcações propostas pela Eliza</p><h2>Confirme o seu dia</h2><p>Desmarque o que não estiver certo. Ao confirmar, as subatividades são atualizadas e o dia entra no diário.</p></div></div>
      <form action={applyDayAction} className="project-draft-form">
        <input type="hidden" name="jobId" value={job.id} />
        <div className="project-day-review">
          <div><b>Concluídas</b>{draft.done.length ? <ul className="project-day-list">{draft.done.map((id) => row(id, "done"))}</ul> : <p>Nenhuma subatividade dada como concluída.</p>}</div>
          <div><b>Em andamento</b>{draft.doing.length ? <ul className="project-day-list">{draft.doing.map((id) => row(id, "doing"))}</ul> : <p>Nenhuma.</p>}</div>
        </div>
        {draft.notFound.length ? <div className="project-draft-notes"><b>Citado no resumo, mas sem subatividade no plano</b><ul>{draft.notFound.map((item) => <li key={item}>{item}</li>)}</ul><p>Se for trabalho do projeto, crie a subatividade no Plano.</p></div> : null}
        <div className="project-day-fields"><label className="project-field-wide">Resumo do dia<textarea name="summary" defaultValue={job.input} maxLength={PROJECT_LIMITS.summary} rows={4} /></label><label>Horas<input name="hours" defaultValue={hoursInput(job.minutes)} inputMode="decimal" placeholder="Ex.: 3,5" /></label></div>
        <div className="project-form-actions"><ConfirmSubmitButton className="text-link project-danger-link" formAction={discardJobAction} message="Descartar as marcações da Eliza? O dia não é registrado.">Descartar</ConfirmSubmitButton><button className="primary-action" type="submit">Confirmar e registrar o dia</button></div>
      </form>
    </section>;
  }

  return <>
    {review}
    {!working && job?.status !== "READY" ? <section className="settings-panel" aria-labelledby="project-day-title">
      <div className="settings-panel-heading"><div><h2 id="project-day-title">Registrar o dia</h2><p>Escreva o que fez hoje neste projeto. {aiReady ? "A Eliza pode identificar quais subatividades você terminou e propor as marcações." : "As subatividades que você marcou como feitas hoje entram junto no registro."}</p></div></div>
      <form action={registerDayAction} className="project-day-form">
        <input type="hidden" name="projectId" value={project.id} />
        {job?.status === "FAILED" ? <p className="form-error">A Eliza não concluiu a leitura do último resumo: {job.error ?? "erro desconhecido"}.</p> : null}
        <div className="project-day-fields">
          <label className="project-field-wide">Resumo do dia<textarea name="summary" required maxLength={PROJECT_LIMITS.summary} rows={5} defaultValue={job?.status === "FAILED" ? job.input : ""} placeholder="Ex.: Terminei a tela de login e o cadastro de usuários. Comecei a integração com o Asaas, falta o webhook." /></label>
          <label>Dia<input name="day" type="date" defaultValue={todayKey()} max={todayKey()} /></label>
          <label>Horas<input name="hours" inputMode="decimal" placeholder="Ex.: 3,5" defaultValue={job?.status === "FAILED" ? hoursInput(job.minutes) : ""} /></label>
        </div>
        <div className="project-eliza-options">{aiReady && hasOpenTasks ? <label className="project-check-option"><input type="checkbox" name="withEliza" defaultChecked />Pedir para a Eliza marcar as subatividades</label> : <span />}<button className="primary-action" type="submit">Registrar o dia</button></div>
      </form>
    </section> : null}

    <section className="settings-panel" aria-labelledby="project-diary-title">
      <div className="settings-panel-heading"><div><h2 id="project-diary-title">Diário</h2><p>O histórico do projeto, dia a dia. É a base das atualizações para o cliente.</p></div></div>
      {logs.length ? <ol className="project-diary">{logs.map((log) => {
        const tasks = Array.isArray(log.tasks) ? log.tasks as { id: string; title: string; feature?: string }[] : [];
        return <li key={log.id}>
          <div className="project-diary-meta"><b>{longDay.format(log.day)}</b><span>{log.minutes ? hoursLabel(log.minutes) : "Sem horas"}{log.source === "ELIZA" ? " · marcado com a Eliza" : ""}</span></div>
          <p>{log.summary}</p>
          {tasks.length ? <ul className="project-diary-tasks">{tasks.map((task) => <li key={task.id}>{task.title}{task.feature ? <small>{task.feature}</small> : null}</li>)}</ul> : null}
        </li>;
      })}</ol> : <p className="settings-empty">Nenhum dia registrado ainda.</p>}
      {nextHref ? <div className="table-footer"><Link className="text-link" href={nextHref}>Carregar dias anteriores</Link></div> : null}
    </section>
  </>;
}
