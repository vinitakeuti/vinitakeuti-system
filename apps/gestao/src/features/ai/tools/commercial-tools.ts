import { ServiceBillingType, ServicePricingMethod } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { defineTool, day, reais } from "@/features/ai/tools/tool";
import { object, s } from "@/features/ai/tools/schema";
import { createClientRecord, findSimilarClients, updateClientRecord } from "@/features/clients/services/client-service";
import { createCatalogServiceRecord, listCatalogForQuotes } from "@/features/services/services/service-catalog-service";
import { createQuoteFromServices, MAX_QUOTE_ITEMS, updateQuoteServices, type QuoteLine } from "@/features/quotes/services/quote-builder";

/**
 * Comercial (só para você): cadastrar e atualizar clientes, consultar e ampliar o catálogo de serviços e montar
 * orçamentos com os serviços escolhidos. Cliente e orçamento em rascunho não pedem confirmação (dá para editar
 * depois); um serviço novo no catálogo pede, porque passa a valer para todos os orçamentos.
 */

const PRICING = { fixo: ServicePricingMethod.FIXED, por_hora: ServicePricingMethod.HOURLY, por_dia: ServicePricingMethod.DAILY, personalizado: ServicePricingMethod.CUSTOM } as const;
const PRICING_LABEL: Record<ServicePricingMethod, keyof typeof PRICING> = { FIXED: "fixo", HOURLY: "por_hora", DAILY: "por_dia", CUSTOM: "personalizado" };
const CYCLES = { mensal: "MONTHLY", trimestral: "QUARTERLY", semestral: "SEMIANNUAL", anual: "YEARLY" } as const;
const CYCLE_LABEL: Record<string, string> = { MONTHLY: "mensal", QUARTERLY: "trimestral", SEMIANNUAL: "semestral", YEARLY: "anual" };

function refresh(paths: string[]) {
  try { for (const path of paths) revalidatePath(path); } catch { /* fora de uma requisição */ }
}

const clientFields = {
  empresa: s.optional(s.string({ max: 160, description: "Razão social ou nome da empresa" })),
  email: s.optional(s.string({ max: 254 })),
  telefone: s.optional(s.string({ max: 40 })),
  cpf: s.optional(s.string({ max: 20, description: "Só se a pessoa informar" })),
  cnpj: s.optional(s.string({ max: 24, description: "Só se a pessoa informar" })),
  cidade: s.optional(s.string({ max: 120 })),
  endereco: s.optional(s.string({ max: 500 })),
  observacoes: s.optional(s.string({ max: 4_000 })),
};

type ClientInput = { empresa?: string; email?: string; telefone?: string; cpf?: string; cnpj?: string; cidade?: string; endereco?: string; observacoes?: string };
const toClientFields = (input: ClientInput) => ({ company: input.empresa, email: input.email, phone: input.telefone, cpf: input.cpf, cnpj: input.cnpj, city: input.cidade, address: input.endereco, notes: input.observacoes });

const quoteItem = object({
  servico_id: s.id({ description: "id do serviço em servicos_listar" }),
  quantidade: s.optional(s.integer({ min: 1, max: 10_000, description: "Horas, diárias ou unidades. Padrão: 1" })),
  valor_unitario: s.optional(s.money({ description: "Valor por hora, diária ou unidade. Padrão: o valor de referência do catálogo" })),
  cobranca: s.optional(s.enum(["fixo", "por_hora", "por_dia", "personalizado"] as const, { description: "Padrão: a do catálogo" })),
});

const toLines = (items: Array<{ servico_id: string; quantidade?: number; valor_unitario?: number; cobranca?: keyof typeof PRICING }>): QuoteLine[] => items.map((item) => ({ serviceId: item.servico_id, quantity: item.quantidade, unitCents: item.valor_unitario, pricingMethod: item.cobranca ? PRICING[item.cobranca] : undefined }));

async function quoteSummary(quoteId: string) {
  const quote = await prisma.quote.findUnique({ where: { id: quoteId }, select: { id: true, code: true, title: true, status: true, completedAt: true, amountCents: true, discountCents: true, validUntil: true, terms: true, client: { select: { id: true, name: true } }, items: { orderBy: { createdAt: "asc" }, select: { name: true, categoryName: true, pricingMethod: true, billingType: true, billingCycle: true, quantity: true, unitAmountCents: true, totalAmountCents: true, serviceCatalogItemId: true } }, sale: { select: { code: true, status: true } } } });
  if (!quote) return null;
  return {
    id: quote.id, codigo: quote.code, titulo: quote.title, cliente: quote.client, situacao: quote.completedAt ? "concluido" : "rascunho", venda: quote.sale ? `${quote.sale.code} (${quote.sale.status})` : null,
    itens: quote.items.map((item) => ({ servico_id: item.serviceCatalogItemId, servico: item.name, categoria: item.categoryName, cobranca: PRICING_LABEL[item.pricingMethod], recorrente: item.billingType === ServiceBillingType.RECURRING ? CYCLE_LABEL[item.billingCycle ?? ""] ?? "sim" : undefined, quantidade: item.quantity, valor_unitario: reais(item.unitAmountCents), total: reais(item.totalAmountCents) })),
    subtotal: reais(quote.amountCents + quote.discountCents), desconto: reais(quote.discountCents), total: reais(quote.amountCents), valido_ate: day(quote.validUntil), condicoes: quote.terms,
    editor: `/orcamentos/${quote.id}/editor`, pagina: `/orcamentos/${quote.id}`,
  };
}

