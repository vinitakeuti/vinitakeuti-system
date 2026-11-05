import { Prisma, ProjectStatus, ProjectTaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ACTIVE_PROJECT_STATUSES, PROJECT_LIMITS, dayColumn, dayRange, percentOf } from "@/features/projects/types/project";

/**
 * Regras do gestor de projetos, usadas pelas telas e pela Eliza: projeto, funcionalidades, subatividades, percentual
 * por peso e o registro do dia. Devolvem um erro legível em vez de redirecionar.
 */

export type ProjectResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };
type Tx = Prisma.TransactionClient;

/** Recalcula o peso total e o concluído. Ao concluir a primeira subatividade, o projeto em planejamento passa a "Em execução". */
export async function recalculateProgress(tx: Tx, projectId: string) {
  const [total, done] = await Promise.all([
    tx.projectTask.aggregate({ where: { projectId }, _sum: { weight: true } }),
    tx.projectTask.aggregate({ where: { projectId, status: ProjectTaskStatus.DONE }, _sum: { weight: true } }),
  ]);
  const doneWeight = done._sum.weight ?? 0;
  const project = await tx.project.findUnique({ where: { id: projectId }, select: { status: true, startedAt: true } });
  const starts = doneWeight > 0 && project && (["LEAD", "PROPOSAL", "PLANNING"] as ProjectStatus[]).includes(project.status);
  await tx.project.update({ where: { id: projectId }, data: { totalWeight: total._sum.weight ?? 0, doneWeight, ...(starts ? { status: ProjectStatus.IN_PROGRESS, startedAt: project.startedAt ?? new Date() } : {}) } });
  return percentOf(doneWeight, total._sum.weight ?? 0);
}

export type ProjectInput = { name: string; clientId: string | null; description: string | null; status: ProjectStatus; startedAt: Date | null; deliveryAt: Date | null; quoteId: string | null };

async function checkLinks(input: ProjectInput, projectId?: string): Promise<string | null> {
  if (!input.name) return "Informe o nome do projeto.";
  if (input.clientId && !(await prisma.client.findUnique({ where: { id: input.clientId }, select: { id: true } }))) return "Cliente não encontrado.";
  if (input.quoteId) {
    const quote = await prisma.quote.findUnique({ where: { id: input.quoteId }, select: { clientId: true, projectId: true } });
    if (!quote) return "Orçamento não encontrado.";
    if (quote.clientId !== input.clientId) return "O orçamento vinculado precisa ser do mesmo cliente do projeto.";
    if (quote.projectId && quote.projectId !== projectId) return "Este orçamento já está vinculado a outro projeto.";
  }
  return null;
}

export async function createProject(input: ProjectInput): Promise<ProjectResult<{ projectId: string }>> {
  const error = await checkLinks(input);
  if (error) return { ok: false, error };
  const project = await prisma.$transaction(async (tx) => {
    const created = await tx.project.create({ data: { name: input.name, clientId: input.clientId, description: input.description, status: input.status, startedAt: input.startedAt, deliveryAt: input.deliveryAt }, select: { id: true } });
    if (input.quoteId) await tx.quote.update({ where: { id: input.quoteId }, data: { projectId: created.id } });
    return created;
  });
  return { ok: true, projectId: project.id };
}

/** Atualiza os dados. Trocar o cliente desfaz o vínculo com orçamentos do cliente anterior. */
export async function updateProject(projectId: string, input: ProjectInput): Promise<ProjectResult> {
  const current = await prisma.project.findUnique({ where: { id: projectId }, select: { clientId: true } });
  if (!current) return { ok: false, error: "Projeto não encontrado." };
  const error = await checkLinks(input, projectId);
  if (error) return { ok: false, error };
  await prisma.$transaction(async (tx) => {
    await tx.project.update({ where: { id: projectId }, data: { name: input.name, clientId: input.clientId, description: input.description, status: input.status, startedAt: input.startedAt, deliveryAt: input.deliveryAt } });
    await tx.quote.updateMany({ where: { projectId, ...(input.quoteId ? { id: { not: input.quoteId } } : {}) }, data: { projectId: null } });
    if (input.quoteId) await tx.quote.update({ where: { id: input.quoteId }, data: { projectId } });
  });
  return { ok: true };
}

