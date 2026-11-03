import { FinancialEntryStatus, FinancialEntryType, SaleStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { defineTool, day, reais, todayIso } from "@/features/ai/tools/tool";
import { object, s } from "@/features/ai/tools/schema";
import { getFinanceSummary, getUpcomingCommitments, getUpcomingReceivables, listFinancialEntries, FINANCE_CATEGORIES } from "@/features/finance/queries/finance-queries";
import { createFinancialEntry, payNextInstallment, registerFinancialPayment } from "@/features/finance/services/finance-service";
import { listOpenQuoteOpportunities, listSales, saleStatusLabel } from "@/features/sales/queries/sale-queries";
import { changeSaleStatus, confirmQuoteSale } from "@/features/sales/services/sale-service";

/** Financeiro e vendas, só para você (escopo "owner"). Valores chegam em reais e são gravados em centavos. */

/** As telas do Financeiro são renderizadas no servidor; depois de uma alteração pela IA, a próxima visita já mostra o novo dado. */
function refreshFinance(entryId?: string) {
  try {
    revalidatePath("/financeiro");
    revalidatePath("/vendas");
    if (entryId) revalidatePath(`/financeiro/lancamentos/${entryId}`);
  } catch { /* fora de uma requisição (agendador): as páginas são dinâmicas e leem o banco na próxima visita */ }
}

const statusFilter = { a_receber_ou_pagar: FinancialEntryStatus.PENDING, realizado: FinancialEntryStatus.SETTLED, cancelado: FinancialEntryStatus.CANCELLED } as const;

export const financeTools = [
  defineTool({
    name: "financeiro_resumo",
    description: "Resumo do Financeiro num período: realizado (entradas e saídas pagas), a receber, a pagar, saldo, previsão e atrasos. Também traz as cobranças dos próximos 7 dias, as atrasadas e os compromissos (saídas) da semana. Sem datas, considera o mês atual.",
    scopes: ["owner"],
    mutates: false,
    input: object({ de: s.optional(s.date({ description: "Início do período" })), ate: s.optional(s.date({ description: "Fim do período" })) }),
    async run(input) {
      const today = todayIso();
      const from = input.de ?? `${today.slice(0, 7)}-01`;
      const [year, month] = today.split("-").map(Number);
      const to = input.ate ?? `${today.slice(0, 7)}-${String(new Date(Date.UTC(year, month, 0)).getUTCDate()).padStart(2, "0")}`;
      const [summary, receivables, commitments] = await Promise.all([getFinanceSummary({ from, to }), getUpcomingReceivables(10), getUpcomingCommitments(10)]);
      return {
        periodo: { de: from, ate: to },
        realizado: { entradas: reais(summary.incomeSettled), saidas: reais(summary.expenseSettled), saldo: reais(summary.balance) },
        pendente: { a_receber: reais(summary.incomePending), a_pagar: reais(summary.expensePending), previsao_saldo: reais(summary.forecast) },
        atrasado: { valor: reais(summary.overdueAmount), parcelas: summary.overdueCount },
        cobrancas_proximas_e_atrasadas: receivables.items.map((item) => ({ lancamento_id: item.entryId, descricao: item.description, cliente: item.counterparty, parcela: `${item.number}/${item.total}`, vencimento: day(item.dueDate), em_aberto: reais(item.remaining), atrasada: item.overdue })),
        compromissos_da_semana: commitments.items.map((item) => ({ lancamento_id: item.id, descricao: item.description, para: item.counterparty, valor: reais(item.amountCents), vencimento: day(item.dueDate) })),
      };
    },
  }),

  defineTool({
    name: "financeiro_listar_lancamentos",
    description: "Lista lançamentos do Financeiro (entradas e saídas), mais recentes primeiro, 50 por página. Use para encontrar um lançamento (o id) antes de registrar recebimento, ou para verificar datas e valores.",
    scopes: ["owner"],
    mutates: false,
    input: object({
      busca: s.optional(s.string({ max: 120, description: "Texto na descrição, categoria ou cliente/fornecedor" })),
      tipo: s.optional(s.enum(["entrada", "saida"] as const)),
      situacao: s.optional(s.enum(["a_receber_ou_pagar", "realizado", "cancelado"] as const)),
      de: s.optional(s.date({ description: "Vencimento ou recebimento a partir de" })),
      ate: s.optional(s.date({ description: "Vencimento ou recebimento até" })),
      cursor: s.optional(s.id({ description: "proxima_pagina da resposta anterior" })),
    }),
    async run(input) {
      const result = await listFinancialEntries({ query: input.busca, type: input.tipo === "entrada" ? FinancialEntryType.INCOME : input.tipo === "saida" ? FinancialEntryType.EXPENSE : undefined, status: input.situacao ? statusFilter[input.situacao] : undefined, from: input.de, to: input.ate, cursor: input.cursor });
      return {
        lancamentos: result.data.map((entry) => ({ id: entry.id, tipo: entry.type === FinancialEntryType.INCOME ? "entrada" : "saida", situacao: entry.status, descricao: entry.description, categoria: entry.category, contraparte: entry.counterparty, valor: reais(entry.amountCents), pago: reais(entry.paidCents), vencimento: day(entry.dueDate), realizado_em: day(entry.settledAt), parcelas: entry.installments.length || undefined, condicao: entry.paymentCondition ?? undefined })),
        proxima_pagina: result.nextCursor,
      };
    },
  }),

  defineTool({
    name: "financeiro_adicionar_lancamento",
    description: `Adiciona um lançamento no Financeiro. Se o lançamento for de um cliente cadastrado, procure-o (clientes_buscar) e envie cliente_id: ele aparece no perfil do cliente. Saída (gasto) conta como paga na data. Entrada fica a receber, a menos que "recebido" seja true; pode ser parcelada. "recorrente" cria um lançamento mensal fixo (ex.: assinatura, aluguel). Categorias usadas: ${FINANCE_CATEGORIES.join(", ")}.`,
    scopes: ["owner"],
    mutates: true,
    input: object({
      tipo: s.enum(["entrada", "saida"] as const),
      descricao: s.string({ min: 2, max: 180 }),
      valor: s.money(),
      vencimento: s.date({ description: "Vencimento (ou data do gasto)" }),
      categoria: s.optional(s.string({ max: 80 })),
      contraparte: s.optional(s.string({ max: 160, description: "Fornecedor ou pessoa sem cadastro (com cliente cadastrado, use cliente_id)" })),
      cliente_id: s.optional(s.id({ description: "Cliente cadastrado (use clientes_buscar); vincula o lançamento ao perfil dele" })),
      observacoes: s.optional(s.string({ max: 500 })),
      recebido: s.optional(s.boolean({ description: "Só entradas: já foi recebida" })),
      parcelas: s.optional(s.integer({ min: 1, max: 60, description: "Só entradas a receber: número de parcelas mensais" })),
      recorrente: s.optional(s.boolean({ description: "Repete todo mês" })),
    }),
    summarize: (input) => `${input.tipo === "saida" ? "Saída" : "Entrada"} de ${reais(input.valor)} · ${input.descricao} · vencimento ${input.vencimento}${input.recorrente ? " · mensal" : ""}${input.parcelas && input.parcelas > 1 ? ` · ${input.parcelas}x` : ""}`,
    async run(input) {
      const result = await createFinancialEntry({ type: input.tipo === "saida" ? FinancialEntryType.EXPENSE : FinancialEntryType.INCOME, description: input.descricao, amountCents: input.valor, dueDate: input.vencimento, category: input.categoria, counterparty: input.contraparte, clientId: input.cliente_id, notes: input.observacoes, received: input.recebido, installments: input.parcelas, recurring: input.recorrente });
      if (!result.ok) return { erro: result.error };
      refreshFinance(result.kind === "entry" ? result.id : undefined);
      return { feito: true, tipo: result.kind === "recurring" ? "recorrencia_mensal" : "lancamento", id: result.id, link: result.kind === "entry" ? `/financeiro/lancamentos/${result.id}` : "/financeiro/custos-fixos" };
    },
  }),

  defineTool({
    name: "financeiro_registrar_recebimento",
    description: "Registra um recebimento (valor parcial ou total) numa entrada do Financeiro. O cliente recebe o recibo por e-mail. Para baixar exatamente a próxima parcela, prefira financeiro_baixar_proxima_parcela.",
    scopes: ["owner"],
    mutates: true,
    input: object({ lancamento_id: s.id(), valor: s.money(), data: s.date({ description: "Data do recebimento" }), observacoes: s.optional(s.string({ max: 300 })) }),
    summarize: (input) => `Recebimento de ${reais(input.valor)} em ${input.data} no lançamento ${input.lancamento_id}`,
    async run(input) {
      const result = await registerFinancialPayment({ entryId: input.lancamento_id, amountCents: input.valor, paidAt: input.data, notes: input.observacoes });
      if (!result.ok) return { erro: result.error };
      refreshFinance(input.lancamento_id);
      return { feito: true, recebimento_id: result.paymentId };
    },
  }),

  defineTool({
    name: "financeiro_baixar_proxima_parcela",
    description: "Marca como paga a próxima parcela em aberto de uma entrada (ou o que falta, se não houver parcelas). O cliente recebe o recibo por e-mail.",
    scopes: ["owner"],
    mutates: true,
    input: object({ lancamento_id: s.id(), data: s.date({ description: "Data do pagamento" }) }),
    summarize: (input) => `Baixar a próxima parcela do lançamento ${input.lancamento_id} em ${input.data}`,
    async run(input) {
      const result = await payNextInstallment({ entryId: input.lancamento_id, paidAt: input.data });
      if (!result.ok) return { erro: result.error };
      refreshFinance(input.lancamento_id);
      return { feito: true, valor: reais(result.amountCents), parcela: result.label };
    },
  }),

  defineTool({
    name: "vendas_listar",
    description: "Lista as vendas (confirmadas, pagas, pendentes e canceladas), mais recentes primeiro, com cliente, valor e situação.",
    scopes: ["owner"],
    mutates: false,
    input: object({ de: s.optional(s.date()), ate: s.optional(s.date()), cursor: s.optional(s.id()) }),
    async run(input) {
      const result = await listSales({ from: input.de, to: input.ate, cursor: input.cursor });
      return { vendas: result.data.map((sale) => ({ id: sale.id, codigo: sale.code, titulo: sale.title, cliente: sale.client.name, valor: reais(sale.amountCents), situacao: saleStatusLabel[sale.status], origem: sale.origin, proposta: sale.quote?.code ?? null, criada_em: day(sale.createdAt) })), proxima_pagina: result.nextCursor };
    },
  }),

  defineTool({
    name: "vendas_propostas_em_aberto",
    description: "Propostas enviadas ou em rascunho que ainda não viraram venda. Use para achar a proposta (o id) antes de confirmar uma venda.",
    scopes: ["owner"],
    mutates: false,
    input: object({ cursor: s.optional(s.id()) }),
    async run(input) {
      const result = await listOpenQuoteOpportunities({ cursor: input.cursor });
      return { propostas: result.data.map((quote) => ({ id: quote.id, codigo: quote.code, titulo: quote.title, cliente: quote.client.name, valor: reais(quote.amountCents), situacao: quote.status, valida_ate: day(quote.validUntil) })), proxima_pagina: result.nextCursor };
    },
  }),

  defineTool({
    name: "vendas_confirmar_proposta",
    description: "Confirma a venda de uma proposta aceita pelo cliente: a proposta fica aceita, a venda é criada e a entrada a receber aparece no Financeiro.",
    scopes: ["owner"],
    mutates: true,
    input: object({ proposta_id: s.id() }),
    summarize: (input) => `Confirmar a venda da proposta ${input.proposta_id}`,
    async run(input) {
      const result = await confirmQuoteSale(input.proposta_id);
      if (!result.ok) return { erro: result.error };
      refreshFinance();
      return { feito: true, proposta: result.code };
    },
  }),

  defineTool({
    name: "vendas_alterar_situacao",
    description: "Muda a situação de uma venda. \"paga\" registra a quitação do que falta no Financeiro; \"cancelada\" cancela a entrada a receber.",
    scopes: ["owner"],
    mutates: true,
    input: object({ venda_id: s.id(), situacao: s.enum(["pendente", "confirmada", "paga", "cancelada"] as const) }),
    summarize: (input) => `Mudar a venda ${input.venda_id} para ${input.situacao}`,
    async run(input) {
      const status = { pendente: SaleStatus.PENDING, confirmada: SaleStatus.CONFIRMED, paga: SaleStatus.PAID, cancelada: SaleStatus.CANCELLED }[input.situacao];
      const result = await changeSaleStatus(input.venda_id, status);
      if (!result.ok) return { erro: result.error };
      refreshFinance();
      return { feito: true, situacao: saleStatusLabel[status] };
    },
  }),
];
