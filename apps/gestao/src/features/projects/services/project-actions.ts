"use server";

import { ProjectStatus, ProjectTaskStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireManagementUser } from "@/features/auth/services/auth-session";
import { ProjectAiError, enqueueProjectAiJob, type DayDraft } from "@/features/projects/services/project-ai";
import { addFeature, addTask, appendPlan, createProject, deleteFeature, deleteProject, deleteTask, moveFeature, registerProjectDay, toggleTask, updateFeature, updateProject, updateTask, type PlanDraft, type ProjectInput } from "@/features/projects/services/project-service";
import { deleteProjectUpdate, publishProjectUpdate, saveProjectUpdate } from "@/features/projects/services/project-updates";
import { PROJECT_LIMITS, TASK_STATUS_OPTIONS, isDayKey, minutesFromHours, todayKey, weightOfSize } from "@/features/projects/types/project";

/** Ações das telas de projetos. As do plano não redirecionam: a tela se atualiza no lugar, sem perder a rolagem. */

function text(formData: FormData, name: string, max: number) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** Texto longo: preserva as quebras de linha. */
function longText(formData: FormData, name: string, max: number) {
  const value = formData.get(name);
  return typeof value === "string" ? value.replace(/\r\n?/g, "\n").trim().slice(0, max) : "";
}

const dateField = (formData: FormData, name: string) => {
  const value = text(formData, name, 10);
  return isDayKey(value) ? new Date(`${value}T12:00:00.000-03:00`) : null;
};

const projectPath = (id: string) => `/projetos/${id}`;
function go(id: string, tab: string, params: Record<string, string> = {}): never {
  redirect(`${projectPath(id)}?${new URLSearchParams({ aba: tab, ...params })}`);
}

function refresh(projectId: string) {
  revalidatePath(projectPath(projectId));
  revalidatePath("/projetos");
}

function projectInput(formData: FormData): ProjectInput {
  const status = text(formData, "status", 20) as ProjectStatus;
  return {
    name: text(formData, "name", PROJECT_LIMITS.title),
    clientId: text(formData, "clientId", 50) || null,
    description: longText(formData, "description", PROJECT_LIMITS.description) || null,
    status: Object.values(ProjectStatus).includes(status) ? status : ProjectStatus.PLANNING,
    startedAt: dateField(formData, "startedAt"),
    deliveryAt: dateField(formData, "deliveryAt"),
    quoteId: text(formData, "quoteId", 50) || null,
  };
}

/* Projeto */

export async function createProjectAction(formData: FormData) {
  await requireManagementUser();
  const result = await createProject(projectInput(formData));
  if (!result.ok) redirect(`/projetos/novo?${new URLSearchParams({ erro: result.error, ...(text(formData, "quoteId", 50) ? { orcamento: text(formData, "quoteId", 50) } : {}) })}`);
  revalidatePath("/projetos");
  go(result.projectId, "plano", { aviso: "criado" });
}

export async function updateProjectAction(formData: FormData) {
  await requireManagementUser();
  const projectId = text(formData, "projectId", 50);
  const result = await updateProject(projectId, projectInput(formData));
  if (!result.ok) go(projectId, "dados", { erro: result.error });
  refresh(projectId);
  go(projectId, "dados", { aviso: "salvo" });
}

export async function deleteProjectAction(formData: FormData) {
  await requireManagementUser();
  const projectId = text(formData, "projectId", 50);
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { name: true } });
  const result = await deleteProject(projectId);
  if (!result.ok) redirect("/projetos");
  revalidatePath("/projetos");
  if (result.clientId) revalidatePath(`/clientes/${result.clientId}`);
  redirect(`/projetos?excluido=${encodeURIComponent(project?.name ?? "")}`);
}

/* Plano: funcionalidades e subatividades */

export async function addFeatureAction(formData: FormData) {
  await requireManagementUser();
  const projectId = text(formData, "projectId", 50);
  await addFeature(projectId, text(formData, "title", PROJECT_LIMITS.title), longText(formData, "description", 600) || null);
  refresh(projectId);
}

export async function updateFeatureAction(formData: FormData) {
  await requireManagementUser();
  const result = await updateFeature(text(formData, "featureId", 50), text(formData, "title", PROJECT_LIMITS.title), longText(formData, "description", 600) || null);
  if (result.ok) refresh(result.projectId);
}

export async function moveFeatureAction(formData: FormData) {
  await requireManagementUser();
  const result = await moveFeature(text(formData, "featureId", 50), text(formData, "direction", 4) === "up" ? "up" : "down");
  if (result.ok) refresh(result.projectId);
}

export async function deleteFeatureAction(formData: FormData) {
  await requireManagementUser();
  const result = await deleteFeature(text(formData, "featureId", 50));
  if (result.ok) refresh(result.projectId);
}

