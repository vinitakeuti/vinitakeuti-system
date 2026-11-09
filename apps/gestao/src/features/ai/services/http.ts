import { AiUnavailableError } from "@/features/ai/services/ai-runs";

/** Ajudantes das rotas de API da IA: corpo JSON com limite de tamanho e erros com o status certo. */

const MAX_BODY_BYTES = 32 * 1024;

/** Corpo JSON até `maxBytes` (32 KB por padrão; o editor de documentos envia o texto inteiro e usa mais). */
export async function readJson(request: Request, maxBytes = MAX_BODY_BYTES): Promise<Record<string, unknown> | null> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > maxBytes) return null;
  const text = await request.text().catch(() => "");
  if (!text || text.length > maxBytes) return null;
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

/**
 * CORS das rotas públicas do atendimento (widget do site). Liberadas para viniciusriudi.com e para os domínios em
 * AI_SITE_ORIGINS (separados por vírgula), útil para testar o site em outro endereço.
 */
const SITE_ORIGINS = ["https://viniciusriudi.com", "https://www.viniciusriudi.com"];

export function siteCors(request: Request) {
  const origin = request.headers.get("origin") ?? "";
  const extra = (process.env.AI_SITE_ORIGINS ?? "").split(",").map((value) => value.trim().replace(/\/$/, "")).filter(Boolean);
  const allowed = SITE_ORIGINS.includes(origin) || extra.includes(origin) || (process.env.NODE_ENV !== "production" && /^http:\/\/localhost(:\d+)?$/.test(origin));
  return { ...(allowed ? { "access-control-allow-origin": origin, vary: "Origin" } : {}), "access-control-allow-methods": "GET, POST, OPTIONS", "access-control-allow-headers": "content-type", "access-control-max-age": "600", "cache-control": "no-store" };
}