export async function deleteProject(projectId: string): Promise<ProjectResult<{ clientId: string | null }>> {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { clientId: true } });
  if (!project) return { ok: false, error: "Projeto não encontrado." };
  await prisma.project.delete({ where: { id: projectId } });
  return { ok: true, clientId: project.clientId };
}

export async function addFeature(projectId: string, title: string, description: string | null): Promise<ProjectResult<{ featureId: string }>> {
  if (!title) return { ok: false, error: "Informe o nome da funcionalidade." };
  const [count, last] = await Promise.all([prisma.projectFeature.count({ where: { projectId } }), prisma.projectFeature.findFirst({ where: { projectId }, orderBy: { position: "desc" }, select: { position: true } })]);
  if (count >= PROJECT_LIMITS.features) return { ok: false, error: `O projeto já tem ${PROJECT_LIMITS.features} funcionalidades, o máximo.` };
  if (!(await prisma.project.findUnique({ where: { id: projectId }, select: { id: true } }))) return { ok: false, error: "Projeto não encontrado." };
  const feature = await prisma.projectFeature.create({ data: { projectId, title, description, position: (last?.position ?? -1) + 1 }, select: { id: true } });
  await prisma.project.update({ where: { id: projectId }, data: { updatedAt: new Date() } });
  return { ok: true, featureId: feature.id };
}

export async function updateFeature(featureId: string, title: string, description: string | null): Promise<ProjectResult<{ projectId: string }>> {
  if (!title) return { ok: false, error: "Informe o nome da funcionalidade." };
  const feature = await prisma.projectFeature.update({ where: { id: featureId }, data: { title, description }, select: { projectId: true } }).catch(() => null);
  return feature ? { ok: true, projectId: feature.projectId } : { ok: false, error: "Funcionalidade não encontrada." };
}

/** Sobe ou desce uma funcionalidade na ordem do plano (troca de posição com a vizinha). */
export async function moveFeature(featureId: string, direction: "up" | "down"): Promise<ProjectResult<{ projectId: string }>> {
  const feature = await prisma.projectFeature.findUnique({ where: { id: featureId }, select: { id: true, projectId: true, position: true } });
  if (!feature) return { ok: false, error: "Funcionalidade não encontrada." };
  const neighbor = await prisma.projectFeature.findFirst({ where: { projectId: feature.projectId, position: direction === "up" ? { lt: feature.position } : { gt: feature.position } }, orderBy: { position: direction === "up" ? "desc" : "asc" }, select: { id: true, position: true } });
  if (neighbor) await prisma.$transaction([prisma.projectFeature.update({ where: { id: feature.id }, data: { position: neighbor.position } }), prisma.projectFeature.update({ where: { id: neighbor.id }, data: { position: feature.position } })]);
  return { ok: true, projectId: feature.projectId };
}

export async function deleteFeature(featureId: string): Promise<ProjectResult<{ projectId: string }>> {
  const feature = await prisma.projectFeature.findUnique({ where: { id: featureId }, select: { projectId: true } });
  if (!feature) return { ok: false, error: "Funcionalidade não encontrada." };
  await prisma.$transaction(async (tx) => {
    await tx.projectFeature.delete({ where: { id: featureId } });
    await recalculateProgress(tx, feature.projectId);
  });
  return { ok: true, projectId: feature.projectId };
}