export async function addTaskAction(formData: FormData) {
  await requireManagementUser();
  const result = await addTask(text(formData, "featureId", 50), text(formData, "title", PROJECT_LIMITS.title), weightOfSize(text(formData, "size", 1)));
  if (result.ok) refresh(result.projectId);
}

export async function updateTaskAction(formData: FormData) {
  await requireManagementUser();
  const status = text(formData, "status", 20) as ProjectTaskStatus;
  const result = await updateTask(text(formData, "taskId", 50), {
    ...(formData.has("title") ? { title: text(formData, "title", PROJECT_LIMITS.title) } : {}),
    ...(formData.has("size") ? { weight: weightOfSize(text(formData, "size", 1)) } : {}),
    ...((TASK_STATUS_OPTIONS as readonly string[]).includes(status) ? { status } : {}),
    ...(formData.has("notes") ? { notes: longText(formData, "notes", 1_000) || null } : {}),
  });
  if (result.ok) refresh(result.projectId);
}

export async function toggleTaskAction(formData: FormData) {
  await requireManagementUser();
  const result = await toggleTask(text(formData, "taskId", 50));
  if (result.ok) refresh(result.projectId);
}

export async function deleteTaskAction(formData: FormData) {
  await requireManagementUser();
  const result = await deleteTask(text(formData, "taskId", 50));
  if (result.ok) refresh(result.projectId);
}

/* Eliza: plano */

