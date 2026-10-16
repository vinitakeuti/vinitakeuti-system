"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { documentKindFromSlug } from "@/features/documents/types/document-kinds";

function contentFromForm(formData: FormData) {
  const value = formData.get("content");
  return typeof value === "string" ? value.replace(/\r\n?/g, "\n").trim().slice(0, 120_000) : "";
}

function idParam(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" && /^[a-z0-9]{1,50}$/i.test(value) ? value : null;
}

/** Salva o texto padrão do tipo de documento escolhido e mantém o caminho de volta ao PDF de onde ele foi aberto. */
export async function saveQuoteTextTemplateAction(formData: FormData) {
  const info = documentKindFromSlug(typeof formData.get("tipo") === "string" ? String(formData.get("tipo")) : "proposta") ?? documentKindFromSlug("proposta")!;
  const content = contentFromForm(formData);
  await prisma.quoteTextTemplate.upsert({
    where: { id: info.templateId },
    create: { id: info.templateId, content },
    update: { content },
    select: { id: true },
  });
  revalidatePath("/documentos/texto-padrao");
  const params = new URLSearchParams({ tipo: info.slug, updated: "1" });
  const returnQuoteId = idParam(formData, "returnQuoteId");
  const returnDocumentId = idParam(formData, "returnDocumentId");
  if (returnQuoteId) params.set("orcamento", returnQuoteId);
  if (returnDocumentId) params.set("documento", returnDocumentId);
  redirect(`/documentos/texto-padrao?${params}`);
}
