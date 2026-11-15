"use client";

import { useState, type CSSProperties } from "react";
import { CounterpartyField } from "@/features/finance/components/counterparty-field";
import { AccountField, CategoryField, pick, SCOPE_OPTIONS, TYPE_OPTIONS, type CatalogChoice } from "@/features/finance/components/catalog-fields";
import { Segmented } from "@/features/finance/components/segmented";
import { categoryNames, defaultCategory, type FinanceAccountOption, type FinanceCategoryOption, type FinanceScopeKey, type FinanceTypeKey } from "@/features/finance/types/finance-scope";
import type { CounterpartyClient } from "@/features/finance/services/finance-actions";
import styles from "@/app/financeiro/financeiro.module.css";

/**
 * Novo lançamento. As escolhas do topo (entrada ou saída, empresa ou pessoal, uma vez, parcelada ou todo mês) decidem
 * quais campos aparecem e como a data se chama. Embaixo, uma frase diz o que vai ser lançado antes de salvar.
 */

type Repeat = "once" | "installments" | "monthly";

const REPEAT_OPTIONS: Array<{ value: Repeat; label: string }> = [{ value: "once", label: "Uma vez" }, { value: "installments", label: "Parcelada" }, { value: "monthly", label: "Todo mês" }];
const RECEIVED_OPTIONS: Array<{ value: "PENDING" | "SETTLED"; label: string }> = [{ value: "PENDING", label: "A receber" }, { value: "SETTLED", label: "Já recebida" }];

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const monthYear = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });

/** Mesmo critério do servidor: "1.500,00", "1500,5" ou "1500.50". */
function toCents(value: string) {
  const normalized = value.includes(",") ? value.replace(/\./g, "").replace(",", ".") : value.replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) : 0;
}

const isIsoDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
const brDate = (iso: string) => iso.split("-").reverse().join("/");

