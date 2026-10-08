"use server";

import { ServiceBillingType, ServicePricingMethod } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { richTextForStorage } from "@/lib/rich-text";

function text(value: FormDataEntryValue | null, maxLength: number) {
  const result = typeof value === "string" ? value.trim() : "";
  return result ? result.slice(0, maxLength) : null;
}

function cents(value: FormDataEntryValue | null) {
  const parsed = Number(String(value ?? "0").replace(",", "."));
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 100)) : 0;
}

function wholeNumber(value: FormDataEntryValue | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

function pricingMethod(value: FormDataEntryValue | null) {
  if (value === ServicePricingMethod.HOURLY) return ServicePricingMethod.HOURLY;
  if (value === ServicePricingMethod.DAILY) return ServicePricingMethod.DAILY;
  if (value === ServicePricingMethod.CUSTOM) return ServicePricingMethod.CUSTOM;
  return ServicePricingMethod.FIXED;
}

export async function createServiceCategory(formData: FormData) {
  const name = text(formData.get("name"), 80);
  if (!name) redirect("/servicos/categorias?error=Informe%20o%20nome%20da%20categoria.");

  try {
    await prisma.serviceCategory.create({
      data: { name, description: text(formData.get("description"), 280), sortOrder: wholeNumber(formData.get("sortOrder")) },
      select: { id: true },
    });
  } catch {
    redirect("/servicos/categorias?error=Esta%20categoria%20j%C3%A1%20existe.");
  }

  revalidatePath("/servicos");
  revalidatePath("/servicos/novo");
  revalidatePath("/servicos/categorias");
  redirect("/servicos/categorias?created=1");
}

export async function createCatalogService(formData: FormData) {
  const categoryId = text(formData.get("categoryId"), 50);
  const name = text(formData.get("name"), 140);
  const billingType = formData.get("billingType") === ServiceBillingType.RECURRING ? ServiceBillingType.RECURRING : ServiceBillingType.ONE_TIME;
  const method = pricingMethod(formData.get("pricingMethod"));
  const defaultAmountCents = method === ServicePricingMethod.CUSTOM ? 0 : cents(formData.get("defaultAmount"));
  if (!categoryId || !name) redirect("/servicos/novo?error=Informe%20a%20categoria%20e%20o%20nome%20do%20servi%C3%A7o.");
  if (method !== ServicePricingMethod.CUSTOM && defaultAmountCents <= 0) redirect("/servicos/novo?error=Informe%20um%20valor%20de%20refer%C3%AAncia%20maior%20que%20zero.");

  const category = await prisma.serviceCategory.findFirst({ where: { id: categoryId, isActive: true }, select: { id: true } });
  if (!category) redirect("/servicos/novo?error=Selecione%20uma%20categoria%20ativa.");

  await prisma.serviceCatalogItem.create({
    data: {
      categoryId,
      name,
      description: text(formData.get("description"), 2_000),
      proposalText: richTextForStorage(formData.get("proposalText")),
      billingType,
      pricingMethod: method,
      defaultAmountCents,
      estimatedHours: null,
      billingCycle: billingType === ServiceBillingType.RECURRING ? text(formData.get("billingCycle"), 30) ?? "MONTHLY" : null,
    },
    select: { id: true },
  });

  revalidatePath("/servicos");
  revalidatePath("/servicos/novo");
  redirect("/servicos");
}

export async function updateCatalogService(formData: FormData) {
  const serviceId = text(formData.get("serviceId"), 50);
  if (!serviceId) redirect("/servicos");
  const categoryId = text(formData.get("categoryId"), 50);
  const name = text(formData.get("name"), 140);
  const billingType = formData.get("billingType") === ServiceBillingType.RECURRING ? ServiceBillingType.RECURRING : ServiceBillingType.ONE_TIME;
  const method = pricingMethod(formData.get("pricingMethod"));
  const defaultAmountCents = method === ServicePricingMethod.CUSTOM ? 0 : cents(formData.get("defaultAmount"));
  if (!categoryId || !name) redirect(`/servicos/${serviceId}?error=Informe%20a%20categoria%20e%20o%20nome%20do%20servi%C3%A7o.`);
  if (method !== ServicePricingMethod.CUSTOM && defaultAmountCents <= 0) redirect(`/servicos/${serviceId}?error=Informe%20um%20valor%20de%20refer%C3%AAncia%20maior%20que%20zero.`);

  const category = await prisma.serviceCategory.findFirst({ where: { id: categoryId, isActive: true }, select: { id: true } });
  if (!category) redirect(`/servicos/${serviceId}?error=Selecione%20uma%20categoria%20ativa.`);

  const updated = await prisma.serviceCatalogItem.updateMany({
    where: { id: serviceId },
    data: {
      categoryId,
      name,
      description: text(formData.get("description"), 2_000),
      proposalText: richTextForStorage(formData.get("proposalText")),
      billingType,
      pricingMethod: method,
      defaultAmountCents,
      estimatedHours: null,
      billingCycle: billingType === ServiceBillingType.RECURRING ? text(formData.get("billingCycle"), 30) ?? "MONTHLY" : null,
    },
  });
  if (!updated.count) redirect("/servicos");

  revalidatePath("/servicos");
  revalidatePath(`/servicos/${serviceId}`);
  revalidatePath("/orcamentos/novo");
  redirect(`/servicos/${serviceId}?updated=1`);
}

export async function archiveCatalogService(formData: FormData) {
  const serviceId = text(formData.get("serviceId"), 50);
  if (!serviceId) redirect("/servicos");
  await prisma.serviceCatalogItem.updateMany({ where: { id: serviceId }, data: { isActive: false } });
  revalidatePath("/servicos");
  revalidatePath(`/servicos/${serviceId}`);
  revalidatePath("/orcamentos/novo");
  redirect("/servicos");
}

export async function deleteCatalogService(formData: FormData) {
  const serviceId = text(formData.get("serviceId"), 50);
  if (!serviceId) redirect("/servicos");
  const service = await prisma.serviceCatalogItem.findUnique({ where: { id: serviceId }, select: { _count: { select: { subscriptions: true } } } });
  if (!service) redirect("/servicos");
  if (service._count.subscriptions) redirect(`/servicos/${serviceId}?error=Este%20servi%C3%A7o%20possui%20assinaturas%20ativas%20ou%20hist%C3%B3ricas.%20Arquive-o%20para%20preservar%20a%20rela%C3%A7%C3%A3o%20com%20os%20clientes.`);
  await prisma.serviceCatalogItem.delete({ where: { id: serviceId } });
  revalidatePath("/servicos");
  revalidatePath("/orcamentos/novo");
  redirect("/servicos?deleted=1");
}

export async function assignRecurringService(formData: FormData) {
  const clientId = text(formData.get("clientId"), 50);
  const serviceId = text(formData.get("serviceId"), 50);
  if (!clientId || !serviceId) redirect("/clientes");

  const service = await prisma.serviceCatalogItem.findFirst({
    where: { id: serviceId, isActive: true, billingType: ServiceBillingType.RECURRING },
    select: { id: true, name: true, billingCycle: true },
  });
  if (!service) redirect(`/clientes/${clientId}/assinaturas/nova?error=Selecione%20um%20servi%C3%A7o%20recorrente%20v%C3%A1lido.`);

  const nextPayment = text(formData.get("nextPaymentAt"), 10);
  const nextPaymentAt = nextPayment ? new Date(`${nextPayment}T12:00:00.000Z`) : null;
  await prisma.subscription.create({
    data: {
      clientId,
      serviceCatalogItemId: service.id,
      name: service.name,
      amountCents: cents(formData.get("amount")),
      billingCycle: text(formData.get("billingCycle"), 30) ?? service.billingCycle ?? "MONTHLY",
      nextPaymentAt: nextPaymentAt && !Number.isNaN(nextPaymentAt.getTime()) ? nextPaymentAt : null,
    },
    select: { id: true },
  });

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${clientId}`);
  revalidatePath("/servicos");
  redirect(`/clientes/${clientId}?section=subscriptions`);
}
