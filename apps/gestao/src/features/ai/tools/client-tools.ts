import { prisma } from "@/lib/prisma";
import { defineTool, day, reais } from "@/features/ai/tools/tool";
import { object, s } from "@/features/ai/tools/schema";
import { searchClientOptions } from "@/features/clients/queries/client-queries";
import { getPortalContact, getPortalDocuments, getPortalServices, loadReceivables } from "@/features/client-portal/queries/portal-queries";

/**
 * Clientes (para você) e a área do cliente (para o próprio cliente no portal). As ferramentas do escopo "client"
 * nunca recebem um id de cliente do modelo: usam o cliente da sessão (contexto), então não há como ler outro cadastro.
 */

function requireClient(clientId: string | null) {
  if (!clientId) throw new Error("Conversa sem cliente.");
  return clientId;
}

const projectStatus: Record<string, string> = { PROPOSAL: "proposta", PLANNING: "em planejamento", IN_PROGRESS: "em andamento", WAITING_CLIENT: "aguardando seu retorno", DELIVERED: "entregue", PAUSED: "pausado" };
const systemStatus = { OPERATIONAL: "no ar", DEGRADED: "lento ou instável", DOWN: "fora do ar", UNKNOWN: "ainda não verificado" } as const;

export const clientTools = [
  defineTool({
    name: "clientes_buscar",
    description: "Busca clientes por nome, empresa ou e-mail e devolve o id (usado pelas outras ferramentas). Sem busca, traz os mais recentes.",
    scopes: ["owner"],
    mutates: false,
    input: object({ busca: s.optional(s.string({ max: 100 })) }),
    async run(input) {
      const clients = await searchClientOptions(input.busca);
      return { clientes: clients.map((client) => ({ id: client.id, nome: client.name, empresa: client.company })) };
    },
  }),

  defineTool({
    name: "clientes_detalhes",
    description: "Ficha de um cliente: contato, quanto falta receber dele, documentos concluídos, serviços e sistemas.",
    scopes: ["owner"],
    mutates: false,
    input: object({ cliente_id: s.id() }),
    async run(input) {
      const client = await prisma.client.findUnique({ where: { id: input.cliente_id }, select: { id: true, name: true, company: true, email: true, phone: true, city: true, notes: true } });
      if (!client) return { erro: "Cliente não encontrado." };
      const [receivables, documents, services] = await Promise.all([loadReceivables(client.id), getPortalDocuments(client.id, 10), getPortalServices(client.id)]);
      return {
        cliente: { id: client.id, nome: client.name, empresa: client.company, email: client.email, telefone: client.phone, cidade: client.city, observacoes: client.notes },
        financeiro: { contratado: reais(receivables.totals.contractedCents), pago: reais(receivables.totals.paidCents), em_aberto: reais(receivables.totals.remainingCents), atrasado: reais(receivables.overdue.amountCents) },
        documentos: documents.map((document) => ({ codigo: document.code, titulo: document.title, concluido_em: day(document.completedAt), assinatura: document.signed?.reviewStatus ?? "não enviada" })),
        vendas: services.sales.map((sale) => ({ codigo: sale.code, titulo: sale.title, valor: reais(sale.amountCents), situacao: sale.status })),
        sistemas: services.systems.map((system) => ({ id: system.id, nome: system.name, situacao: systemStatus[system.status] })),
      };
    },
  }),

  defineTool({
    name: "meus_pagamentos",
    description: "Pagamentos do cliente: total contratado, pago, em aberto, parcelas atrasadas e próximas parcelas com vencimento e valor.",
    scopes: ["client"],
    mutates: false,
    input: object({}),
    async run(_input, context) {
      const receivables = await loadReceivables(requireClient(context.clientId));
      return {
        totais: { contratado: reais(receivables.totals.contractedCents), pago: reais(receivables.totals.paidCents), em_aberto: reais(receivables.totals.remainingCents) },
        atrasado: { parcelas: receivables.overdue.count, valor: reais(receivables.overdue.amountCents) },
        proximas_parcelas: receivables.open.slice(0, 12).map((item) => ({ referente_a: item.entryDescription, parcela: item.number ? `${item.number} de ${item.total}` : "única", vencimento: day(item.dueDate), valor: reais(item.remaining), atrasada: item.overdue })),
        onde_pagar: "Na área do cliente, em Pagamentos.",
      };
    },
  }),

  defineTool({
    name: "meus_documentos",
    description: "Documentos do cliente (propostas, contratos, memoriais) e a situação da via assinada de cada um.",
    scopes: ["client"],
    mutates: false,
    input: object({}),
    async run(_input, context) {
      const documents = await getPortalDocuments(requireClient(context.clientId), 20);
      const review = { IN_REVIEW: "em conferência", APPROVED: "assinatura confirmada", REJECTED: "via recusada, enviar de novo" } as const;
      return { documentos: documents.map((document) => ({ codigo: document.code, titulo: document.title, disponivel_em: day(document.completedAt), assinatura: document.signed ? review[document.signed.reviewStatus] : "aguardando assinatura" })), onde_ver: "Na área do cliente, em Documentos." };
    },
  }),

  defineTool({
    name: "meus_servicos",
    description: "Serviços contratados pelo cliente, assinaturas, projetos (e a situação de cada um) e se os sistemas dele estão no ar.",
    scopes: ["client"],
    mutates: false,
    input: object({}),
    async run(_input, context) {
      const services = await getPortalServices(requireClient(context.clientId));
      return {
        servicos: services.sales.map((sale) => ({ titulo: sale.title, contratado_em: day(sale.confirmedAt ?? sale.createdAt), itens: sale.quote?.items.map((item) => item.name) ?? [] })),
        assinaturas: services.subscriptions.map((subscription) => ({ nome: subscription.name, valor: reais(subscription.amountCents), ciclo: subscription.billingCycle, proximo_pagamento: day(subscription.nextPaymentAt) })),
        projetos: services.projects.map((project) => ({ nome: project.name, situacao: projectStatus[project.status] ?? project.status, entrega_prevista: day(project.deliveryAt) })),
        sistemas: services.systems.map((system) => ({ nome: system.name, situacao: systemStatus[system.status], verificado_em: system.lastCheckedAt?.toISOString() ?? null })),
      };
    },
  }),

  defineTool({
    name: "contato",
    description: "Como falar com Vinicius Riudi: nome, e-mail, telefone e site.",
    scopes: ["client", "public"],
    mutates: false,
    input: object({}),
    async run() {
      const contact = await getPortalContact();
      return { nome: contact.name, email: contact.email, telefone: contact.phone, site: contact.website };
    },
  }),

  defineTool({
    name: "servicos_oferecidos",
    description: "Catálogo de serviços oferecidos (nome, categoria, descrição e forma de cobrança), para explicar o que é feito. Não traz preços: orçamento é feito sob medida.",
    scopes: ["public", "client"],
    mutates: false,
    input: object({ busca: s.optional(s.string({ max: 80 })) }),
    async run(input) {
      const services = await prisma.serviceCatalogItem.findMany({
        where: { isActive: true, ...(input.busca ? { OR: [{ name: { contains: input.busca, mode: "insensitive" as const } }, { description: { contains: input.busca, mode: "insensitive" as const } }] } : {}) },
        orderBy: [{ category: { name: "asc" } }, { name: "asc" }, { id: "asc" }],
        take: 40,
        select: { name: true, description: true, billingType: true, billingCycle: true, category: { select: { name: true } } },
      });
      return { servicos: services.map((service) => ({ nome: service.name, categoria: service.category.name, descricao: service.description?.slice(0, 400) ?? null, cobranca: service.billingType === "RECURRING" ? `recorrente${service.billingCycle ? ` (${service.billingCycle})` : ""}` : "por projeto" })) };
    },
  }),
];