/** Mesmo dia nos meses seguintes; nos meses mais curtos, o último dia. */
function addMonths(iso: string, months: number) {
  const [year, month, day] = iso.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, "0")}-${String(Math.min(day, last)).padStart(2, "0")}`;
}

type Preview = { cents: number; date: string; count: number; type: FinanceTypeKey; repeat: Repeat; received: boolean; today: string };

/** O que vai ser lançado, em uma frase. */
function previewText({ cents, date, count, type, repeat, received, today }: Preview) {
  if (!cents || !isIsoDay(date)) return "Preencha o valor e a data para ver o que vai ser lançado.";
  const income = type === "INCOME";
  const value = money.format(cents / 100);
  if (repeat === "monthly") return `${income ? "Entrada" : "Saída"} de ${value} todo dia ${Number(date.slice(8))}, a partir de ${monthYear.format(new Date(`${date}T12:00:00Z`))}. Os próximos meses entram sozinhos; edite ou encerre em Custos fixos.`;
  if (repeat === "installments" && count > 1) {
    const base = Math.floor(cents / count);
    const last = cents - base * (count - 1);
    const each = last === base ? money.format(base / 100) : `${money.format(base / 100)} (a última de ${money.format(last / 100)})`;
    const range = `de ${brDate(date)} a ${brDate(addMonths(date, count - 1))}`;
    return income ? `Entrada de ${value} a receber em ${count} parcelas mensais de ${each}, ${range}.` : `${count} saídas de ${each}, uma por mês, ${range}. Cada uma conta no seu mês.`;
  }
  if (income) return received ? `Entrada de ${value} recebida em ${brDate(date > today ? today : date)}.` : `Entrada de ${value} a receber em ${brDate(date)}.`;
  return date > today ? `Saída de ${value} programada para ${brDate(date)}.` : `Saída de ${value} paga em ${brDate(date)}.`;
}

function dateLabel(type: FinanceTypeKey, repeat: Repeat, received: boolean) {
  const income = type === "INCOME";
  if (repeat === "monthly") return income ? "Primeiro vencimento" : "Primeiro pagamento";
  if (repeat === "installments") return income ? "1ª parcela vence em" : "1ª parcela em";
  if (income) return received ? "Recebida em" : "Vencimento";
  return "Data do pagamento";
}

export function FinanceEntryForm({ action, categories, accounts, recentAccounts, conditions, today, view, initial }: {
  action: (formData: FormData) => void | Promise<void>;
  categories: FinanceCategoryOption[];
  accounts: FinanceAccountOption[];
  recentAccounts: Record<FinanceScopeKey, string | null>;
  conditions: string[];
  /** AAAA-MM-DD, no fuso da operação. */
  today: string;
  /** Visão de onde o formulário foi aberto (empresa ou pessoal), para voltar a ela. */
  view?: string;
  initial: { type: FinanceTypeKey; scope: FinanceScopeKey; repeat: Repeat; client: CounterpartyClient | null };
}) {
  const [type, setType] = useState(initial.type);
  const [scope, setScope] = useState(initial.scope);
  const [repeat, setRepeat] = useState<Repeat>(initial.repeat);
  const [received, setReceived] = useState(false);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [count, setCount] = useState("2");
  const [category, setCategory] = useState<CatalogChoice>(pick(defaultCategory(categories, initial.scope, initial.type)));
  const [account, setAccount] = useState<CatalogChoice>(pick(recentAccounts[initial.scope] ?? ""));
  const [accountTouched, setAccountTouched] = useState(false);

  const income = type === "INCOME";
  const isReceived = income && repeat === "once" && received;
  const showCondition = income && !isReceived && repeat !== "monthly";
  const installments = Math.min(60, Math.max(0, Math.floor(Number(count)) || 0));

  // Trocar tipo ou escopo troca a lista de categorias (um nome novo sendo digitado continua) e, se a conta não foi
  // escolhida à mão, a conta passa a ser a usada por último naquele escopo.
  const classify = (nextType: FinanceTypeKey, nextScope: FinanceScopeKey) => {
    setType(nextType);
    setScope(nextScope);
    if (category.mode !== "new") setCategory(pick(categoryNames(categories, nextScope, nextType).includes(category.value) ? category.value : defaultCategory(categories, nextScope, nextType)));
    if (!accountTouched && nextScope !== scope) setAccount(pick(recentAccounts[nextScope] ?? ""));
  };

  // Campos condicionais na linha da observação: a observação ocupa as colunas que sobram.
  const extraFields = (repeat === "installments" ? 1 : 0) + (showCondition ? 1 : 0);

  return <form action={action} className={styles.entryForm}>
    {view ? <input type="hidden" name="view" value={view} /> : null}
    <div className={styles.entryControls}>
      <Segmented legend="Tipo" name="type" value={type} options={TYPE_OPTIONS} onChange={(next) => classify(next, scope)} />
      <Segmented legend="Empresa ou pessoal" name="scope" value={scope} options={SCOPE_OPTIONS} onChange={(next) => classify(type, next)} />
      <Segmented legend="Repetição" name="repeat" value={repeat} options={REPEAT_OPTIONS} onChange={setRepeat} />
      {income && repeat === "once" ? <Segmented legend="Situação" name="status" value={received ? "SETTLED" : "PENDING"} options={RECEIVED_OPTIONS} onChange={(next) => setReceived(next === "SETTLED")} /> : null}
    </div>

    <label className={styles.spanTwo}>Descrição<input name="description" maxLength={180} required placeholder={income ? "Ex.: Projeto Nutripulse" : scope === "PERSONAL" ? "Ex.: Mercado do mês" : "Ex.: Assinatura do servidor"} /></label>
    <label>{repeat === "installments" ? "Valor total" : repeat === "monthly" ? "Valor mensal" : "Valor"}<input name="amount" inputMode="decimal" required placeholder="0,00" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
    <label>{dateLabel(type, repeat, isReceived)}<input name="dueDate" type="date" required value={date} max={isReceived ? today : undefined} onChange={(event) => setDate(event.target.value)} /></label>

    <CategoryField names={categoryNames(categories, scope, type)} choice={category} onChange={setCategory} />
    <AccountField accounts={accounts} choice={account} onChange={(next) => { setAccount(next); setAccountTouched(true); }} />
    <div className={styles.fieldGroup + " " + styles.spanTwo}><span>{income ? "Quem paga" : "Para quem"}</span><CounterpartyField initialClient={initial.client} placeholder={income ? "Busque um cliente ou digite um nome" : "Fornecedor, loja ou pessoa"} /></div>

    {repeat === "installments" ? <label>Parcelas<input name="installments" type="number" min={2} max={60} required inputMode="numeric" value={count} onChange={(event) => setCount(event.target.value)} /></label> : null}
    {showCondition ? <label>Condição de pagamento<input name="paymentCondition" maxLength={80} list="condicoes-pagamento" placeholder="Ex.: Mensal no Pix" /><datalist id="condicoes-pagamento">{conditions.map((name) => <option key={name} value={name} />)}</datalist></label> : null}
    <label className={styles.notesFill} style={{ "--notes-span": 4 - extraFields } as CSSProperties}>Observação<input name="notes" maxLength={500} placeholder="Opcional" /></label>

    <div className={styles.entryFooter}>
      <p className={styles.entryPreview} aria-live="polite">{previewText({ cents: toCents(amount), date, count: installments, type, repeat, received: isReceived, today })}</p>
      <button className="primary-action" type="submit">{repeat === "installments" && !income ? "Lançar parcelas" : repeat === "monthly" ? "Salvar recorrência" : income ? "Salvar entrada" : "Salvar saída"}</button>
    </div>
  </form>;
}
