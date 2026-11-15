import { FinanceScope, FinancialEntryOrigin, FinancialEntryType, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { cleanCatalogName, type FinanceAccountOption, type FinanceCategoryOption, type FinanceScopeKey, type FinanceTypeKey } from "@/features/finance/types/finance-scope";

/**
 * Categorias (por escopo e tipo) e contas do Financeiro. O formulário escolhe uma existente ou digita uma nova, que é
 * cadastrada ao salvar. Os lançamentos guardam o nome da categoria (snapshot) e o vínculo com a conta.
 */

type Db = Prisma.TransactionClient | typeof prisma;

export const MAX_CATEGORIES_PER_GROUP = 150;
export const MAX_ACCOUNTS = 100;

export async function listFinanceCategories(): Promise<FinanceCategoryOption[]> {
  return prisma.financeCategory.findMany({ take: MAX_CATEGORIES_PER_GROUP * 4, orderBy: [{ scope: "asc" }, { type: "asc" }, { name: "asc" }], select: { scope: true, type: true, name: true } });
}

export async function listFinanceAccounts(): Promise<FinanceAccountOption[]> {
  return prisma.financeAccount.findMany({ where: { archivedAt: null }, take: MAX_ACCOUNTS, orderBy: [{ name: "asc" }, { id: "asc" }], select: { id: true, name: true } });
}

/** Conta usada no último lançamento manual de cada escopo, para já vir escolhida no formulário. */
export async function recentAccountByScope(): Promise<Record<FinanceScopeKey, string | null>> {
  const recent = (scope: FinanceScope) => prisma.financialEntry.findFirst({ where: { scope, origin: FinancialEntryOrigin.MANUAL, account: { archivedAt: null } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { accountId: true } }).then((row) => row?.accountId ?? null);
  const [business, personal] = await Promise.all([recent(FinanceScope.BUSINESS), recent(FinanceScope.PERSONAL)]);
  return { BUSINESS: business, PERSONAL: personal };
}

/** Garante a categoria no cadastro (sem diferenciar maiúsculas) e devolve o nome como está cadastrado. */
export async function ensureFinanceCategory(db: Db, scope: FinanceScopeKey, type: FinanceTypeKey, raw: unknown) {
  const name = cleanCatalogName(raw, 80) || "Outros";
  const existing = await db.financeCategory.findFirst({ where: { scope, type, name: { equals: name, mode: "insensitive" } }, select: { name: true } });
  if (existing) return existing.name;
  // Acima do limite, o lançamento guarda o nome mesmo assim; só não entra na lista de sugestões.
  if (await db.financeCategory.count({ where: { scope, type } }) < MAX_CATEGORIES_PER_GROUP) await db.financeCategory.createMany({ data: [{ scope, type: type as FinancialEntryType, name }], skipDuplicates: true });
  return name;
}

export type AccountResult = { ok: true; accountId: string | null } | { ok: false; error: string };

/** Conta do lançamento: uma cadastrada (id) ou um nome novo, cadastrado na hora. Sem nenhum dos dois, fica sem conta. */
export async function resolveFinanceAccount(db: Db, input: { accountId?: string | null; accountName?: string | null }): Promise<AccountResult> {
  const id = input.accountId?.trim().slice(0, 50);
  if (id) {
    const found = await db.financeAccount.findUnique({ where: { id }, select: { id: true } });
    return found ? { ok: true, accountId: found.id } : { ok: false, error: "Conta não encontrada. Escolha outra ou cadastre uma nova." };
  }
  const name = cleanCatalogName(input.accountName, 60);
  if (!name) return { ok: true, accountId: null };
  const existing = await db.financeAccount.findFirst({ where: { name: { equals: name, mode: "insensitive" } }, select: { id: true, archivedAt: true } });
  if (existing) {
    if (existing.archivedAt) await db.financeAccount.update({ where: { id: existing.id }, data: { archivedAt: null } });
    return { ok: true, accountId: existing.id };
  }
  if (await db.financeAccount.count() >= MAX_ACCOUNTS) return { ok: false, error: `Limite de ${MAX_ACCOUNTS} contas. Arquive ou renomeie uma em Categorias e contas.` };
  const created = await db.financeAccount.upsert({ where: { name }, update: {}, create: { name }, select: { id: true } });
  return { ok: true, accountId: created.id };
}
