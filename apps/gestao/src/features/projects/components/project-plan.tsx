import Link from "next/link";
import { CountedTextarea } from "@/features/ai/components/counted-textarea";
import { ConfirmSubmitButton } from "@/features/finance/components/confirm-submit-button";
import { JobRefresher } from "@/features/projects/components/job-refresher";
import { ProgressBar } from "@/features/projects/components/project-progress";
import { SubmitOnChangeSelect } from "@/features/projects/components/submit-on-change";
import type { ProjectDetail } from "@/features/projects/queries/project-queries";
import { addFeatureAction, addTaskAction, applyPlanAction, deleteFeatureAction, deleteTaskAction, discardJobAction, moveFeatureAction, requestPlanAction, toggleTaskAction, updateFeatureAction, updateTaskAction } from "@/features/projects/services/project-actions";
import type { PlanDraft } from "@/features/projects/services/project-service";
import { PROJECT_LIMITS, TASK_SIZES, TASK_STATUS_OPTIONS, percentOf, sizeOfWeight, taskStatusLabel } from "@/features/projects/types/project";

type Job = { id: string; status: string; input: string; result: unknown; error: string | null } | null;

const sizeOptions = TASK_SIZES.map((size) => ({ value: size.id, label: size.id }));
const statusOptions = TASK_STATUS_OPTIONS.map((status) => ({ value: status, label: taskStatusLabel[status] }));
const pad = (value: number) => String(value).padStart(2, "0");

function CheckIcon() {
  return <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" /></svg>;
}

/** Caixa da Eliza: acompanhar, revisar o rascunho (mesmo com a IA desligada depois) ou pedir o plano. */
function ElizaPlanBox({ projectId, job, aiReady, quoteCode, hasPlan }: { projectId: string; job: Job; aiReady: boolean; quoteCode: string | null; hasPlan: boolean }) {
  if (job && (job.status === "PENDING" || job.status === "RUNNING")) return <section className="settings-panel project-eliza is-working" aria-live="polite"><JobRefresher /><div className="settings-panel-heading"><div><h2>A Eliza está montando o plano.</h2><p>Ela está lendo a descrição e separando as funcionalidades e subatividades. Projetos grandes levam um ou dois minutos; esta tela se atualiza sozinha.</p></div><span className="project-working" aria-hidden="true"><i /><i /><i /></span></div></section>;

  if (job?.status === "READY") {
    const draft = job.result as PlanDraft;
    const tasks = draft.features.reduce((sum, feature) => sum + feature.tasks.length, 0);
    return <section className="settings-panel project-eliza is-draft">
      <div className="settings-panel-heading"><div><p className="eyebrow">RASCUNHO DA ELIZA</p><h2>Revise antes de aplicar.</h2><p>{draft.features.length} {draft.features.length === 1 ? "funcionalidade" : "funcionalidades"} e {tasks} subatividades. Desmarque o que não fizer sentido e ajuste os pesos; o que ficar marcado entra no plano.</p></div></div>
      <form action={applyPlanAction} className="project-draft-form">
        <input type="hidden" name="jobId" value={job.id} />
        {draft.notes ? <div className="project-draft-notes"><b>Pontos em aberto</b><p>{draft.notes}</p></div> : null}
        <ol className="project-draft">{draft.features.map((feature, featureIndex) => <li key={featureIndex}>
          <label className="project-draft-feature"><input type="checkbox" name={`f-${featureIndex}`} defaultChecked /><span><b>{feature.title}</b>{feature.description ? <small>{feature.description}</small> : null}</span></label>
          <ul>{feature.tasks.map((task, taskIndex) => <li key={taskIndex}>
            <label><input type="checkbox" name={`t-${featureIndex}-${taskIndex}`} defaultChecked /><span>{task.title}</span></label>
            <select name={`s-${featureIndex}-${taskIndex}`} defaultValue={sizeOfWeight(task.weight)} aria-label={`Peso de ${task.title}`}>{TASK_SIZES.map((size) => <option key={size.id} value={size.id}>{size.id} · {size.label}</option>)}</select>
          </li>)}</ul>
        </li>)}</ol>
        <div className="project-form-actions"><ConfirmSubmitButton className="text-link project-danger-link" formAction={discardJobAction} message="Descartar o rascunho da Eliza? Nada do plano é alterado.">DESCARTAR RASCUNHO</ConfirmSubmitButton><button className="primary-action" type="submit">APLICAR AO PLANO</button></div>
      </form>
    </section>;
  }

  if (!aiReady && hasPlan) return null;
  if (!aiReady) return <section className="settings-panel project-eliza"><div className="settings-panel-heading"><div><h2>Destrinchar com a Eliza.</h2><p>Conecte um provedor de IA em Integrações para a Eliza transformar a descrição do projeto em funcionalidades e subatividades.</p></div><Link className="text-link" href="/integracoes/ia">CONECTAR A IA</Link></div></section>;

  const form = <form action={requestPlanAction} className="project-eliza-form">
    <input type="hidden" name="projectId" value={projectId} />
    {job?.status === "FAILED" ? <p className="form-error">A Eliza não concluiu: {job.error ?? "erro desconhecido"}. Ajuste a descrição e tente de novo.</p> : null}
    <CountedTextarea name="prompt" label="DESCRIÇÃO DO PROJETO" max={PROJECT_LIMITS.prompt} rows={hasPlan ? 6 : 12} defaultValue={job?.status === "FAILED" ? job.input : ""} placeholder="Cole tudo o que tiver: escopo, requisitos, telas, integrações, mensagens do cliente, referências. Quanto mais detalhe, melhor o plano." />
    <div className="project-eliza-options">{quoteCode ? <label className="project-check-option"><input type="checkbox" name="useQuote" defaultChecked={!hasPlan} />Incluir o escopo do orçamento {quoteCode}</label> : <span />}<button className="primary-action" type="submit">DESTRINCHAR COM A ELIZA</button></div>
  </form>;

  return <section className="settings-panel project-eliza">
    {hasPlan ? <details className="project-eliza-more"><summary><span><b>Acrescentar ao plano com a Eliza</b><small>Descreva uma parte nova do projeto; ela entra como rascunho para revisar.</small></span><i aria-hidden="true" /></summary>{form}</details> : <>
      <div className="settings-panel-heading"><div><h2>Destrinchar com a Eliza.</h2><p>Cole a descrição do projeto. A Eliza identifica as funcionalidades, divide cada uma em subatividades com peso e devolve um rascunho. Nada entra no plano sem a sua revisão.</p></div></div>
      {form}
    </>}
  </section>;
}

