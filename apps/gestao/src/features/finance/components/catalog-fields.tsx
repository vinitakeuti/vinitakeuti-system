"use client";

import { useId, useRef, useState } from "react";
import { Segmented } from "@/features/finance/components/segmented";
import { categoryNames, defaultCategory, financeScopeLabel, type FinanceAccountOption, type FinanceCategoryOption, type FinanceScopeKey, type FinanceTypeKey } from "@/features/finance/types/finance-scope";
import styles from "@/app/financeiro/financeiro.module.css";

/**
 * Categoria e conta do lançamento: escolhe uma da lista ou cadastra uma nova (a última opção da lista abre o campo de
 * texto; o nome novo é cadastrado ao salvar). Envia `category`, e `accountId` ou `accountName`.
 */

const NEW = "__nova__";

/** Escolha numa lista com a opção de digitar um nome novo. */
export type CatalogChoice = { mode: "pick" | "new"; value: string; typed: string };

export const pick = (value: string): CatalogChoice => ({ mode: "pick", value, typed: "" });

function NewNameInput({ id, name, value, placeholder, maxLength, onChange, onCancel }: { id: string; name: string; value: string; placeholder: string; maxLength: number; onChange: (value: string) => void; onCancel: () => void }) {
  return <div className={styles.newNameField}>
    <input id={id} name={name} value={value} maxLength={maxLength} required autoFocus placeholder={placeholder} onChange={(event) => onChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); onCancel(); } }} />
    <button type="button" onClick={onCancel}>Cancelar</button>
  </div>;
}

export function CategoryField({ names, choice, onChange }: { names: string[]; choice: CatalogChoice; onChange: (choice: CatalogChoice) => void }) {
  const id = useId();
  // A categoria atual de um lançamento antigo pode não estar mais na lista: continua como opção.
  const options = choice.value && !names.includes(choice.value) ? [choice.value, ...names] : names;
  return <div className={styles.fieldGroup}>
    <label htmlFor={id}>Categoria</label>
    {choice.mode === "new"
      ? <NewNameInput id={id} name="category" value={choice.typed} maxLength={80} placeholder="Nome da nova categoria" onChange={(typed) => onChange({ ...choice, typed })} onCancel={() => onChange({ ...choice, mode: "pick" })} />
      : <select id={id} name="category" value={choice.value} onChange={(event) => onChange(event.target.value === NEW ? { ...choice, mode: "new" } : pick(event.target.value))}>
        {options.map((name) => <option key={name} value={name}>{name}</option>)}
        <option value={NEW}>+ Nova categoria</option>
      </select>}
  </div>;
}

export function AccountField({ accounts, choice, onChange, current }: { accounts: FinanceAccountOption[]; choice: CatalogChoice; onChange: (choice: CatalogChoice) => void; current?: FinanceAccountOption | null }) {
  const id = useId();
  // Conta arquivada que o lançamento já usa: continua como opção.
  const options = current && !accounts.some((account) => account.id === current.id) ? [current, ...accounts] : accounts;
  return <div className={styles.fieldGroup}>
    <label htmlFor={id}>Conta (banco)</label>
    {choice.mode === "new"
      ? <NewNameInput id={id} name="accountName" value={choice.typed} maxLength={60} placeholder="Ex.: Nubank PJ, Itaú pessoal" onChange={(typed) => onChange({ ...choice, typed })} onCancel={() => onChange({ ...choice, mode: "pick" })} />
      : <select id={id} name="accountId" value={choice.value} onChange={(event) => onChange(event.target.value === NEW ? { ...choice, mode: "new" } : pick(event.target.value))}>
        <option value="">Sem conta</option>
        {options.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
        <option value={NEW}>+ Nova conta</option>
      </select>}
  </div>;
}

export const SCOPE_OPTIONS: Array<{ value: FinanceScopeKey; label: string }> = [{ value: "BUSINESS", label: financeScopeLabel.BUSINESS }, { value: "PERSONAL", label: financeScopeLabel.PERSONAL }];
export const TYPE_OPTIONS: Array<{ value: FinanceTypeKey; label: string }> = [{ value: "INCOME", label: "Entrada" }, { value: "EXPENSE", label: "Saída" }];

/**
 * Tipo (opcional), empresa ou pessoal, categoria e conta, para os formulários de edição (lançamento e custo fixo).
 * Trocar o escopo ou o tipo troca a lista de categorias; a categoria escolhida continua se existir na nova lista.
 */
export function EntryClassificationFields({ categories, accounts, initialType, initialScope, initialCategory, initialAccount, typeEditable = false, scopeEditable = true }: {
  categories: FinanceCategoryOption[];
  accounts: FinanceAccountOption[];
  initialType: FinanceTypeKey;
  initialScope: FinanceScopeKey;
  initialCategory?: string | null;
  initialAccount?: FinanceAccountOption | null;
  typeEditable?: boolean;
  scopeEditable?: boolean;
}) {
  const [type, setType] = useState(initialType);
  const [scope, setScope] = useState(initialScope);
  const [category, setCategory] = useState<CatalogChoice>(pick(initialCategory || defaultCategory(categories, initialScope, initialType)));
  const [account, setAccount] = useState<CatalogChoice>(pick(initialAccount?.id ?? ""));
  const original = useRef(initialCategory);
  const names = categoryNames(categories, scope, type);
  const switchTo = (nextScope: FinanceScopeKey, nextType: FinanceTypeKey) => {
    setScope(nextScope);
    setType(nextType);
    if (category.mode === "new") return;
    const nextNames = categoryNames(categories, nextScope, nextType);
    // Volta para a categoria original quando o lançamento volta ao escopo e tipo dele.
    const keep = [category.value, original.current].find((name) => name && nextNames.includes(name));
    setCategory(pick(keep ?? defaultCategory(categories, nextScope, nextType)));
  };
  return <>
    {typeEditable ? <Segmented legend="Tipo" name="type" value={type} options={TYPE_OPTIONS} onChange={(next) => switchTo(scope, next)} /> : null}
    {scopeEditable ? <Segmented legend="Empresa ou pessoal" name="scope" value={scope} options={SCOPE_OPTIONS} onChange={(next) => switchTo(next, type)} /> : null}
    <CategoryField names={names} choice={category} onChange={setCategory} />
    <AccountField accounts={accounts} choice={account} onChange={setAccount} current={initialAccount} />
  </>;
}
