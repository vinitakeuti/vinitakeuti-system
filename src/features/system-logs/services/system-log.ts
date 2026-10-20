import { Prisma } from "@prisma/client";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getAuthPortal, requestHost } from "@/features/auth/services/auth-host";

export type LogSource = "gestao" | "clientes" | "sistema";
export type LogLevel = "info" | "warning" | "error";

const RETENTION_DAYS = 90;
const MAX_METADATA_LENGTH = 4_000;

type LogInput = { event: string; message: string; level?: LogLevel; source?: LogSource; actorEmail?: string | null; metadata?: Record<string, unknown> | null; host?: string | null; ip?: string | null; userAgent?: string | null };

export function sourceForHost(host: string | null | undefined): LogSource {
  const portal = getAuthPortal(host);
  return portal === "client" ? "clientes" : portal === "management" ? "gestao" : "sistema";
}

/** Detalhes pequenos: objetos grandes viram um aviso em vez de ocupar o banco. */
function boundedMetadata(metadata: Record<string, unknown> | null | undefined) {
  if (!metadata) return Prisma.JsonNull;
  const serialized = JSON.stringify(metadata);
  if (serialized.length <= MAX_METADATA_LENGTH) return JSON.parse(serialized) as Prisma.InputJsonValue;
  return { truncated: true, preview: serialized.slice(0, MAX_METADATA_LENGTH) } as Prisma.InputJsonValue;
}

/**
 * Registra um evento da aplicação. Nunca interrompe o fluxo que está sendo registrado: se a gravação falhar,
 * o erro vai só para o console. Fora de uma requisição (por exemplo, em erros do servidor), informe host, ip e userAgent.
 */
export async function logEvent(input: LogInput) {
  try {
    let host = input.host ?? null;
    let ip = input.ip ?? null;
    let userAgent = input.userAgent ?? null;
    if (!host || !ip || !userAgent) {
      try {
        const requestHeaders = await headers();
        host ??= requestHost(requestHeaders);
        ip ??= (requestHeaders.get("x-forwarded-for") ?? requestHeaders.get("x-real-ip") ?? "").split(",")[0].trim() || null;
        userAgent ??= requestHeaders.get("user-agent");
      } catch { /* fora de uma requisição */ }
    }
    await prisma.systemLog.create({
      data: {
        source: input.source ?? sourceForHost(host),
        level: input.level ?? "info",
        event: input.event.slice(0, 80),
        message: input.message.slice(0, 500),
        actorEmail: input.actorEmail?.slice(0, 254) ?? null,
        ip: ip?.slice(0, 64) ?? null,
        userAgent: userAgent?.slice(0, 300) ?? null,
        metadata: boundedMetadata(input.metadata),
      },
    });
    // Retenção: de vez em quando, apaga o que passou do prazo (usa o índice por data).
    if (Math.random() < 0.02) await prisma.systemLog.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000) } } });
  } catch (error) {
    console.error("Falha ao registrar evento do sistema", error);
  }
}
