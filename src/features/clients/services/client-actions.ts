"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { clientDocumentLabel, isValidCnpj, isValidCpf, onlyDigits } from "@/lib/br-documents";
import { requireManagementUser } from "@/features/auth/services/auth-session";

function optionalText(value: FormDataEntryValue | null, maxLength: number) {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text.slice(0, maxLength) : null;
}

/** CPF e CNPJ são opcionais e independentes; quando informados, precisam ser válidos. */
function clientDocuments(formData: FormData): { error: string } | { cpf: string | null; cnpj: string | null; document: string | null } {
  const cpf = onlyDigits(optionalText(formData.get("cpf"), 20) ?? "") || null;
  const cnpj = onlyDigits(optionalText(formData.get("cnpj"), 24) ?? "") || null;
  if (cpf && !isValidCpf(cpf)) return { error: "CPF inválido. Confira os 11 dígitos." };
  if (cnpj && !isValidCnpj(cnpj)) return { error: "CNPJ inválido. Confira os 14 dígitos." };
  return { cpf, cnpj, document: clientDocumentLabel({ cpf, cnpj }) };
}

export async function createClient(formData: FormData) {
  await requireManagementUser();
  const name = optionalText(formData.get("name"), 160);
  if (!name) redirect("/clientes/novo?error=Informe%20o%20nome%20do%20cliente.");
  const documents = clientDocuments(formData);
  if ("error" in documents) redirect(`/clientes/novo?error=${encodeURIComponent(documents.error)}`);

  const client = await prisma.client.create({
    data: {
      name,
      company: optionalText(formData.get("company"), 160),
      email: optionalText(formData.get("email"), 254),
      phone: optionalText(formData.get("phone"), 40),
      cpf: documents.cpf,
      cnpj: documents.cnpj,
      document: documents.document,
      address: optionalText(formData.get("address"), 500),
      city: optionalText(formData.get("city"), 120),
      notes: optionalText(formData.get("notes"), 4_000),
    },
    select: { id: true },
  });

  revalidatePath("/clientes");
  redirect(`/clientes/${client.id}`);
}

export async function updateClient(formData: FormData) {
  await requireManagementUser();
  const id = optionalText(formData.get("id"), 50);
  if (!id) redirect("/clientes");
  const editHref = `/clientes/${encodeURIComponent(id)}/editar`;
  const name = optionalText(formData.get("name"), 160);
  if (!name) redirect(`${editHref}?error=${encodeURIComponent("Informe o nome do cliente.")}`);
  const documents = clientDocuments(formData);
  if ("error" in documents) redirect(`${editHref}?error=${encodeURIComponent(documents.error)}`);

  const updated = await prisma.client.updateMany({
    where: { id },
    data: {
      name,
      company: optionalText(formData.get("company"), 160),
      email: optionalText(formData.get("email"), 254),
      phone: optionalText(formData.get("phone"), 40),
      cpf: documents.cpf,
      cnpj: documents.cnpj,
      document: documents.document,
      address: optionalText(formData.get("address"), 500),
      city: optionalText(formData.get("city"), 120),
      notes: optionalText(formData.get("notes"), 4_000),
    },
  });
  if (!updated.count) redirect("/clientes");

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${id}`);
  redirect(`/clientes/${id}?updated=1`);
}
