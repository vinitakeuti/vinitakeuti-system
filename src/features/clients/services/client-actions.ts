"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

function optionalText(value: FormDataEntryValue | null, maxLength: number) {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text.slice(0, maxLength) : null;
}

export async function createClient(formData: FormData) {
  const name = optionalText(formData.get("name"), 160);
  if (!name) redirect("/clientes/novo?error=Informe%20o%20nome%20do%20cliente.");

  const client = await prisma.client.create({
    data: {
      name,
      company: optionalText(formData.get("company"), 160),
      email: optionalText(formData.get("email"), 254),
      phone: optionalText(formData.get("phone"), 40),
      document: optionalText(formData.get("document"), 32),
      address: optionalText(formData.get("address"), 500),
      city: optionalText(formData.get("city"), 120),
      notes: optionalText(formData.get("notes"), 4_000),
    },
    select: { id: true },
  });

  revalidatePath("/clientes");
  redirect(`/clientes/${client.id}`);
}
