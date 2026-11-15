"use server";

import { FinanceScope, FinancialEntryType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireManagementUser } from "@/features/auth/services/auth-session";
import { MAX_ACCOUNTS, MAX_CATEGORIES_PER_GROUP } from "@/features/finance/services/finance-catalog";
import { cleanCatalogName } from "@/features/finance/types/finance-scope";

/** Cadastro de categorias e contas (tela Categorias e contas do Financeiro). */

const PAGE = "/financeiro/categorias";

function text(formData: FormData, name: string, max: number) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function go(params: { error?: string; notice?: string }, anchor: string): never {
  const query = new URLSearchParams();
  if (params.error) query.set("error", params.error);
  if (params.notice) query.set("notice", params.notice);
  redirect(`${PAGE}?${query.toString()}#${anchor}`);
}

function refresh() {
  revalidatePath(PAGE);
  revalidatePath("/financeiro");
  revalidatePath("/financeiro/custos-fixos");
}

const scopeOf = (value: string) => (value === FinanceScope.PERSONAL ? FinanceScope.PERSONAL : FinanceScope.BUSINESS);
const typeOf = (value: string) => (value === FinancialEntryType.EXPENSE ? FinancialEntryType.EXPENSE : FinancialEntryType.INCOME);

export async function createCategoryAction(formData: FormData) {
  await requireManagementUser();
  const scope = scopeOf(text(formData, "scope", 20));
  const type = typeOf(text(formData, "type", 20));
  const name = cleanCatalogName(text(formData, "name", 120), 80);
  const anchor = `categorias-${scope}-${type}`.toLowerCase();
  if (!name) go({ error: "Digite o nome da categoria." }, anchor);
  const exists = await prisma.financeCategory.findFirst({ where: { scope, type, name: { equals: name, mode: "insensitive" } }, select: { id: true } });
  if (exists) go({ error: `A categoria "${name}" já existe nesta lista.` }, anchor);
  if (await prisma.financeCategory.count({ where: { scope, type } }) >= MAX_CATEGORIES_PER_GROUP) go({ error: `Limite de ${MAX_CATEGORIES_PER_GROUP} categorias por lista.` }, anchor);
  await prisma.financeCategory.create({ data: { scope, type, name } });
  refresh();
  go({ notice: "category-created" }, anchor);
}

/**
 * Renomeia a categoria e os lançamentos e custos fixos que usam o nome antigo. Se o novo nome já existir na mesma
 * lista, as duas viram uma só (os lançamentos passam para a existente).
 */
export async function renameCategoryAction(formData: FormData) {
  await requireManagementUser();
  const id = text(formData, "id", 50);
  const name = cleanCatalogName(text(formData, "name", 120), 80);
  const category = id ? await prisma.financeCategory.findUnique({ where: { id }, select: { id: true, scope: true, type: true, name: true } }) : null;
  if (!category) go({ error: "Categoria não encontrada." }, "categorias");
  const anchor = `categorias-${category.scope}-${category.type}`.toLowerCase();
  if (!name) go({ error: "Digite o novo nome da categoria." }, anchor);
  if (name === category.name) go({}, anchor);
  const target = await prisma.financeCategory.findFirst({ where: { scope: category.scope, type: category.type, name: { equals: name, mode: "insensitive" }, id: { not: category.id } }, select: { id: true, name: true } });
  const finalName = target?.name ?? name;
  const where = { scope: category.scope, type: category.type, category: category.name };
  await prisma.$transaction(async (tx) => {
    await tx.financialEntry.updateMany({ where, data: { category: finalName } });
    await tx.recurringEntry.updateMany({ where, data: { category: finalName } });
    if (target) await tx.financeCategory.delete({ where: { id: category.id } });
    else await tx.financeCategory.update({ where: { id: category.id }, data: { name: finalName } });
  });
  refresh();
  go({ notice: target ? "category-merged" : "category-renamed" }, anchor);
}

/** Tira a categoria da lista. Lançamentos que já usam o nome continuam com ele. */
export async function deleteCategoryAction(formData: FormData) {
  await requireManagementUser();
  const id = text(formData, "id", 50);
  const category = id ? await prisma.financeCategory.findUnique({ where: { id }, select: { scope: true, type: true } }) : null;
  if (!category) go({ error: "Categoria não encontrada." }, "categorias");
  await prisma.financeCategory.delete({ where: { id } });
  refresh();
  go({ notice: "category-deleted" }, `categorias-${category.scope}-${category.type}`.toLowerCase());
}

export async function createAccountAction(formData: FormData) {
  await requireManagementUser();
  const name = cleanCatalogName(text(formData, "name", 120), 60);
  if (!name) go({ error: "Digite o nome da conta." }, "contas");
  const exists = await prisma.financeAccount.findFirst({ where: { name: { equals: name, mode: "insensitive" } }, select: { id: true, archivedAt: true } });
  if (exists && !exists.archivedAt) go({ error: `A conta "${name}" já existe.` }, "contas");
  if (exists) await prisma.financeAccount.update({ where: { id: exists.id }, data: { archivedAt: null } });
  else {
    if (await prisma.financeAccount.count() >= MAX_ACCOUNTS) go({ error: `Limite de ${MAX_ACCOUNTS} contas.` }, "contas");
    await prisma.financeAccount.create({ data: { name } });
  }
  refresh();
  go({ notice: exists ? "account-restored" : "account-created" }, "contas");
}

export async function renameAccountAction(formData: FormData) {
  await requireManagementUser();
  const id = text(formData, "id", 50);
  const name = cleanCatalogName(text(formData, "name", 120), 60);
  if (!id || !name) go({ error: "Digite o novo nome da conta." }, "contas");
  const clash = await prisma.financeAccount.findFirst({ where: { name: { equals: name, mode: "insensitive" }, id: { not: id } }, select: { id: true } });
  if (clash) go({ error: `Já existe uma conta chamada "${name}".` }, "contas");
  const updated = await prisma.financeAccount.updateMany({ where: { id }, data: { name } });
  if (!updated.count) go({ error: "Conta não encontrada." }, "contas");
  refresh();
  go({ notice: "account-renamed" }, "contas");
}

/** Arquivada, a conta sai do formulário e continua nos lançamentos que já a usam. */
export async function toggleAccountArchiveAction(formData: FormData) {
  await requireManagementUser();
  const id = text(formData, "id", 50);
  const archive = text(formData, "archive", 5) === "1";
  const updated = id ? await prisma.financeAccount.updateMany({ where: { id }, data: { archivedAt: archive ? new Date() : null } }) : { count: 0 };
  if (!updated.count) go({ error: "Conta não encontrada." }, "contas");
  refresh();
  go({ notice: archive ? "account-archived" : "account-restored" }, "contas");
}

/** Só contas sem nenhum lançamento ou custo fixo podem ser excluídas; as demais são arquivadas. */
export async function deleteAccountAction(formData: FormData) {
  await requireManagementUser();
  const id = text(formData, "id", 50);
  const account = id ? await prisma.financeAccount.findUnique({ where: { id }, select: { _count: { select: { entries: true, recurring: true } } } }) : null;
  if (!account) go({ error: "Conta não encontrada." }, "contas");
  if (account._count.entries + account._count.recurring > 0) go({ error: "Esta conta já tem lançamentos. Arquive em vez de excluir." }, "contas");
  await prisma.financeAccount.delete({ where: { id } });
  refresh();
  go({ notice: "account-deleted" }, "contas");
}
