/**
 * Empresa ou pessoal, contas e categorias do Financeiro: tipos e rótulos usados pelas telas (servidor e navegador).
 * Fica fora de módulos "use client": constantes exportadas de lá chegam ao servidor como referência, não como valor.
 */

export type FinanceScopeKey = "BUSINESS" | "PERSONAL";
export type FinanceTypeKey = "INCOME" | "EXPENSE";

export const FINANCE_SCOPES: FinanceScopeKey[] = ["BUSINESS", "PERSONAL"];
export const financeScopeLabel: Record<FinanceScopeKey, string> = { BUSINESS: "Empresa", PERSONAL: "Pessoal" };

/** Na URL do Financeiro: ?escopo=empresa ou ?escopo=pessoal. Sem escopo, tudo. */
export const financeScopeParam: Record<FinanceScopeKey, string> = { BUSINESS: "empresa", PERSONAL: "pessoal" };

export function scopeFromParam(value?: string | null): FinanceScopeKey | undefined {
  return value === "empresa" ? "BUSINESS" : value === "pessoal" ? "PERSONAL" : undefined;
}

/** Valor vindo de formulário ou da IA; qualquer coisa diferente de pessoal é da empresa. */
export function parseFinanceScope(value: unknown): FinanceScopeKey {
  return value === "PERSONAL" ? "PERSONAL" : "BUSINESS";
}

export type FinanceCategoryOption = { scope: FinanceScopeKey; type: FinanceTypeKey; name: string };
export type FinanceAccountOption = { id: string; name: string };

const collator = new Intl.Collator("pt-BR", { sensitivity: "base" });

/** Nomes das categorias de um escopo e tipo, em ordem alfabética, com "Outros" por último. */
export function categoryNames(categories: FinanceCategoryOption[], scope: FinanceScopeKey, type: FinanceTypeKey) {
  return categories.filter((item) => item.scope === scope && item.type === type).map((item) => item.name)
    .sort((left, right) => (left === "Outros" ? 1 : right === "Outros" ? -1 : collator.compare(left, right)));
}

/** Categoria sugerida ao abrir o formulário: Vendas nas entradas da empresa; nas demais, a primeira da lista. */
export function defaultCategory(categories: FinanceCategoryOption[], scope: FinanceScopeKey, type: FinanceTypeKey) {
  const names = categoryNames(categories, scope, type);
  if (scope === "BUSINESS" && type === "INCOME" && names.includes("Vendas")) return "Vendas";
  return names[0] ?? "Outros";
}

/** Nome digitado (categoria ou conta): sem espaços sobrando, com limite de tamanho. */
export function cleanCatalogName(value: unknown, max: number) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}
