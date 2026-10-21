"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireManagementUser } from "@/features/auth/services/auth-session";

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
