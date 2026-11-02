import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Stack dos sistemas monitorados e atualizações disponíveis. O endpoint de saúde informa a stack (campo opcional
 * "stack" do guia de integração); uma vez por dia cada pacote é comparado com a versão mais recente publicada no
 * registro do ecossistema (npm ou PyPI). Só pacotes com versão nova ficam em `stackUpdates`.
 */

export const STACK_ECOSYSTEMS = ["npm", "pypi"] as const;
export type StackEcosystem = (typeof STACK_ECOSYSTEMS)[number];
export type StackPackage = { name: string; version: string; ecosystem: StackEcosystem };
export type UpdateLevel = "major" | "minor" | "patch";
export type StackUpdate = { name: string; ecosystem: StackEcosystem; current: string; latest: string; level: UpdateLevel };

const MAX_PACKAGES = 60;
const REGISTRY_TIMEOUT_MS = 8_000;
const CONCURRENCY = 6;
const PACKAGE_NAME = /^(@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*$/i;

/**
 * Lê o campo "stack" do relatório de saúde. Aceita uma lista ([{ name, version, ecosystem }]) ou um objeto
 * { "next": "16.2.1" } (npm). Devolve null quando o relatório não traz stack.
 */
export function parseStack(value: unknown): StackPackage[] | null {
  if (!value || typeof value !== "object") return null;
  const raw: Array<{ name?: unknown; version?: unknown; ecosystem?: unknown }> = Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    : Object.entries(value as Record<string, unknown>).map(([name, version]) => ({ name, version, ecosystem: "npm" }));
  const packages: StackPackage[] = [];
  for (const item of raw) {
    if (packages.length >= MAX_PACKAGES) break;
    const name = typeof item.name === "string" ? item.name.trim() : "";
    const version = typeof item.version === "string" ? item.version.trim().slice(0, 40) : "";
    const ecosystem = typeof item.ecosystem === "string" && (STACK_ECOSYSTEMS as readonly string[]).includes(item.ecosystem) ? item.ecosystem as StackEcosystem : "npm";
    if (!name || name.length > 214 || !PACKAGE_NAME.test(name) || !version) continue;
    packages.push({ name, version, ecosystem });
  }
  return packages;
}

function readStack(value: Prisma.JsonValue | null): StackPackage[] {
  return parseStack(value) ?? [];
}

export function readStackUpdates(value: Prisma.JsonValue | null): StackUpdate[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is StackUpdate => Boolean(item) && typeof item === "object" && typeof (item as StackUpdate).name === "string" && typeof (item as StackUpdate).latest === "string");
}

function semver(value: string) {
  const match = value.replace(/^[\^~>=<v\s]+/, "").match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  return match ? [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)] as const : null;
}

/** Nível da atualização de `current` para `latest`; null quando já está na última (ou não dá para comparar). */
export function updateLevel(current: string, latest: string): UpdateLevel | null {
  const from = semver(current);
  const to = semver(latest);
  if (!from || !to) return null;
  if (to[0] !== from[0]) return to[0] > from[0] ? "major" : null;
  if (to[1] !== from[1]) return to[1] > from[1] ? "minor" : null;
  return to[2] > from[2] ? "patch" : null;
}

async function latestVersion(item: StackPackage): Promise<string | null> {
  const url = item.ecosystem === "npm"
    ? `https://registry.npmjs.org/${item.name.startsWith("@") ? `@${encodeURIComponent(item.name.slice(1))}` : encodeURIComponent(item.name)}/latest`
    : `https://pypi.org/pypi/${encodeURIComponent(item.name)}/json`;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(REGISTRY_TIMEOUT_MS), headers: { accept: "application/json", "user-agent": "VR-Gestao-Monitor/1.0" } });
    if (!response.ok) return null;
    const body = await response.json() as { version?: unknown; info?: { version?: unknown } };
    const version = item.ecosystem === "npm" ? body.version : body.info?.version;
    return typeof version === "string" ? version.slice(0, 40) : null;
  } catch {
    return null;
  }
}

/** Confere a stack de um sistema agora. Devolve as atualizações e quais delas são novidade desde a última conferência. */
export async function checkStackUpdates(appId: string) {
  const app = await prisma.monitoredApp.findUnique({ where: { id: appId }, select: { id: true, name: true, stack: true, stackUpdates: true } });
  if (!app) throw new Error("Sistema não encontrado.");
  const stack = readStack(app.stack);
  const previous = new Map(readStackUpdates(app.stackUpdates).map((item) => [`${item.ecosystem}:${item.name}`, item.latest]));
  const updates: StackUpdate[] = [];
  const queue = [...stack];
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
    for (let item = queue.shift(); item; item = queue.shift()) {
      const latest = await latestVersion(item);
      const level = latest ? updateLevel(item.version, latest) : null;
      if (latest && level) updates.push({ name: item.name, ecosystem: item.ecosystem, current: item.version, latest, level });
    }
  }));
  const rank = { major: 0, minor: 1, patch: 2 } as const;
  updates.sort((left, right) => rank[left.level] - rank[right.level] || left.name.localeCompare(right.name));
  await prisma.monitoredApp.update({ where: { id: app.id }, data: { stackUpdates: updates, stackCheckedAt: new Date() } });
  const fresh = updates.filter((item) => previous.get(`${item.ecosystem}:${item.name}`) !== item.latest);
  return { app: { id: app.id, name: app.name }, packages: stack.length, updates, fresh };
}