export async function addTask(featureId: string, title: string, weight: number): Promise<ProjectResult<{ projectId: string }>> {
  if (!title) return { ok: false, error: "Informe a subatividade." };
  const feature = await prisma.projectFeature.findUnique({ where: { id: featureId }, select: { projectId: true, _count: { select: { tasks: true } } } });
  if (!feature) return { ok: false, error: "Funcionalidade não encontrada." };
  if (feature._count.tasks >= PROJECT_LIMITS.tasksPerFeature) return { ok: false, error: `A funcionalidade já tem ${PROJECT_LIMITS.tasksPerFeature} subatividades, o máximo.` };
  if (await prisma.projectTask.count({ where: { projectId: feature.projectId } }) >= PROJECT_LIMITS.tasks) return { ok: false, error: `O projeto já tem ${PROJECT_LIMITS.tasks} subatividades, o máximo.` };
  const last = await prisma.projectTask.findFirst({ where: { featureId }, orderBy: { position: "desc" }, select: { position: true } });
  await prisma.$transaction(async (tx) => {
    await tx.projectTask.create({ data: { projectId: feature.projectId, featureId, title, weight, position: (last?.position ?? -1) + 1 } });
    await recalculateProgress(tx, feature.projectId);
  });
  return { ok: true, projectId: feature.projectId };
}

/** Muda título, peso ou situação. Concluir grava quando; reabrir apaga a data. */
export async function updateTask(taskId: string, data: { title?: string; weight?: number; status?: ProjectTaskStatus; notes?: string | null }): Promise<ProjectResult<{ projectId: string; percent: number }>> {
  const task = await prisma.projectTask.findUnique({ where: { id: taskId }, select: { projectId: true, status: true } });
  if (!task) return { ok: false, error: "Subatividade não encontrada." };
  if (data.title !== undefined && !data.title) return { ok: false, error: "Informe a subatividade." };
  const doneAt = data.status === undefined || data.status === task.status ? undefined : data.status === ProjectTaskStatus.DONE ? new Date() : null;
  const percent = await prisma.$transaction(async (tx) => {
    await tx.projectTask.update({ where: { id: taskId }, data: { ...data, ...(doneAt !== undefined ? { doneAt } : {}) } });
    return recalculateProgress(tx, task.projectId);
  });
  return { ok: true, projectId: task.projectId, percent };
}

export async function toggleTask(taskId: string) {
  const task = await prisma.projectTask.findUnique({ where: { id: taskId }, select: { status: true } });
  if (!task) return { ok: false as const, error: "Subatividade não encontrada." };
  return updateTask(taskId, { status: task.status === ProjectTaskStatus.DONE ? ProjectTaskStatus.TODO : ProjectTaskStatus.DONE });
}

export async function deleteTask(taskId: string): Promise<ProjectResult<{ projectId: string }>> {
  const task = await prisma.projectTask.findUnique({ where: { id: taskId }, select: { projectId: true } });
  if (!task) return { ok: false, error: "Subatividade não encontrada." };
  await prisma.$transaction(async (tx) => {
    await tx.projectTask.delete({ where: { id: taskId } });
    await recalculateProgress(tx, task.projectId);
  });
  return { ok: true, projectId: task.projectId };
}

export type PlanDraft = { features: { title: string; description: string | null; tasks: { title: string; weight: number }[] }[]; notes: string | null };

/**
 * Acrescenta ao plano as funcionalidades e subatividades escolhidas de um rascunho. Funcionalidade com o mesmo nome
 * de uma existente recebe as subatividades nela, em vez de duplicar.
 */
