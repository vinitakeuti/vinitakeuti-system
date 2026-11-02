import { AiUnavailableError } from "@/features/ai/services/ai-runs";

/** Ajudantes das rotas de API da IA: corpo JSON com limite de tamanho e erros com o status certo. */

const MAX_BODY_BYTES = 32 * 1024;

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) return null;
  const text = await request.text().catch(() => "");
  if (!text || text.length > MAX_BODY_BYTES) return null;
  try {
    const value: unknown = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

export const field = (body: Record<string, unknown> | null, name: string, max: number) => {
  const value = body?.[name];
  return typeof value === "string" ? value.trim().slice(0, max) : "";
};

export function aiErrorResponse(error: unknown, headers?: HeadersInit) {
  if (error instanceof AiUnavailableError) return Response.json({ error: error.message }, { status: error.status, headers });
  throw error;
}

/** Limite simples por chave (IP ou sessão), em memória: uma instância do servidor atende o site. */
const buckets = new Map<string, number[]>();

export function rateLimited(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((time) => now - time < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return true;
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 5_000) for (const [entry, times] of buckets) if (!times.some((time) => now - time < windowMs)) buckets.delete(entry);
  return false;
}

export function clientIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "desconhecido";
}
