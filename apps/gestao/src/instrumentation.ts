/**
 * Ao subir o servidor, inicia o ciclo do monitoramento (verificações automáticas, certificados, domínios, alertas e
 * resumo diário) e as tarefas do Asaas. Em produção, liga por padrão (MONITORING_SCHEDULER=off desliga); no ambiente local, só com MONITORING_SCHEDULER=on.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const flag = process.env.MONITORING_SCHEDULER?.trim();
  const enabled = process.env.NODE_ENV === "production" ? flag !== "off" : flag === "on";
  if (!enabled) return;
  const { startMonitoringScheduler } = await import("@/features/monitoring/services/monitoring-scheduler");
  startMonitoringScheduler();
}

/**
 * Erros não tratados em páginas, rotas de API e ações do servidor viram eventos de nível "error" nos logs
 * do sistema (Configurações > Logs). Redirecionamentos e páginas não encontradas não são erros.
 */
export async function onRequestError(error: unknown, request: { path: string; method: string; headers: Record<string, string | string[] | undefined> }, context: { routerKind: string; routePath: string; routeType: string }) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const digest = typeof error === "object" && error && "digest" in error ? String((error as { digest?: unknown }).digest ?? "") : "";
  if (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND") || digest.startsWith("NEXT_HTTP_ERROR")) return;
  const header = (name: string) => { const value = request.headers[name]; return Array.isArray(value) ? value[0] : value ?? null; };
  const { logEvent } = await import("@/features/system-logs/services/system-log");
  const message = error instanceof Error ? error.message : String(error);
  await logEvent({
    level: "error",
    event: "server.error",
    message: `${request.method} ${request.path}: ${message}`,
    host: header("x-forwarded-host")?.split(",")[0]?.trim() || header("host"),
    ip: (header("x-forwarded-for") ?? "").split(",")[0].trim() || null,
    userAgent: header("user-agent"),
    metadata: { route: context.routePath, routeType: context.routeType, routerKind: context.routerKind, digest: digest || null, name: error instanceof Error ? error.name : null, stack: error instanceof Error ? error.stack?.split("\n").slice(0, 6).join("\n") : null },
  });
}