/** Plano do projeto: a caixa da Eliza e as funcionalidades com o checklist das subatividades. */
export function ProjectPlan({ project, job, aiReady }: { project: ProjectDetail; job: Job; aiReady: boolean }) {
  const taskCount = project.features.reduce((sum, feature) => sum + feature.tasks.length, 0);
  const quote = project.quotes[0] ?? null;

  return <>
    <ElizaPlanBox projectId={project.id} job={job} aiReady={aiReady} quoteCode={quote?.code ?? null} hasPlan={project.features.length > 0} />

    <section className="settings-panel project-plan" aria-labelledby="project-plan-title">
      <div className="settings-panel-heading"><div><h2 id="project-plan-title">Plano.</h2><p>{project.features.length ? `${project.features.length} ${project.features.length === 1 ? "funcionalidade" : "funcionalidades"} · ${taskCount} ${taskCount === 1 ? "subatividade" : "subatividades"}. Marque o que terminar; o percentual considera o peso de cada uma.` : "Ainda sem funcionalidades. Peça para a Eliza destrinchar a descrição ou crie a primeira abaixo."}</p></div><p className="project-size-legend">{TASK_SIZES.map((size) => <span key={size.id}><b>{size.id}</b>{size.label.toLowerCase()} · peso {size.weight}</span>)}</p></div>

      {project.features.length ? <ol className="project-features">{project.features.map((feature, index) => {
        const total = feature.tasks.reduce((sum, task) => sum + task.weight, 0);
        const done = feature.tasks.filter((task) => task.status === "DONE").reduce((sum, task) => sum + task.weight, 0);
        return <li className="project-feature" key={feature.id} id={`funcionalidade-${feature.id}`}>
          <div className="project-feature-head">
            <span className="project-feature-index">{pad(index + 1)}</span>
            <div className="project-feature-title"><b>{feature.title}</b>{feature.description ? <small>{feature.description}</small> : null}</div>
            <ProgressBar percent={percentOf(done, total)} size="small" label={`Concluído em ${feature.title}`} />
            <details className="project-menu"><summary aria-label={`Editar ${feature.title}`}>EDITAR</summary>
              <div className="project-menu-panel">
                <form action={updateFeatureAction} className="project-inline-form"><input type="hidden" name="featureId" value={feature.id} /><label>Funcionalidade<input name="title" defaultValue={feature.title} required maxLength={PROJECT_LIMITS.title} /></label><label>Descrição<input name="description" defaultValue={feature.description ?? ""} maxLength={600} /></label><button className="secondary-action" type="submit">SALVAR</button></form>
                <div className="project-menu-row">
                  <form action={moveFeatureAction}><input type="hidden" name="featureId" value={feature.id} /><input type="hidden" name="direction" value="up" /><button className="text-link" type="submit" disabled={index === 0}>SUBIR</button></form>
                  <form action={moveFeatureAction}><input type="hidden" name="featureId" value={feature.id} /><input type="hidden" name="direction" value="down" /><button className="text-link" type="submit" disabled={index === project.features.length - 1}>DESCER</button></form>
                  <form><input type="hidden" name="featureId" value={feature.id} /><ConfirmSubmitButton className="text-link project-danger-link" formAction={deleteFeatureAction} message={`Excluir "${feature.title}" e as ${feature.tasks.length} subatividades dela?`}>EXCLUIR</ConfirmSubmitButton></form>
                </div>
              </div>
            </details>
          </div>

          {feature.tasks.length ? <ul className="project-tasks">{feature.tasks.map((task) => {
            const isDone = task.status === "DONE";
            return <li className={`project-task is-${task.status.toLowerCase().replace("_", "-")}`} key={task.id}>
              <form action={toggleTaskAction}><input type="hidden" name="taskId" value={task.id} /><button className="project-check" type="submit" aria-pressed={isDone} aria-label={isDone ? `Reabrir: ${task.title}` : `Concluir: ${task.title}`}>{isDone ? <CheckIcon /> : null}</button></form>
              <div className="project-task-main"><span>{task.title}</span>{task.notes ? <small>{task.notes}</small> : null}</div>
              <form key={`${task.status}-${task.weight}`} action={updateTaskAction} className="project-task-fields"><input type="hidden" name="taskId" value={task.id} />
                <SubmitOnChangeSelect className="project-size-select" name="size" defaultValue={sizeOfWeight(task.weight)} label={`Peso de ${task.title}`} options={sizeOptions} />
                <SubmitOnChangeSelect className={`project-status-select is-${task.status.toLowerCase().replace("_", "-")}`} name="status" defaultValue={task.status} label={`Situação de ${task.title}`} options={statusOptions} />
              </form>
              <details className="project-menu is-compact"><summary aria-label={`Editar ${task.title}`}>···</summary>
                <div className="project-menu-panel">
                  <form action={updateTaskAction} className="project-inline-form"><input type="hidden" name="taskId" value={task.id} /><label>Subatividade<input name="title" defaultValue={task.title} required maxLength={PROJECT_LIMITS.title} /></label><label>Observação<input name="notes" defaultValue={task.notes ?? ""} maxLength={1_000} placeholder="Opcional" /></label><button className="secondary-action" type="submit">SALVAR</button></form>
                  <form className="project-menu-row"><input type="hidden" name="taskId" value={task.id} /><ConfirmSubmitButton className="text-link project-danger-link" formAction={deleteTaskAction} message={`Excluir a subatividade "${task.title}"?`}>EXCLUIR SUBATIVIDADE</ConfirmSubmitButton></form>
                </div>
              </details>
            </li>;
          })}</ul> : <p className="project-feature-empty">Sem subatividades ainda.</p>}

          <form action={addTaskAction} className="project-add-task"><input type="hidden" name="featureId" value={feature.id} /><input name="title" required maxLength={PROJECT_LIMITS.title} placeholder="Nova subatividade" aria-label={`Nova subatividade em ${feature.title}`} /><select name="size" defaultValue="M" aria-label="Peso">{TASK_SIZES.map((size) => <option key={size.id} value={size.id}>{size.id} · {size.label}</option>)}</select><button className="secondary-action" type="submit">ADICIONAR</button></form>
        </li>;
      })}</ol> : null}

      <form action={addFeatureAction} className="project-add-feature"><input type="hidden" name="projectId" value={project.id} /><label>Nova funcionalidade<input name="title" required maxLength={PROJECT_LIMITS.title} placeholder="Ex.: Cadastro de clientes" /></label><label>Descrição<input name="description" maxLength={600} placeholder="Opcional: o que ela entrega" /></label><button className="secondary-action" type="submit">CRIAR FUNCIONALIDADE</button></form>
    </section>
  </>;
}
