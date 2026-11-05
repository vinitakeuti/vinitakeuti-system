import { ProjectUpdateStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyProjectUpdate, notifySafely } from "@/features/notifications/services/client-emails";
import type { ProjectResult } from "@/features/projects/services/project-service";
import { percentOf } from "@/features/projects/types/project";

/**
 * Atualizações ao cliente: rascunho (escrito por você ou pela Eliza) até a aprovação; publicada, aparece no portal
 * com o percentual daquele momento e vai por e-mail para o acesso do cliente.
 */

export async function saveProjectUpdate(input: { projectId: string; updateId?: string; title: string; body: string }): Promise<ProjectResult<{ updateId: string }>> {
  if (!input.title || !input.body) return { ok: false, error: "Preencha o título e o texto da atualização." };
  const project = await prisma.project.findUnique({ where: { id: input.projectId }, select: { clientId: true } });
  if (!project?.clientId) return { ok: false, error: "Atualizações ao cliente só valem para projetos de cliente." };
  if (input.updateId) {
    const updated = await prisma.projectUpdate.updateMany({ where: { id: input.updateId, projectId: input.projectId, status: ProjectUpdateStatus.DRAFT }, data: { title: input.title, body: input.body } });
    if (!updated.count) return { ok: false, error: "Rascunho não encontrado (talvez já tenha sido publicado)." };
    return { ok: true, updateId: input.updateId };
  }
  const created = await prisma.projectUpdate.create({ data: { projectId: input.projectId, title: input.title, body: input.body }, select: { id: true } });
  return { ok: true, updateId: created.id };
}

/** Publica o rascunho com o percentual atual e avisa o cliente por e-mail (quando ele tem acesso ao portal). */
export async function publishProjectUpdate(updateId: string): Promise<ProjectResult<{ emailed: boolean }>> {
  const update = await prisma.projectUpdate.findUnique({ where: { id: updateId }, select: { id: true, status: true, project: { select: { totalWeight: true, doneWeight: true } } } });
  if (!update) return { ok: false, error: "Atualização não encontrada." };
  if (update.status === ProjectUpdateStatus.PUBLISHED) return { ok: false, error: "Esta atualização já foi publicada." };
  await prisma.projectUpdate.update({ where: { id: update.id }, data: { status: ProjectUpdateStatus.PUBLISHED, publishedAt: new Date(), progressPercent: percentOf(update.project.doneWeight, update.project.totalWeight) } });
  let emailed = false;
  await notifySafely(async () => { emailed = await notifyProjectUpdate(update.id); });
  if (emailed) await prisma.projectUpdate.update({ where: { id: update.id }, data: { emailedAt: new Date() } });
  return { ok: true, emailed };
}

export async function deleteProjectUpdate(updateId: string) {
  await prisma.projectUpdate.deleteMany({ where: { id: updateId } });
}
