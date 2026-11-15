"use server";

import { FinancialEntryStatus, FinancialEntryType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { recalculateFinancialEntry } from "@/features/finance/services/finance-ledger";
import { syncExpensePayment } from "@/features/finance/services/recurring-entries";
import { MAX_INSTALLMENTS, nextOpenInstallment } from "@/features/finance/services/installments";
import { cancelStaleEntryCharges } from "@/features/integrations/services/asaas-charges";
import { rebuildInstallments, syncQuotePayments } from "@/features/finance/services/payment-plan";
import { isMonthKey } from "@/features/finance/services/recurring-entries";
import { requireManagementUser } from "@/features/auth/services/auth-session";
import { ensureFinanceCategory, resolveFinanceAccount } from "@/features/finance/services/finance-catalog";
import { financeScopeParam, parseFinanceScope, scopeFromParam } from "@/features/finance/types/finance-scope";
import { createFinancialEntry, financeDueDate, financePaymentDate, financialPaymentProblem, payNextInstallment, registerFinancialPayment, resolveCounterparty } from "@/features/finance/services/finance-service";

function text(formData: FormData, name: string, max: number) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function amountToCents(value: string) {
  const normalized = value.includes(",") ? value.replace(/\./g, "").replace(",", ".") : value.replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

function dateValue(value: string) {
  return financeDueDate(value);
}

/** Dia civil do recebimento, gravado ao meio-dia UTC para não mudar de dia em nenhum fuso do Brasil. */
function paymentDate(value: string) {
  return financePaymentDate(value);
}

function back(params?: { error?: string; notice?: string }): never {
  if (!params?.error && !params?.notice) redirect("/financeiro");
  const query = new URLSearchParams();
  if (params.error) query.set("error", params.error);
  if (params.notice) query.set(params.notice, "1");
  redirect(`/financeiro?${query.toString()}`);
}

function entryHref(id: string) {
  return `/financeiro/lancamentos/${encodeURIComponent(id)}`;
}

/** Volta para a tela do lançamento com um aviso ou erro. */
function backToEntry(id: string, params: { error?: string; notice?: string }): never {
  const query = new URLSearchParams();
  if (params.error) query.set("error", params.error);
  if (params.notice) query.set("notice", params.notice);
  redirect(`${entryHref(id)}?${query.toString()}`);
}

function revalidateFinance(id?: string) {
  revalidatePath("/financeiro");
  revalidatePath("/financeiro/custos-fixos");
  revalidatePath("/vendas");
  if (id) revalidatePath(entryHref(id));
}

/** As ações rápidas da lista voltam para a lista; as da tela do lançamento voltam para ela. */
function returnsToEntry(formData: FormData) {
  return text(formData, "returnTo", 10) === "entry";
}

/**
 * Novo lançamento pelo formulário do Financeiro. `repeat`: "once" (uma vez), "installments" (parcelado) ou "monthly"
 * (todo mês). Volta para o Financeiro na mesma visão (empresa, pessoal ou tudo) de onde o formulário foi enviado.
 */
export async function createFinancialEntryAction(formData: FormData) {
  await requireManagementUser();
  const type = text(formData, "type", 20) === FinancialEntryType.EXPENSE ? FinancialEntryType.EXPENSE : FinancialEntryType.INCOME;
  const repeat = text(formData, "repeat", 20);
  const view = scopeFromParam(text(formData, "view", 10));
  const result = await createFinancialEntry({
    type,
    scope: parseFinanceScope(text(formData, "scope", 20)),
    description: text(formData, "description", 180),
    category: text(formData, "category", 80),
    accountId: text(formData, "accountId", 50) || null,
    accountName: text(formData, "accountName", 60) || null,
    amountCents: amountToCents(text(formData, "amount", 24)),
    dueDate: text(formData, "dueDate", 10),
    counterparty: text(formData, "counterparty", 160),
    clientId: text(formData, "clientId", 50) || null,
    notes: text(formData, "notes", 500),
    paymentCondition: text(formData, "paymentCondition", 80),
    recurring: repeat === "monthly",
    received: repeat === "once" && text(formData, "status", 20) === FinancialEntryStatus.SETTLED,
    installments: repeat === "installments" ? Number(text(formData, "installments", 3)) || 1 : 1,
  });
  const query = new URLSearchParams();
  if (view) query.set("escopo", financeScopeParam[view]);
  if (!result.ok) query.set("error", result.error);
  else if (result.kind === "series") query.set("series", String(result.count));
  else query.set(result.kind === "recurring" ? "recurring" : "created", "1");
  if (result.ok) revalidateFinance();
  redirect(`/financeiro?${query.toString()}${result.ok ? "" : "#novo-lancamento"}`);
}

/** Registra o que falta receber (ou pagar) e deixa o lançamento realizado. */
export async function settleFinancialEntryAction(formData: FormData) {
  await requireManagementUser();
  const id = text(formData, "id", 50);
  if (!id) back({ error: "Lançamento inválido." });
  await prisma.$transaction(async (tx) => {
    const entry = await tx.financialEntry.findUnique({ where: { id }, select: { type: true, status: true, amountCents: true, paidCents: true } });
    if (!entry || entry.type !== FinancialEntryType.INCOME || entry.status !== FinancialEntryStatus.PENDING) return;
    const remaining = entry.amountCents - entry.paidCents;
    if (remaining > 0) await tx.financialPayment.create({ data: { entryId: id, amountCents: remaining, paidAt: new Date() } });
    await recalculateFinancialEntry(tx, id, { syncSale: true });
  });
  revalidateFinance(id);
  if (returnsToEntry(formData)) backToEntry(id, { notice: "settled" });
  back({ notice: "settled" });
}

export async function cancelFinancialEntryAction(formData: FormData) {
  await requireManagementUser();
  const id = text(formData, "id", 50);
  if (!id) back({ error: "Lançamento inválido." });
  // Entradas em aberto e saídas (que já contam como pagas) podem ser canceladas.
  await prisma.financialEntry.updateMany({ where: { id, OR: [{ status: FinancialEntryStatus.PENDING }, { type: FinancialEntryType.EXPENSE, status: FinancialEntryStatus.SETTLED }] }, data: { status: FinancialEntryStatus.CANCELLED } });
  revalidateFinance(id);
  if (returnsToEntry(formData)) backToEntry(id, { notice: "cancelled" });
  back({ notice: "cancelled" });
}

/** Desfaz o cancelamento: o status volta a seguir o que foi recebido. */
export async function reopenFinancialEntryAction(formData: FormData) {
  await requireManagementUser();
  const id = text(formData, "id", 50);
  if (!id) back({ error: "Lançamento inválido." });
  await prisma.$transaction(async (tx) => {
    const changed = await tx.financialEntry.updateMany({ where: { id, status: FinancialEntryStatus.CANCELLED }, data: { status: FinancialEntryStatus.PENDING } });
    if (!changed.count) return;
    await syncExpensePayment(tx, id);
    await recalculateFinancialEntry(tx, id, { syncSale: true });
  });
  revalidateFinance(id);
  backToEntry(id, { notice: "reopened" });
}

/** Edita os dados do lançamento, inclusive o valor esperado. */
export async function updateFinancialEntryAction(formData: FormData) {
  await requireManagementUser();
  const id = text(formData, "id", 50);
  if (!id) back({ error: "Lançamento inválido." });
  const description = text(formData, "description", 180);
  const amountCents = amountToCents(text(formData, "amount", 24));
  const entry = await prisma.financialEntry.findUnique({ where: { id }, select: { type: true, origin: true, scope: true, paidCents: true, amountCents: true, dueDate: true, _count: { select: { installments: true } } } });
  if (!entry) back({ error: "Lançamento não encontrado." });
  // Parcelado: o valor esperado é a soma das parcelas e o vencimento é o da próxima parcela.
  // Sem os campos de valor e vencimento no formulário (entradas: ficam na condição de pagamento), mantém os atuais.
  const planned = entry._count.installments > 0 || !formData.has("amount");
  const dueDate = planned ? entry.dueDate : dateValue(text(formData, "dueDate", 10));
  const expected = planned ? entry.amountCents : amountCents;
  if (!description || expected < 1 || !dueDate) backToEntry(id, { error: "Preencha descrição, valor esperado e vencimento." });
  if (entry.type === FinancialEntryType.INCOME && expected < entry.paidCents) backToEntry(id, { error: "O valor esperado não pode ser menor que o total já recebido. Ajuste ou remova recebimentos primeiro." });
  const party = await resolveCounterparty(text(formData, "clientId", 50), text(formData, "counterparty", 160));
  if (!party.ok) backToEntry(id, { error: party.error });
  // Vendas confirmadas (vindas de proposta) são sempre da empresa.
  const scope = entry.origin === "QUOTE" || !formData.has("scope") ? entry.scope : parseFinanceScope(text(formData, "scope", 20));
  const account = formData.has("accountId") || formData.has("accountName") ? await resolveFinanceAccount(prisma, { accountId: text(formData, "accountId", 50) || null, accountName: text(formData, "accountName", 60) || null }) : null;
  if (account && !account.ok) backToEntry(id, { error: account.error });
  const category = await ensureFinanceCategory(prisma, scope, entry.type, text(formData, "category", 80));
  await prisma.$transaction(async (tx) => {
    await tx.financialEntry.update({ where: { id }, data: { description, category, scope, ...(account?.ok ? { accountId: account.accountId } : {}), counterparty: party.counterparty, clientId: party.clientId, amountCents: expected, dueDate, notes: text(formData, "notes", 500) || null, ...(formData.has("paymentCondition") ? { paymentCondition: entry.type === FinancialEntryType.INCOME ? text(formData, "paymentCondition", 80) || null : null } : {}) } });
    if (entry.type === FinancialEntryType.EXPENSE) await syncExpensePayment(tx, id);
    else await recalculateFinancialEntry(tx, id, { syncSale: true });
  });
  revalidateFinance(id);
  backToEntry(id, { notice: "updated" });
}

type PaymentInput = { amountCents: number; paidAt: Date; notes: string | null };

function paymentFromForm(formData: FormData): PaymentInput | null {
  const amountCents = amountToCents(text(formData, "amount", 24));
  const paidAt = paymentDate(text(formData, "paidAt", 10));
  if (amountCents < 1 || !paidAt) return null;
  return { amountCents, paidAt, notes: text(formData, "notes", 300) || null };
}

/** Garante que a soma recebida não passe do valor esperado (sem contar o recebimento que está sendo editado). */
const paymentFits = financialPaymentProblem;

export async function addFinancialPaymentAction(formData: FormData) {
  await requireManagementUser();
  const entryId = text(formData, "entryId", 50);
  if (!entryId) back({ error: "Lançamento inválido." });
  const result = await registerFinancialPayment({ entryId, amountCents: amountToCents(text(formData, "amount", 24)), paidAt: text(formData, "paidAt", 10), notes: text(formData, "notes", 300) });
  if (!result.ok) backToEntry(entryId, { error: result.error });
  revalidateFinance(entryId);
  backToEntry(entryId, { notice: "payment-added" });
}

export async function updateFinancialPaymentAction(formData: FormData) {
  await requireManagementUser();
  const id = text(formData, "paymentId", 50);
  const current = id ? await prisma.financialPayment.findUnique({ where: { id }, select: { entryId: true } }) : null;
  if (!current) back({ error: "Recebimento não encontrado." });
  const payment = paymentFromForm(formData);
  if (!payment) backToEntry(current.entryId, { error: "Informe o valor e a data do recebimento." });
  const problem = await paymentFits(current.entryId, payment.amountCents, id);
  if (problem) backToEntry(current.entryId, { error: problem });
  await prisma.$transaction(async (tx) => {
    await tx.financialPayment.update({ where: { id }, data: { ...payment, fromSale: false } });
    await recalculateFinancialEntry(tx, current.entryId, { syncSale: true });
  });
  revalidateFinance(current.entryId);
  backToEntry(current.entryId, { notice: "payment-updated" });
}

export async function deleteFinancialPaymentAction(formData: FormData) {
  await requireManagementUser();
  const id = text(formData, "paymentId", 50);
  const current = id ? await prisma.financialPayment.findUnique({ where: { id }, select: { entryId: true, entry: { select: { type: true } } } }) : null;
  if (!current) back({ error: "Recebimento não encontrado." });
  if (current.entry.type !== FinancialEntryType.INCOME) backToEntry(current.entryId, { error: "Saídas contam como pagas na data do vencimento; para tirar do caixa, cancele o lançamento." });
  await prisma.$transaction(async (tx) => {
    await tx.financialPayment.delete({ where: { id } });
    await recalculateFinancialEntry(tx, current.entryId, { syncSale: true });
  });
  revalidateFinance(current.entryId);
  backToEntry(current.entryId, { notice: "payment-deleted" });
}

/** Ajusta a data e o valor de uma parcela; o valor esperado passa a ser a soma das parcelas. */
export async function updateInstallmentAction(formData: FormData) {
  await requireManagementUser();
  const id = text(formData, "installmentId", 50);
  const installment = id ? await prisma.financialInstallment.findUnique({ where: { id }, select: { entryId: true } }) : null;
  if (!installment) back({ error: "Parcela não encontrada." });
  const dueDate = dateValue(text(formData, "dueDate", 10));
  const amountCents = amountToCents(text(formData, "amount", 24));
  if (!dueDate || amountCents < 1) backToEntry(installment.entryId, { error: "Informe a data e o valor da parcela." });
  const [others, entry] = await Promise.all([
    prisma.financialInstallment.aggregate({ where: { entryId: installment.entryId, id: { not: id } }, _sum: { amountCents: true } }),
    prisma.financialEntry.findUnique({ where: { id: installment.entryId }, select: { paidCents: true } }),
  ]);
  const total = (others._sum.amountCents ?? 0) + amountCents;
  if (!entry || total < entry.paidCents) backToEntry(installment.entryId, { error: "A soma das parcelas não pode ficar abaixo do que já foi recebido." });
  await prisma.$transaction(async (tx) => {
    await tx.financialInstallment.update({ where: { id }, data: { dueDate, amountCents } });
    await tx.financialEntry.update({ where: { id: installment.entryId }, data: { amountCents: total } });
    await recalculateFinancialEntry(tx, installment.entryId, { syncSale: true });
  });
  revalidateFinance(installment.entryId);
  backToEntry(installment.entryId, { notice: "installment-updated" });
}

/**
 * Marca como paga a próxima parcela em aberto (ou o que falta, sem parcelas) na data informada.
 * Volta para a tela de origem: o lançamento ou a lista de condições especiais.
 */
/** Cancela a cobrança do Asaas que a confirmação manual tornou inválida; uma falha aqui não desfaz o recebimento. */
async function cancelStaleChargesSafely(entryId: string) {
  try {
    await cancelStaleEntryCharges(entryId);
  } catch {
    // O ciclo de cobranças (a cada 30 minutos) tenta cancelar de novo.
  }
}

/** Para onde voltar depois de confirmar uma parcela: o perfil do cliente, a lista de parcelas (com o filtro de cliente) ou o lançamento. */
function installmentReturn(value: string, entryId: string, params: { error?: string; notice?: string }): never {
  const client = /^client:([\w-]{1,50})$/.exec(value)?.[1];
  if (client) {
    const query = new URLSearchParams({ section: "finance" });
    if (params.error) query.set("erro", params.error);
    if (params.notice) query.set("pagamento", params.notice);
    redirect(`/clientes/${encodeURIComponent(client)}?${query.toString()}#parcelas`);
  }
  const receivables = /^receivables(?::([\w-]{1,50}))?$/.exec(value);
  if (receivables) {
    const query = new URLSearchParams();
    if (receivables[1]) query.set("cliente", receivables[1]);
    if (params.error) query.set("error", params.error);
    if (params.notice) query.set("notice", params.notice);
    redirect(`/financeiro/receber?${query.toString()}`);
  }
  backToEntry(entryId, params.error ? { error: params.error } : { notice: "installment-paid" });
}

/**
 * Confirma à mão o pagamento da próxima parcela de uma venda (Pix direto, dinheiro, transferência fora do Asaas):
 * registra o recebimento na data e no valor informados e cancela na hora a cobrança aberta no Asaas, para o cliente não
 * pagar duas vezes. `number` é a parcela que a tela mostrava: se ela já não for a próxima em aberto, nada é registrado.
 */
export async function confirmInstallmentPaymentAction(formData: FormData) {
  await requireManagementUser();
  const entryId = text(formData, "entryId", 50);
  const returnTo = text(formData, "returnTo", 60);
  if (!entryId) back({ error: "Parcela inválida." });
  const entry = await prisma.financialEntry.findUnique({ where: { id: entryId }, select: { type: true, status: true, amountCents: true, paidCents: true, clientId: true, installments: { orderBy: { number: "asc" }, take: MAX_INSTALLMENTS, select: { number: true, dueDate: true, amountCents: true } } } });
  if (!entry || entry.type !== FinancialEntryType.INCOME || entry.status !== FinancialEntryStatus.PENDING) installmentReturn(returnTo, entryId, { error: "Esta parcela já foi paga ou a venda não está mais em aberto." });
  const next = entry.installments.length ? nextOpenInstallment(entry.installments, entry.paidCents) : null;
  const expected = Number(text(formData, "number", 3)) || 1;
  if ((next?.number ?? 1) !== expected) installmentReturn(returnTo, entryId, { error: `A parcela ${expected} já não é a próxima em aberto. A página foi atualizada; confira antes de confirmar.` });
  const remaining = next ? next.remaining : entry.amountCents - entry.paidCents;
  const typed = text(formData, "amount", 24);
  const amountCents = typed ? amountToCents(typed) : remaining;
  const label = next && entry.installments.length > 1 ? `Parcela ${next.number}/${entry.installments.length}` : null;
  const note = [label, text(formData, "notes", 200) || "Confirmado manualmente"].filter(Boolean).join(" · ");
  const result = await registerFinancialPayment({ entryId, amountCents, paidAt: text(formData, "paidAt", 10), notes: note });
  if (!result.ok) installmentReturn(returnTo, entryId, { error: result.error });
  await cancelStaleChargesSafely(entryId);
  revalidateFinance(entryId);
  revalidatePath("/financeiro/receber");
  revalidatePath("/financeiro/condicoes");
  if (entry.clientId) revalidatePath(`/clientes/${entry.clientId}`);
  installmentReturn(returnTo, entryId, { notice: "confirmado" });
}

export async function markNextInstallmentPaidAction(formData: FormData) {
  await requireManagementUser();
  const entryId = text(formData, "entryId", 50);
  if (!entryId) back({ error: "Lançamento inválido." });
  const returnTo = text(formData, "returnTo", 20);
  const result = await payNextInstallment({ entryId, paidAt: text(formData, "paidAt", 10) });
  if (!result.ok) {
    if (returnTo === "conditions") redirect(`/financeiro/condicoes?error=${encodeURIComponent(result.error)}`);
    backToEntry(entryId, { error: result.error });
  }
  await cancelStaleChargesSafely(entryId);
  revalidateFinance(entryId);
  revalidatePath("/financeiro/condicoes");
  if (returnTo === "conditions") redirect("/financeiro/condicoes?notice=paid");
  backToEntry(entryId, { notice: "installment-paid" });
}

/**
 * Condição de pagamento da entrada: valor total, condição, dia do vencimento, primeiro mês e quantas parcelas
 * (ou o valor de cada uma). O que já foi pago vira parcelas pagas; o restante é dividido nas parcelas seguintes.
 */
export async function savePaymentPlanAction(formData: FormData) {
  await requireManagementUser();
  const entryId = text(formData, "entryId", 50);
  if (!entryId) back({ error: "Lançamento inválido." });
  const totalCents = amountToCents(text(formData, "total", 24));
  const monthlyCents = amountToCents(text(formData, "monthly", 24)) || null;
  const count = Math.floor(Number(text(formData, "count", 3)));
  const dayOfMonth = Math.floor(Number(text(formData, "dayOfMonth", 2)));
  const firstMonth = text(formData, "firstMonth", 7);
  const entry = await prisma.financialEntry.findUnique({ where: { id: entryId }, select: { type: true, status: true, paidCents: true } });
  if (!entry || entry.type !== FinancialEntryType.INCOME || entry.status === FinancialEntryStatus.CANCELLED) backToEntry(entryId, { error: "Só entradas ativas têm condição de pagamento." });
  if (totalCents < 1) backToEntry(entryId, { error: "Informe o valor total da venda." });
  if (totalCents < entry.paidCents) backToEntry(entryId, { error: `O valor total não pode ficar abaixo do que já foi pago (${(entry.paidCents / 100).toFixed(2).replace(".", ",")}).` });
  const remaining = totalCents - entry.paidCents;
  if (remaining > 0 && (!Number.isInteger(count) || count < 1 || count > MAX_INSTALLMENTS)) backToEntry(entryId, { error: `Escolha de 1 a ${MAX_INSTALLMENTS} parcelas.` });
  if (remaining > 0 && count > remaining) backToEntry(entryId, { error: "O valor que falta é pequeno demais para tantas parcelas." });
  if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) backToEntry(entryId, { error: "Escolha o dia do vencimento (1 a 31)." });
  if (!isMonthKey(firstMonth)) backToEntry(entryId, { error: "Escolha o mês da primeira parcela." });
  await prisma.$transaction(async (tx) => {
    await tx.financialEntry.update({ where: { id: entryId }, data: { paymentCondition: text(formData, "paymentCondition", 80) || null } });
    await rebuildInstallments(tx, entryId, { count: Math.max(1, count), monthlyCents, dayOfMonth, firstMonth }, totalCents);
    await recalculateFinancialEntry(tx, entryId, { syncSale: true });
  });
  revalidateFinance(entryId);
  revalidatePath("/financeiro/condicoes");
  backToEntry(entryId, { notice: "plan-saved" });
}

/** Traz para a entrada os pagamentos registrados na proposta comercial da venda. */
export async function importQuotePaymentsAction(formData: FormData) {
  await requireManagementUser();
  const entryId = text(formData, "entryId", 50);
  if (!entryId) back({ error: "Lançamento inválido." });
  const entry = await prisma.financialEntry.findUnique({ where: { id: entryId }, select: { sourceKey: true } });
  const quoteId = entry?.sourceKey?.startsWith("quote:") ? entry.sourceKey.slice("quote:".length) : null;
  if (!quoteId) backToEntry(entryId, { error: "Este lançamento não veio de uma proposta." });
  await prisma.$transaction(async (tx) => {
    await syncQuotePayments(tx, quoteId);
    await recalculateFinancialEntry(tx, entryId, { syncSale: true });
  });
  revalidateFinance(entryId);
  backToEntry(entryId, { notice: "quote-payments" });
}

export type CounterpartyClient = { id: string; name: string; company: string | null };

/** Clientes para o campo Contraparte: busca por nome ou empresa, no máximo 8 (sem busca, os primeiros por nome). */
export async function searchCounterpartyClientsAction(query: string): Promise<CounterpartyClient[]> {
  await requireManagementUser();
  const term = typeof query === "string" ? query.replace(/\s+/g, " ").trim().slice(0, 80) : "";
  return prisma.client.findMany({
    where: term ? { OR: [{ name: { contains: term, mode: "insensitive" } }, { company: { contains: term, mode: "insensitive" } }] } : {},
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: 8,
    select: { id: true, name: true, company: true },
  });
}