export const commercialTools = [
  defineTool({
    name: "clientes_criar",
    description: "Cadastra um cliente novo. Antes, confira com clientes_buscar se ele já existe. Se houver nomes parecidos, a ferramenta devolve os possíveis duplicados e não cadastra: pergunte à pessoa e, se for mesmo outro cliente, chame de novo com mesmo_assim=true. Peça os dados que faltarem (e-mail, telefone, CNPJ ou CPF, cidade), mas não invente nenhum.",
    scopes: ["owner"],
    mutates: true,
    confirm: false,
    input: object({ nome: s.string({ min: 2, max: 160, description: "Nome do cliente (pessoa ou empresa)" }), ...clientFields, mesmo_assim: s.optional(s.boolean({ description: "Cadastrar mesmo havendo nomes parecidos" })) }),
    async run(input) {
      if (!input.mesmo_assim) {
        const similar = await findSimilarClients(input.nome);
        if (similar.length) return { cadastrado: false, possiveis_duplicados: similar.map((client) => ({ id: client.id, nome: client.name, empresa: client.company, email: client.email })), instrucao: "Pergunte se é um destes clientes. Se for outro, chame clientes_criar de novo com mesmo_assim=true." };
      }
      const result = await createClientRecord({ name: input.nome, ...toClientFields(input) });
      if (!result.ok) return { erro: result.error };
      refresh(["/clientes"]);
      return { feito: true, cliente_id: result.client.id, nome: result.client.name, perfil: `/clientes/${result.client.id}` };
    },
  }),

  defineTool({
    name: "clientes_atualizar",
    description: "Atualiza dados de um cliente (só os campos informados mudam). Use para completar o cadastro com os dados que a pessoa passar.",
    scopes: ["owner"],
    mutates: true,
    confirm: false,
    input: object({ cliente_id: s.id(), nome: s.optional(s.string({ min: 2, max: 160 })), ...clientFields }),
    async run(input) {
      const result = await updateClientRecord(input.cliente_id, { name: input.nome, ...toClientFields(input) });
      if (!result.ok) return { erro: result.error };
      refresh(["/clientes", `/clientes/${result.clientId}`]);
      return { feito: true, cliente_id: result.clientId, perfil: `/clientes/${result.clientId}` };
    },
  }),

  defineTool({
    name: "servicos_listar",
    description: "Catálogo de serviços ativos com id, categoria, forma de cobrança (fixo, por hora, por dia, personalizado), valor de referência e se é recorrente. Use para conferir se os serviços pedidos existem antes de montar um orçamento, comparando pelo sentido (ex.: \"loja virtual\" pode ser \"E-commerce\").",
    scopes: ["owner"],
    mutates: false,
    input: object({}),
    async run() {
      const { services, categories } = await listCatalogForQuotes();
      return {
        servicos: services.map((service) => ({ id: service.id, nome: service.name, categoria: service.category.name, cobranca: PRICING_LABEL[service.pricingMethod], valor_referencia: service.pricingMethod === ServicePricingMethod.CUSTOM ? "definido no orçamento" : reais(service.defaultAmountCents), recorrente: service.billingType === ServiceBillingType.RECURRING ? CYCLE_LABEL[service.billingCycle ?? ""] ?? "sim" : "não", descricao: service.description?.slice(0, 240) ?? null })),
        categorias: categories.map((category) => category.name),
      };
    },
  }),

  defineTool({
    name: "servicos_criar",
    description: "Cadastra um serviço novo no catálogo, quando o pedido não corresponde a nenhum serviço existente. Pergunte o valor de referência e a forma de cobrança se a pessoa não disse. Use uma categoria existente sempre que fizer sentido.",
    scopes: ["owner"],
    mutates: true,
    input: object({
      categoria: s.string({ min: 2, max: 80, description: "Nome da categoria (existente ou nova)" }),
      nome: s.string({ min: 2, max: 140 }),
      descricao: s.optional(s.string({ max: 2_000, description: "Descrição curta, para uso interno" })),
      texto_da_proposta: s.optional(s.longText({ max: 4_000, description: "Texto do serviço na proposta, em Markdown" })),
      cobranca: s.enum(["fixo", "por_hora", "por_dia", "personalizado"] as const),
      valor_referencia: s.optional(s.money({ description: "Valor de referência (por projeto, hora ou dia). Não informe no personalizado" })),
      recorrente: s.optional(s.enum(["mensal", "trimestral", "semestral", "anual"] as const, { description: "Só para serviços cobrados de forma recorrente" })),
    }),
    summarize: (input) => `Novo serviço no catálogo: ${input.nome} (${input.categoria}) · ${input.cobranca.replace("_", " ")}${input.valor_referencia ? ` · ${reais(input.valor_referencia)}` : ""}${input.recorrente ? ` · ${input.recorrente}` : ""}`,
    async run(input) {
      const result = await createCatalogServiceRecord({ categoryName: input.categoria, name: input.nome, description: input.descricao, proposalMarkdown: input.texto_da_proposta, pricingMethod: PRICING[input.cobranca], defaultAmountCents: input.valor_referencia, billingType: input.recorrente ? ServiceBillingType.RECURRING : ServiceBillingType.ONE_TIME, billingCycle: input.recorrente ? CYCLES[input.recorrente] : null });
      if (!result.ok) return { erro: result.error };
      refresh(["/servicos"]);
      return { feito: true, servico_id: result.service.id, nome: result.service.name, categoria_criada: result.categoryCreated };
    },
  }),

  defineTool({
    name: "orcamentos_criar",
    description: "Cria um orçamento (proposta comercial) em RASCUNHO para um cliente, com os serviços do catálogo escolhidos. Ele abre no editor de PDF já com os serviços; os textos da proposta são combinados depois. Informe o link do editor ao final.",
    scopes: ["owner"],
    mutates: true,
    confirm: false,
    input: object({
      cliente_id: s.id(),
      titulo: s.string({ min: 2, max: 180, description: "Ex.: Site institucional com pagamento online" }),
      itens: s.list(quoteItem, { min: 1, max: MAX_QUOTE_ITEMS }),
      desconto_valor: s.optional(s.money({ description: "Desconto fixo" })),
      desconto_percentual: s.optional(s.decimal({ min: 0, max: 100, description: "Desconto em %" })),
      valido_ate: s.optional(s.date({ description: "Validade da proposta" })),
    }),
    async run(input) {
      const result = await createQuoteFromServices({ clientId: input.cliente_id, title: input.titulo, lines: toLines(input.itens), discount: input.desconto_percentual !== undefined ? { percent: input.desconto_percentual } : input.desconto_valor !== undefined ? { amountCents: input.desconto_valor } : undefined, validUntil: input.valido_ate });
      if (!result.ok) return { erro: result.error };
      refresh(["/orcamentos", "/orcamentos/pendentes", "/vendas", `/clientes/${input.cliente_id}`]);
      return { feito: true, orcamento: await quoteSummary(result.quote.id) };
    },
  }),

  defineTool({
    name: "orcamentos_alterar_servicos",
    description: "Troca a lista de serviços de um orçamento em rascunho (a lista informada substitui a atual) e, se pedido, o título, o desconto e a validade. Orçamentos concluídos não mudam por aqui. Leia antes com orcamentos_detalhes.",
    scopes: ["owner"],
    mutates: true,
    confirm: false,
    input: object({
      orcamento_id: s.id(),
      itens: s.list(quoteItem, { min: 1, max: MAX_QUOTE_ITEMS }),
      titulo: s.optional(s.string({ min: 2, max: 180 })),
      desconto_valor: s.optional(s.money()),
      desconto_percentual: s.optional(s.decimal({ min: 0, max: 100 })),
      valido_ate: s.optional(s.date()),
    }),
    async run(input) {
      const result = await updateQuoteServices({ quoteId: input.orcamento_id, title: input.titulo, lines: toLines(input.itens), discount: input.desconto_percentual !== undefined ? { percent: input.desconto_percentual } : input.desconto_valor !== undefined ? { amountCents: input.desconto_valor } : undefined, validUntil: input.valido_ate });
      if (!result.ok) return { erro: result.error };
      refresh(["/orcamentos", "/orcamentos/pendentes", `/orcamentos/${result.quote.id}`, `/clientes/${result.quote.clientId}`]);
      return { feito: true, orcamento: await quoteSummary(result.quote.id) };
    },
  }),

  defineTool({
    name: "orcamentos_detalhes",
    description: "Detalhes de um orçamento: cliente, serviços com quantidades e valores, desconto, total, validade e situação.",
    scopes: ["owner"],
    mutates: false,
    input: object({ orcamento_id: s.id() }),
    async run(input) {
      return (await quoteSummary(input.orcamento_id)) ?? { erro: "Orçamento não encontrado." };
    },
  }),

  defineTool({
    name: "orcamentos_listar",
    description: "Orçamentos mais recentes (de um cliente, se informado), com situação rascunho ou concluído e total.",
    scopes: ["owner"],
    mutates: false,
    input: object({ cliente_id: s.optional(s.id()) }),
    async run(input) {
      const quotes = await prisma.quote.findMany({ where: input.cliente_id ? { clientId: input.cliente_id } : {}, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 20, select: { id: true, code: true, title: true, amountCents: true, completedAt: true, createdAt: true, client: { select: { name: true } } } });
      return { orcamentos: quotes.map((quote) => ({ id: quote.id, codigo: quote.code, titulo: quote.title, cliente: quote.client.name, total: reais(quote.amountCents), situacao: quote.completedAt ? "concluido" : "rascunho", criado_em: day(quote.createdAt) })) };
    },
  }),
];
