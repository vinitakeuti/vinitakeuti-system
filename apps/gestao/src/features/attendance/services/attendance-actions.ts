"use server";

import type { AttendanceStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireManagementUser } from "@/features/auth/services/auth-session";
import { createClientRecord } from "@/features/clients/services/client-service";
import { formatPhone } from "@/features/ai/services/site-attendance";
import { ATTENDANCE_STATUSES, getAttendance } from "@/features/attendance/queries/attendance-queries";

/** Ações do detalhe de um atendimento: situação, anotações e cadastro da pessoa como cliente. */

const text = (formData: FormData, name: string, max: number) => {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
};

function back(id: string, params: Record<string, string>): never {
  revalidatePath("/atendimentos");
  revalidatePath(`/atendimentos/${id}`);
  redirect(`/atendimentos/${id}?${new URLSearchParams(params)}`);
}

export async function setAttendanceStatusAction(formData: FormData) {
  await requireManagementUser();
  const id = text(formData, "id", 50);
  const status = text(formData, "status", 20) as AttendanceStatus;
  if (!ATTENDANCE_STATUSES.includes(status) || !(await getAttendance(id))) redirect("/atendimentos");
  await prisma.aiConversation.update({ where: { id }, data: { attendanceStatus: status } });
  back(id, { aviso: "situacao" });
}

export async function saveAttendanceNotesAction(formData: FormData) {
  await requireManagementUser();
  const id = text(formData, "id", 50);
  if (!(await getAttendance(id))) redirect("/atendimentos");
  await prisma.aiConversation.update({ where: { id }, data: { ownerNotes: text(formData, "notes", 4_000) || null } });
  back(id, { aviso: "anotacoes" });
}

/**
 * Cadastra a pessoa do atendimento como cliente (nome, telefone e e-mail) e vincula a conversa e as reuniões dela ao
 * cadastro. Se já houver cliente com o mesmo e-mail ou telefone, vincula a ele em vez de duplicar.
 */
export async function createClientFromAttendanceAction(formData: FormData) {
  await requireManagementUser();
  const id = text(formData, "id", 50);
  const attendance = await getAttendance(id);
  if (!attendance) redirect("/atendimentos");
  if (attendance.clientId) back(id, { aviso: "ja-cliente" });
  const digits = attendance.phone?.replace(/\D/g, "") ?? "";
  const local = digits.startsWith("55") ? digits.slice(2) : digits;
  const candidates = await prisma.client.findMany({
    where: { OR: [...(attendance.email ? [{ email: { equals: attendance.email, mode: "insensitive" as const } }] : []), ...(local.length >= 8 ? [{ phone: { contains: local.slice(-4) } }] : [])] },
    take: 20,
    select: { id: true, email: true, phone: true },
  });
  const existing = candidates.find((client) => (attendance.email && client.email?.toLowerCase() === attendance.email.toLowerCase()) || (local.length >= 8 && client.phone?.replace(/\D/g, "").endsWith(local.slice(-8))));
  let clientId = existing?.id ?? null;
  if (!clientId) {
    const channel = attendance.channel === "WHATSAPP" ? "WhatsApp" : attendance.channel === "PORTAL" ? "área do cliente" : "site";
    const created = await createClientRecord({ name: attendance.person, email: attendance.email, phone: digits ? formatPhone(digits.startsWith("55") ? digits : `55${digits}`) : null, notes: `Cadastrado a partir de um atendimento com a IA (${channel}).${attendance.summary ? `\n\nResumo: ${attendance.summary}` : ""}` });
    if (!created.ok) back(id, { erro: created.error });
    clientId = created.client.id;
  }
  await prisma.$transaction([
    prisma.aiConversation.update({ where: { id }, data: { clientId, ...(attendance.attendanceStatus === "NEW" ? { attendanceStatus: "IN_PROGRESS" as const } : {}) } }),
    prisma.calendarEvent.updateMany({ where: { conversationId: id, clientId: null }, data: { clientId } }),
  ]);
  revalidatePath("/clientes");
  back(id, { aviso: existing ? "vinculado" : "cliente" });
}
