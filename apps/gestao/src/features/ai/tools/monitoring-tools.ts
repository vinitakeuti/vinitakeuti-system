import { prisma } from "@/lib/prisma";
import { defineTool, day } from "@/features/ai/tools/tool";
import { object, s } from "@/features/ai/tools/schema";
import { listMonitoredApps, listMonitoringIncidents } from "@/features/monitoring/queries/monitoring-queries";
import { checkMonitoredApp } from "@/features/monitoring/services/monitoring-service";
import { checkStackUpdates, readStackUpdates } from "@/features/monitoring/services/stack-updates";

/** Sistemas monitorados: situação, verificação na hora e atualizações disponíveis na stack. Só para você. */

const statusLabel = { OPERATIONAL: "no ar", DEGRADED: "degradado", DOWN: "fora do ar", UNKNOWN: "não verificado" } as const;

export const monitoringTools = [
  defineTool({
    name: "sistemas_listar",
    description: "Lista os sistemas monitorados com a situação (no ar, degradado, fora do ar), a última verificação, o vencimento do certificado e do domínio e quantas atualizações de pacotes estão disponíveis.",
    scopes: ["owner"],
    mutates: false,
    input: object({ cliente_id: s.optional(s.id()) }),
    async run(input) {
      const result = await listMonitoredApps({ clientId: input.cliente_id });
      const updates = await prisma.monitoredApp.findMany({ where: { id: { in: result.data.map((app) => app.id) } }, select: { id: true, stackUpdates: true, stackCheckedAt: true } });
      const byApp = new Map(updates.map((app) => [app.id, app]));
      return {
        sistemas: result.data.map((app) => {
          const stack = byApp.get(app.id);
          const pending = readStackUpdates(stack?.stackUpdates ?? null);
          return { id: app.id, nome: app.name, cliente: app.client?.name ?? null, url: app.url, situacao: statusLabel[app.status], ultima_verificacao: app.lastCheckedAt?.toISOString() ?? null, resposta_ms: app.lastResponseMs, resumo: app.lastCheckSummary, certificado_vence: day(app.sslExpiresAt), dominio_vence: day(app.domainExpiresAt), atualizacoes_disponiveis: stack?.stackCheckedAt ? pending.length : "stack não informada" };
        }),
      };
    },
  }),

  defineTool({
    name: "sistemas_detalhes",
    description: "Detalhes de um sistema: situação, últimos incidentes, stack informada e as atualizações de pacotes disponíveis (major, minor, patch).",
    scopes: ["owner"],
    mutates: false,
    input: object({ sistema_id: s.id() }),
    async run(input) {
      const app = await prisma.monitoredApp.findUnique({ where: { id: input.sistema_id }, select: { id: true, name: true, url: true, status: true, lastCheckedAt: true, lastCheckSummary: true, lastIncidentAt: true, sslExpiresAt: true, sslError: true, domainName: true, domainExpiresAt: true, stack: true, stackUpdates: true, stackCheckedAt: true, client: { select: { name: true } } } });
      if (!app) return { erro: "Sistema não encontrado." };
      const incidents = await listMonitoringIncidents(app.id);
      return {
        id: app.id, nome: app.name, cliente: app.client?.name ?? null, url: app.url, situacao: statusLabel[app.status], ultima_verificacao: app.lastCheckedAt?.toISOString() ?? null, resumo: app.lastCheckSummary,
        certificado: { vence: day(app.sslExpiresAt), erro: app.sslError }, dominio: { nome: app.domainName, vence: day(app.domainExpiresAt) },
        incidentes_recentes: incidents.slice(0, 8).map((event) => ({ titulo: event.title, detalhes: event.details, inicio: event.occurredAt.toISOString(), fim: event.resolvedAt?.toISOString() ?? null })),
        stack: app.stack ?? "não informada pelo endpoint de saúde",
        atualizacoes: readStackUpdates(app.stackUpdates),
        stack_conferida_em: app.stackCheckedAt?.toISOString() ?? null,
      };
    },
  }),

  defineTool({
    name: "sistemas_verificar_agora",
    description: "Verifica agora se um sistema está no ar (consulta o endpoint de saúde) e devolve o resultado.",
    scopes: ["owner"],
    mutates: false,
    input: object({ sistema_id: s.id() }),
    async run(input) {
      const exists = await prisma.monitoredApp.findUnique({ where: { id: input.sistema_id }, select: { id: true } });
      if (!exists) return { erro: "Sistema não encontrado." };
      const result = await checkMonitoredApp(input.sistema_id);
      return { situacao: statusLabel[result.status], resposta_ms: result.responseMs, http: result.statusCode ?? null, resumo: result.details ?? null };
    },
  }),

  defineTool({
    name: "sistemas_verificar_atualizacoes",
    description: "Confere agora, no npm/PyPI, se há versões novas dos pacotes da stack de um sistema (a conferência automática roda uma vez por dia).",
    scopes: ["owner"],
    mutates: false,
    input: object({ sistema_id: s.id() }),
    async run(input) {
      const app = await prisma.monitoredApp.findUnique({ where: { id: input.sistema_id }, select: { id: true, stack: true } });
      if (!app) return { erro: "Sistema não encontrado." };
      if (!app.stack) return { erro: "O endpoint de saúde deste sistema ainda não informa a stack (campo \"stack\" do guia de integração)." };
      const result = await checkStackUpdates(app.id);
      return { pacotes_conferidos: result.packages, atualizacoes: result.updates };
    },
  }),
];