export async function requestPlanAction(formData: FormData) {
  await requireManagementUser();
  const projectId = text(formData, "projectId", 50);
  let prompt = longText(formData, "prompt", PROJECT_LIMITS.prompt);
  if (formData.get("useQuote") === "on") {
    const quote = await prisma.quote.findFirst({ where: { projectId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { code: true, title: true, scope: true, items: { take: 40, orderBy: { createdAt: "asc" }, select: { name: true, quantity: true } } } });
    if (quote) prompt = [`Escopo do orçamento ${quote.code} (${quote.title}):\n${quote.scope}`, quote.items.length ? `Serviços do orçamento:\n${quote.items.map((item) => `- ${item.name}${item.quantity > 1 ? ` (${item.quantity})` : ""}`).join("\n")}` : "", prompt].filter(Boolean).join("\n\n").slice(0, PROJECT_LIMITS.prompt);
  }
  if (prompt.length < 20) go(projectId, "plano", { erro: "Descreva o projeto com um pouco mais de detalhe para a Eliza destrinchar." });
  try { await enqueueProjectAiJob({ projectId, kind: "PLAN", input: prompt }); }
  catch (error) { go(projectId, "plano", { erro: error instanceof ProjectAiError ? error.message : "Não foi possível enviar para a Eliza agora." }); }
  refresh(projectId);
  go(projectId, "plano", { aviso: "eliza" });
}

/** Aplica do rascunho só o que ficou marcado (funcionalidade f-0, subatividade t-0-3) e o peso escolhido de cada uma. */
export async function applyPlanAction(formData: FormData) {
  await requireManagementUser();
  const job = await prisma.projectAiJob.findUnique({ where: { id: text(formData, "jobId", 50) }, select: { id: true, projectId: true, status: true, kind: true, result: true } });
  if (!job || job.kind !== "PLAN" || job.status !== "READY") redirect("/projetos");
  const draft = job.result as unknown as PlanDraft;
  const plan: PlanDraft = {
    notes: null,
    features: draft.features.map((feature, featureIndex) => ({
      ...feature,
      tasks: feature.tasks.flatMap((task, taskIndex) => formData.get(`t-${featureIndex}-${taskIndex}`) === "on" ? [{ title: task.title, weight: formData.has(`s-${featureIndex}-${taskIndex}`) ? weightOfSize(text(formData, `s-${featureIndex}-${taskIndex}`, 1)) : task.weight }] : []),
    })).filter((feature, featureIndex) => formData.get(`f-${featureIndex}`) === "on"),
  };
  if (!plan.features.length) go(job.projectId, "plano", { erro: "Marque ao menos uma funcionalidade para aplicar." });
  const result = await appendPlan(job.projectId, plan);
  if (!result.ok) go(job.projectId, "plano", { erro: result.error });
  await prisma.projectAiJob.update({ where: { id: job.id }, data: { status: "APPLIED" } });
  refresh(job.projectId);
  go(job.projectId, "plano", { aviso: "plano", total: String(result.tasks) });
}

export async function discardJobAction(formData: FormData) {
  await requireManagementUser();
  const job = await prisma.projectAiJob.findUnique({ where: { id: text(formData, "jobId", 50) }, select: { id: true, projectId: true, kind: true } });
  if (!job) redirect("/projetos");
  await prisma.projectAiJob.update({ where: { id: job.id }, data: { status: "DISCARDED" } });
  refresh(job.projectId);
  go(job.projectId, job.kind === "DAY" ? "diario" : job.kind === "UPDATE" ? "cliente" : "plano", { aviso: "descartado" });
}

/* Diário */

export async function registerDayAction(formData: FormData) {
  await requireManagementUser();
  const projectId = text(formData, "projectId", 50);
  const day = isDayKey(text(formData, "day", 10)) ? text(formData, "day", 10) : todayKey();
  const summary = longText(formData, "summary", PROJECT_LIMITS.summary);
  const minutes = minutesFromHours(text(formData, "hours", 6));
  if (!summary) go(projectId, "diario", { erro: "Escreva o resumo do dia." });
  if (formData.get("withEliza") === "on") {
    try { await enqueueProjectAiJob({ projectId, kind: "DAY", input: summary, day, minutes }); }
    catch (error) { go(projectId, "diario", { erro: error instanceof ProjectAiError ? error.message : "Não foi possível enviar para a Eliza agora." }); }
    refresh(projectId);
    go(projectId, "diario", { aviso: "eliza-dia" });
  }
  const result = await registerProjectDay({ projectId, day, summary, minutes, done: [], doing: [], source: "MANUAL" });
  if (!result.ok) go(projectId, "diario", { erro: result.error });
  refresh(projectId);
  go(projectId, "diario", { aviso: "dia" });
}

/** Confirma as marcações propostas pela Eliza (as que ficaram marcadas) e grava o dia no diário. */
export async function applyDayAction(formData: FormData) {
  await requireManagementUser();
  const job = await prisma.projectAiJob.findUnique({ where: { id: text(formData, "jobId", 50) }, select: { id: true, projectId: true, kind: true, status: true, input: true, day: true, minutes: true, result: true } });
  if (!job || job.kind !== "DAY" || job.status !== "READY") redirect("/projetos");
  const draft = job.result as unknown as DayDraft;
  const result = await registerProjectDay({
    projectId: job.projectId,
    day: job.day ? job.day.toISOString().slice(0, 10) : todayKey(),
    summary: longText(formData, "summary", PROJECT_LIMITS.summary) || job.input,
    minutes: formData.has("hours") ? minutesFromHours(text(formData, "hours", 6)) : job.minutes,
    done: draft.done.filter((id) => formData.get(`done-${id}`) === "on"),
    doing: draft.doing.filter((id) => formData.get(`doing-${id}`) === "on"),
    source: "ELIZA",
  });
  if (!result.ok) go(job.projectId, "diario", { erro: result.error });
  await prisma.projectAiJob.update({ where: { id: job.id }, data: { status: "APPLIED" } });
  refresh(job.projectId);
  go(job.projectId, "diario", { aviso: "dia" });
}

/* Atualizações ao cliente */

export async function requestUpdateAction(formData: FormData) {
  await requireManagementUser();
  const projectId = text(formData, "projectId", 50);
  try { await enqueueProjectAiJob({ projectId, kind: "UPDATE", input: longText(formData, "guidance", 1_000) }); }
  catch (error) { go(projectId, "cliente", { erro: error instanceof ProjectAiError ? error.message : "Não foi possível enviar para a Eliza agora." }); }
  refresh(projectId);
  go(projectId, "cliente", { aviso: "eliza-atualizacao" });
}

export async function createUpdateAction(formData: FormData) {
  await requireManagementUser();
  const projectId = text(formData, "projectId", 50);
  const result = await saveProjectUpdate({ projectId, title: text(formData, "title", 160), body: longText(formData, "body", 4_000) });
  if (!result.ok) go(projectId, "cliente", { erro: result.error });
  refresh(projectId);
  go(projectId, "cliente", { aviso: "rascunho" });
}

export async function saveUpdateAction(formData: FormData) {
  await requireManagementUser();
  const projectId = text(formData, "projectId", 50);
  const result = await saveProjectUpdate({ projectId, updateId: text(formData, "updateId", 50), title: text(formData, "title", 160), body: longText(formData, "body", 4_000) });
  if (!result.ok) go(projectId, "cliente", { erro: result.error });
  if (formData.get("publish") === "1") {
    const published = await publishProjectUpdate(text(formData, "updateId", 50));
    if (!published.ok) go(projectId, "cliente", { erro: published.error });
    refresh(projectId);
    go(projectId, "cliente", { aviso: published.emailed ? "publicada" : "publicada-sem-email" });
  }
  refresh(projectId);
  go(projectId, "cliente", { aviso: "rascunho" });
}

export async function deleteUpdateAction(formData: FormData) {
  await requireManagementUser();
  const projectId = text(formData, "projectId", 50);
  await deleteProjectUpdate(text(formData, "updateId", 50));
  refresh(projectId);
  go(projectId, "cliente", { aviso: "atualizacao-excluida" });
}
