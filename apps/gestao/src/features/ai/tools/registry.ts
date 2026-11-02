import type { AiToolSpec } from "@/lib/integrations/ai/types";
import type { AiScope, AiTool } from "@/features/ai/tools/tool";
import { financeTools } from "@/features/ai/tools/finance-tools";
import { documentTools } from "@/features/ai/tools/document-tools";
import { monitoringTools } from "@/features/ai/tools/monitoring-tools";
import { clientTools } from "@/features/ai/tools/client-tools";
import { confirmationTools } from "@/features/ai/tools/confirmation-tools";
import { commercialTools } from "@/features/ai/tools/commercial-tools";

/**
 * Todas as ferramentas da IA. Para dar uma capacidade nova à IA, crie a ferramenta (defineTool) no domínio
 * correspondente e acrescente aqui: ela passa a valer na gestão, no portal, no site, no WhatsApp e no MCP,
 * conforme os escopos dela.
 */
const ALL_TOOLS: AiTool<never>[] = [...financeTools, ...documentTools, ...monitoringTools, ...clientTools, ...commercialTools, ...confirmationTools] as unknown as AiTool<never>[];

const byName = new Map(ALL_TOOLS.map((tool) => [tool.name, tool]));
if (byName.size !== ALL_TOOLS.length) throw new Error("Há ferramentas da IA com o mesmo nome.");

export function toolsForScope(scope: AiScope) {
  return ALL_TOOLS.filter((tool) => tool.scopes.includes(scope));
}

export function findTool(name: string) {
  return byName.get(name) ?? null;
}

export function toolSpecs(tools: AiTool<never>[]): AiToolSpec[] {
  return tools.map((tool) => ({ name: tool.name, description: tool.description, parameters: tool.input.json }));
}
