"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { checkMonitoredApp } from "@/features/monitoring/services/monitoring-service";
import { monitoringEnvironments } from "@/features/monitoring/types/monitoring-labels";

function text(value: FormDataEntryValue | null, maxLength: number) {
  const result = typeof value === "string" ? value.trim() : "";
  return result ? result.slice(0, maxLength) : null;
}

function url(value: FormDataEntryValue | null) {
  const valueText = text(value, 500);
  if (!valueText) return null;
  try {
    const parsed = new URL(valueText);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (parsed.username || parsed.password) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function environment(value: FormDataEntryValue | null) {
  const candidate = text(value, 40);
  return monitoringEnvironments.some((item) => item.value === candidate) ? candidate! : "production";
}

function withParams(path: string, params: Record<string, string | null | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => { if (value) query.set(key, value); });
  const serialized = query.toString();
  return serialized ? `${path}?${serialized}` : path;
}

/** Cliente é opcional; quando informado, precisa existir. */
async function clientIdFromForm(formData: FormData) {
  const clientId = text(formData.get("clientId"), 50);
  if (!clientId) return { ok: true as const, clientId: null };
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
  return client ? { ok: true as const, clientId: client.id } : { ok: false as const };
}

function systemFields(formData: FormData) {
  return { name: text(formData.get("name"), 140), url: url(formData.get("url")), healthEndpoint: url(formData.get("healthEndpoint")), environment: environment(formData.get("environment")) };
}

function revalidateSystem(clientIds: Array<string | null | undefined>) {
  revalidatePath("/monitoramento");
  new Set(clientIds.filter(Boolean)).forEach((clientId) => revalidatePath(`/clientes/${clientId}`));
}

export async function createMonitoredApp(formData: FormData) {
  const filterClientId = text(formData.get("filterClientId"), 50);
  const fail = (message: string): never => redirect(withParams("/monitoramento/novo", { cliente: filterClientId, error: message }));
  const fields = systemFields(formData);
  if (!fields.name) fail("Informe o nome do sistema.");
  if (!fields.url && !fields.healthEndpoint) fail("Informe uma URL ou endpoint de saúde válido.");
  const client = await clientIdFromForm(formData);
  if (!client.ok) fail("O cliente selecionado não foi encontrado.");
  const clientId = client.ok ? client.clientId : null;

  await prisma.monitoredApp.create({ data: { ...fields, name: fields.name!, clientId }, select: { id: true } });
  revalidateSystem([clientId]);
  redirect(withParams("/monitoramento", { cliente: filterClientId, created: "1" }));
}

export async function updateMonitoredApp(formData: FormData) {
  const id = text(formData.get("id"), 50);
  if (!id) redirect("/monitoramento");
  const fail = (message: string): never => redirect(withParams(`/monitoramento/${id}`, { aba: "configuracao", error: message }));
  const current = await prisma.monitoredApp.findUnique({ where: { id }, select: { id: true, clientId: true, url: true, healthEndpoint: true, domainName: true } });
  if (!current) redirect("/monitoramento?error=Sistema%20n%C3%A3o%20encontrado.");
  const fields = systemFields(formData);
  if (!fields.name) fail("Informe o nome do sistema.");
  if (!fields.url && !fields.healthEndpoint) fail("Informe uma URL ou endpoint de saúde válido.");
  const client = await clientIdFromForm(formData);
  if (!client.ok) fail("O cliente selecionado não foi encontrado.");
  const clientId = client.ok ? client.clientId : null;

  // Domínio para o aviso de vencimento: o informado à mão ou, vazio, o calculado a partir do endereço.
  const domainText = text(formData.get("domainName"), 253)?.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "") ?? null;
  if (domainText && !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domainText)) fail("Informe o domínio no formato cliente.com.br.");
  const addressChanged = fields.url !== current.url || fields.healthEndpoint !== current.healthEndpoint;
  const domainChanged = domainText !== current.domainName;
  await prisma.monitoredApp.update({ where: { id: current.id }, data: {
    ...fields, name: fields.name!, clientId, domainName: domainText,
    // Endereço ou domínio novos: certificado e vencimento são conferidos de novo na próxima rodada.
    ...(addressChanged ? { sslCheckedAt: null, sslExpiresAt: null, sslIssuer: null, sslError: null, sslAlertedDays: null, nextCheckAt: null } : {}),
    ...(addressChanged || domainChanged ? { domainCheckedAt: null, domainExpiresAt: null, domainError: null, domainAlertedDays: null } : {}),
  }, select: { id: true } });
  revalidateSystem([current.clientId, clientId]);
  revalidatePath(`/monitoramento/${current.id}`);
  redirect(withParams(`/monitoramento/${current.id}`, { aba: "configuracao", updated: "1" }));
}

export async function checkMonitoredAppAction(formData: FormData) {
  const id = text(formData.get("id"), 50);
  const filterClientId = text(formData.get("filterClientId"), 50);
  if (!id) redirect(withParams("/monitoramento", { cliente: filterClientId, error: "Sistema inválido." }));
  try {
    await checkMonitoredApp(id);
  } catch (error) {
    redirect(withParams("/monitoramento", { cliente: filterClientId, error: error instanceof Error ? error.message : "Não foi possível verificar o sistema." }));
  }
  const app = await prisma.monitoredApp.findUnique({ where: { id }, select: { clientId: true } });
  revalidateSystem([app?.clientId]);
  revalidatePath(`/monitoramento/${id}`);
  if (text(formData.get("returnTo"), 20) === "detail") redirect(`/monitoramento/${id}?checked=1`);
  redirect(withParams("/monitoramento", { cliente: filterClientId, checked: "1" }));
}

export async function deleteMonitoredApp(formData: FormData) {
  const id = text(formData.get("id"), 50);
  if (!id) redirect("/monitoramento");
  const app = await prisma.monitoredApp.findUnique({ where: { id }, select: { id: true, clientId: true } });
  if (!app) redirect("/monitoramento");
  await prisma.monitoredApp.delete({ where: { id: app.id } });
  revalidateSystem([app.clientId]);
  redirect("/monitoramento?deleted=1");
}
