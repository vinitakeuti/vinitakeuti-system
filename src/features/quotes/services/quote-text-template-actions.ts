"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

function contentFromForm(formData: FormData) {
  const value = formData.get("content");
  return typeof value === "string" ? value.replace(/\r\n?/g, "\n").trim().slice(0, 120_000) : "";
}

export async function saveQuoteTextTemplateAction(formData: FormData) {
  const content = contentFromForm(formData);
  await prisma.quoteTextTemplate.upsert({
    where: { id: "default" },
    create: { id: "default", content },
    update: { content },
    select: { id: true },
  });
  revalidatePath("/orcamentos/texto-padrao");
  revalidatePath("/orcamentos/novo");
  const returnQuoteId = formData.get("returnQuoteId");
  const returnQuery = typeof returnQuoteId === "string" && /^[a-z0-9]{1,50}$/i.test(returnQuoteId) ? `&orcamento=${returnQuoteId}` : "";
  redirect(`/orcamentos/texto-padrao?updated=1${returnQuery}`);
}
