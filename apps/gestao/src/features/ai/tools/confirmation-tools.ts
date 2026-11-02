import { prisma } from "@/lib/prisma";
import { defineTool, type AiTool } from "@/features/ai/tools/tool";
import { object, s } from "@/features/ai/tools/schema";

/**
 * Confirmação das alterações. A IA só consegue confirmar uma ação pendente da MESMA conversa, dentro de 30 minutos
 * e se a pessoa escreveu alguma mensagem depois de a ação ser proposta: ela não confirma sozinha no mesmo turno.
 */

export const confirmationTools = [
  defineTool({
    name: "confirmar_acao",
    description: "Executa uma alteração que estava aguardando confirmação, depois que a pessoa respondeu que sim.",
    scopes: ["owner"],
    mutates: false,
    input: object({ acao_id: s.id() }),
    async run(input, context) {
      const { CONFIRMATION_WINDOW_MS, runToolNow } = await import("@/features/ai/services/tool-executor");
      const { findTool } = await import("@/features/ai/tools/registry");
      const action = await prisma.aiAction.findFirst({ where: { id: input.acao_id, conversationId: context.conversationId, status: "PENDING_CONFIRMATION" }, select: { id: true, tool: true, input: true, createdAt: true } });
      if (!action) return { erro: "Não há ação aguardando confirmação com este id nesta conversa." };
      if (Date.now() - action.createdAt.getTime() > CONFIRMATION_WINDOW_MS) {
        await prisma.aiAction.update({ where: { id: action.id }, data: { status: "EXPIRED", decidedAt: new Date() } });
        return { erro: "A confirmação expirou (30 minutos). Proponha a ação de novo." };
      }
      const answered = await prisma.aiMessage.findFirst({ where: { conversationId: context.conversationId, role: "user", createdAt: { gt: action.createdAt } }, select: { id: true } });
      if (!answered) return { erro: "A pessoa ainda não respondeu. Pergunte se pode executar e espere a resposta." };
      const claimed = await prisma.aiAction.updateMany({ where: { id: action.id, status: "PENDING_CONFIRMATION" }, data: { status: "CONFIRMED", decidedAt: new Date() } });
      if (!claimed.count) return { erro: "Esta ação já foi decidida." };
      const tool = findTool(action.tool) as AiTool<never> | null;
      if (!tool) return { erro: "Ferramenta não existe mais." };
      return runToolNow(tool, tool.input.parse(action.input) as never, context, action.input);
    },
  }),

  defineTool({
    name: "cancelar_acao",
    description: "Descarta uma alteração que estava aguardando confirmação, quando a pessoa disse que não.",
    scopes: ["owner"],
    mutates: false,
    input: object({ acao_id: s.id() }),
    async run(input, context) {
      const result = await prisma.aiAction.updateMany({ where: { id: input.acao_id, conversationId: context.conversationId, status: "PENDING_CONFIRMATION" }, data: { status: "CANCELLED", decidedAt: new Date() } });
      return result.count ? { feito: true } : { erro: "Não há ação aguardando confirmação com este id." };
    },
  }),
];