export async function appendPlan(projectId: string, plan: PlanDraft): Promise<ProjectResult<{ features: number; tasks: number }>> {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { id: true, _count: { select: { features: true, tasks: true } } } });
  if (!project) return { ok: false, error: "Projeto não encontrado." };
  const newTasks = plan.features.reduce((sum, feature) => sum + feature.tasks.length, 0);
  if (project._count.tasks + newTasks > PROJECT_LIMITS.tasks) return { ok: false, error: `O plano passaria de ${PROJECT_LIMITS.tasks} subatividades. Desmarque algumas.` };
  const counts = await prisma.$transaction(async (tx) => {
    const existing = await tx.projectFeature.findMany({ where: { projectId }, orderBy: { position: "asc" }, take: PROJECT_LIMITS.features, select: { id: true, title: true, position: true } });
    const byTitle = new Map(existing.map((feature) => [feature.title.trim().toLowerCase(), feature.id]));
    let position = (existing.at(-1)?.position ?? -1) + 1;
    let features = 0;
    let tasks = 0;
    for (const feature of plan.features) {
      let featureId = byTitle.get(feature.title.trim().toLowerCase());
      if (!featureId) {
        if (existing.length + features >= PROJECT_LIMITS.features) break;
        featureId = (await tx.projectFeature.create({ data: { projectId, title: feature.title, description: feature.description, position: position++ }, select: { id: true } })).id;
        byTitle.set(feature.title.trim().toLowerCase(), featureId);
        features += 1;
      }
      const last = await tx.projectTask.findFirst({ where: { featureId }, orderBy: { position: "desc" }, select: { position: true } });
      const start = (last?.position ?? -1) + 1;
      if (feature.tasks.length) await tx.projectTask.createMany({ data: feature.tasks.map((task, index) => ({ projectId, featureId: featureId!, title: task.title, weight: task.weight, position: start + index })) });
      tasks += feature.tasks.length;
    }
    await recalculateProgress(tx, projectId);
    return { features, tasks };
  }, { timeout: 20_000 });
  return { ok: true, ...counts };
}

/**
 * Registra o dia: conclui e põe em andamento as subatividades indicadas e grava a entrada no diário com as
 * concluídas no dia (as desta marcação e as marcadas antes, na tela, no mesmo dia).
 */
export async function registerProjectDay(input: { projectId: string; day: string; summary: string; minutes: number | null; done: string[]; doing: string[]; source: "MANUAL" | "ELIZA" }): Promise<ProjectResult<{ percent: number; logId: string; completed: number }>> {
  if (!input.summary) return { ok: false, error: "Escreva o resumo do dia." };
  const project = await prisma.project.findUnique({ where: { id: input.projectId }, select: { id: true } });
  if (!project) return { ok: false, error: "Projeto não encontrado." };
  const ids = [...new Set([...input.done, ...input.doing])].slice(0, 200);
  const valid = new Set((await prisma.projectTask.findMany({ where: { projectId: input.projectId, id: { in: ids } }, select: { id: true } })).map((task) => task.id));
  const done = input.done.filter((id) => valid.has(id));
  const doing = input.doing.filter((id) => valid.has(id) && !done.includes(id));
  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    if (done.length) await tx.projectTask.updateMany({ where: { id: { in: done }, status: { not: ProjectTaskStatus.DONE } }, data: { status: ProjectTaskStatus.DONE, doneAt: now } });
    if (doing.length) await tx.projectTask.updateMany({ where: { id: { in: doing }, status: { in: [ProjectTaskStatus.TODO, ProjectTaskStatus.BLOCKED] } }, data: { status: ProjectTaskStatus.DOING } });
    // Concluídas já citadas em outro registro do mesmo dia não se repetem.
    const sameDay = await tx.projectLog.findMany({ where: { projectId: input.projectId, day: dayColumn(input.day) }, take: 20, select: { tasks: true } });
    const logged = new Set(sameDay.flatMap((log) => Array.isArray(log.tasks) ? (log.tasks as { id?: string }[]).map((task) => task.id ?? "") : []));
    const completed = (await tx.projectTask.findMany({ where: { projectId: input.projectId, status: ProjectTaskStatus.DONE, OR: [{ id: { in: done } }, { doneAt: dayRange(input.day) }] }, orderBy: [{ doneAt: "asc" }, { id: "asc" }], take: 100, select: { id: true, title: true, feature: { select: { title: true } } } })).filter((task) => !logged.has(task.id));
    const log = await tx.projectLog.create({ data: { projectId: input.projectId, day: dayColumn(input.day), summary: input.summary, minutes: input.minutes, source: input.source, tasks: completed.map((task) => ({ id: task.id, title: task.title, feature: task.feature.title })) }, select: { id: true } });
    const percent = await recalculateProgress(tx, input.projectId);
    return { percent, logId: log.id, completed: completed.length };
  });
  return { ok: true, ...result };
}

export const isActiveStatus = (status: ProjectStatus) => (ACTIVE_PROJECT_STATUSES as readonly ProjectStatus[]).includes(status);
