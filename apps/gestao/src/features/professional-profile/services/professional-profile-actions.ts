"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireManagementUser } from "@/features/auth/services/auth-session";
import { MAX_SIGNATURE_FILE_BYTES, parseSignatureSvg, serializeSignature } from "@/features/professional-profile/services/signature";
import { logEvent } from "@/features/system-logs/services/system-log";

function text(formData: FormData, field: string, maxLength: number, fallback: string | null = null) {
  const value = formData.get(field);
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().slice(0, maxLength);
  return normalized || fallback;
}

export async function saveProfessionalProfile(formData: FormData) {
  await requireManagementUser();
  const name = text(formData, "name", 160);
  if (!name) return;

  const data = {
    name,
    email: text(formData, "email", 254),
    phone: text(formData, "phone", 40),
    document: text(formData, "document", 32),
    address: text(formData, "address", 240),
    city: text(formData, "city", 120),
    state: text(formData, "state", 80),
    website: text(formData, "website", 200),
    pixKey: text(formData, "pixKey", 140),
    paymentInstructions: text(formData, "paymentInstructions", 1000),
  };

  await prisma.professionalProfile.upsert({
    where: { id: "default" },
    create: { id: "default", ...data },
    update: data,
  });

  revalidatePath("/configuracoes/profissional");
  revalidatePath("/orcamentos");
  redirect("/configuracoes/profissional?salvo=1");
}

/** Assinatura dos PDFs: o SVG enviado é reduzido aos traços e guardado no banco (nunca em public/). */
export async function saveSignatureAction(formData: FormData) {
  const user = await requireManagementUser();
  const file = formData.get("signature");
  if (!(file instanceof File) || !file.size) redirect("/configuracoes/profissional?assinatura=arquivo#assinatura");
  if (file.size > MAX_SIGNATURE_FILE_BYTES) redirect("/configuracoes/profissional?assinatura=grande#assinatura");
  const signature = parseSignatureSvg(await file.text());
  if (!signature) redirect("/configuracoes/profissional?assinatura=invalida#assinatura");
  const signatureSvg = serializeSignature(signature);
  await prisma.professionalProfile.upsert({ where: { id: "default" }, create: { id: "default", signatureSvg }, update: { signatureSvg } });
  await logEvent({ event: "profile.signature.saved", message: "Assinatura dos documentos atualizada.", actorEmail: user.email });
  revalidatePath("/configuracoes/profissional");
  redirect("/configuracoes/profissional?assinatura=salva#assinatura");
}

export async function removeSignatureAction() {
  const user = await requireManagementUser();
  await prisma.professionalProfile.updateMany({ where: { id: "default" }, data: { signatureSvg: null } });
  await logEvent({ level: "warning", event: "profile.signature.removed", message: "Assinatura dos documentos removida.", actorEmail: user.email });
  revalidatePath("/configuracoes/profissional");
  redirect("/configuracoes/profissional?assinatura=removida#assinatura");
}
