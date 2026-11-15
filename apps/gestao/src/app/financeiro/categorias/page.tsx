import Link from "next/link";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { ConfirmSubmitButton } from "@/features/finance/components/confirm-submit-button";
import { createAccountAction, createCategoryAction, deleteAccountAction, deleteCategoryAction, renameAccountAction, renameCategoryAction, toggleAccountArchiveAction } from "@/features/finance/services/catalog-actions";
import { MAX_ACCOUNTS, MAX_CATEGORIES_PER_GROUP } from "@/features/finance/services/finance-catalog";
import { FINANCE_SCOPES, categoryNames, financeScopeLabel, type FinanceScopeKey, type FinanceTypeKey } from "@/features/finance/types/finance-scope";
import { prisma } from "@/lib/prisma";
import styles from "../financeiro.module.css";

export const dynamic = "force-dynamic";

const notices: Record<string, string> = {
  "category-created": "Categoria adicionada.",
  "category-renamed": "Categoria renomeada. Os lançamentos e custos fixos com o nome antigo foram atualizados.",
  "category-merged": "Categorias unidas: os lançamentos passaram para a categoria que já existia.",
  "category-deleted": "Categoria removida da lista. Os lançamentos que já a usavam continuam com o nome.",
  "account-created": "Conta adicionada.",
  "account-renamed": "Conta renomeada.",
  "account-archived": "Conta arquivada. Ela sai do formulário e continua nos lançamentos antigos.",
  "account-restored": "Conta reativada.",
  "account-deleted": "Conta excluída.",
};

const TYPES: Array<{ key: FinanceTypeKey; label: string }> = [{ key: "INCOME", label: "Entradas" }, { key: "EXPENSE", label: "Saídas" }];
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

type CatalogPageProps = { searchParams: Promise<{ error?: string; notice?: string }> };

/** Categorias da empresa e do pessoal (entradas e saídas) e as contas por onde o dinheiro passa. */
export default async function FinanceCatalogPage({ searchParams }: CatalogPageProps) {
  const params = await searchParams;
  const [categories, usage, accounts] = await Promise.all([
    prisma.financeCategory.findMany({ take: MAX_CATEGORIES_PER_GROUP * 4, orderBy: [{ scope: "asc" }, { type: "asc" }, { name: "asc" }], select: { id: true, scope: true, type: true, name: true } }),
    prisma.financialEntry.groupBy({ by: ["scope", "type", "category"], _count: { _all: true }, orderBy: [{ scope: "asc" }, { type: "asc" }, { category: "asc" }], take: MAX_CATEGORIES_PER_GROUP * 8 }),
    prisma.financeAccount.findMany({ take: MAX_ACCOUNTS * 2, orderBy: [{ archivedAt: { sort: "desc", nulls: "first" } }, { name: "asc" }], select: { id: true, name: true, archivedAt: true, _count: { select: { entries: true, recurring: true } } } }),
  ]);
  const feedback = params.error ? params.error.slice(0, 300) : params.notice ? notices[params.notice] ?? null : null;
  const used = (scope: FinanceScopeKey, type: FinanceTypeKey, name: string) => usage.find((row) => row.scope === scope && row.type === type && row.category === name)?._count._all ?? 0;
  const group = (scope: FinanceScopeKey, type: FinanceTypeKey) => {
    const order = categoryNames(categories, scope, type);
    return categories.filter((item) => item.scope === scope && item.type === type).sort((left, right) => order.indexOf(left.name) - order.indexOf(right.name));
  };
  const activeAccounts = accounts.filter((account) => !account.archivedAt).length;

  return <main className="app-shell"><AppSidebar current="finance" /><div className="workspace"><section className={"directory-page " + styles.page}>
    <header className="directory-header"><div><p className="eyebrow page-crumb"><Link href="/financeiro">Financeiro</Link> / Categorias e contas</p><h1>Categorias e contas</h1><p>As categorias separam o que entra e sai da empresa e do pessoal; as contas dizem por qual banco o dinheiro passou. Também dá para criar as duas direto no formulário de lançamento.</p></div><div className={"header-actions " + styles.financeHeaderActions}><div className={styles.financeHeaderNavigation}><SidebarToggle location="header" /><Link className="text-link" href="/financeiro">Voltar ao financeiro</Link></div></div></header>
    {feedback ? <p className={params.error ? "form-error" : "form-success"} role={params.error ? "alert" : "status"}>{feedback}</p> : null}

    <section className={styles.ledger + " " + styles.catalogPanel} id="contas" aria-label="Contas">
      <div className={styles.ledgerHeading}><div><p className="eyebrow">Bancos e carteiras</p><h2>Contas</h2><small>Escolha a conta em cada lançamento para saber por onde o dinheiro entrou ou saiu e filtrar as movimentações por banco.</small></div><span>{plural(activeAccounts, "ativa", "ativas")}</span></div>
      <form action={createAccountAction} className={styles.catalogAdd}><label>Nova conta<input name="name" maxLength={60} required placeholder="Ex.: Nubank PJ, Itaú pessoal, Asaas" /></label><button type="submit">Adicionar conta</button></form>
      {accounts.length ? <ul className={styles.catalogList}>{accounts.map((account) => {
        const uses = account._count.entries + account._count.recurring;
        return <li key={account.id} className={account.archivedAt ? styles.catalogArchived : undefined}>
          <b>{account.name}</b>
          <small>{account.archivedAt ? "Arquivada · " : ""}{plural(account._count.entries, "lançamento", "lançamentos")}{account._count.recurring ? ` · ${plural(account._count.recurring, "custo fixo", "custos fixos")}` : ""}</small>
          <details className={styles.catalogEdit}><summary><span>Editar</span><span>Fechar</span></summary>
            <form action={renameAccountAction}><input type="hidden" name="id" value={account.id} /><label>Nome<input name="name" maxLength={60} required defaultValue={account.name} /></label><button type="submit">Salvar nome</button></form>
            <div className={styles.catalogEditActions}>
              <form action={toggleAccountArchiveAction}><input type="hidden" name="id" value={account.id} /><input type="hidden" name="archive" value={account.archivedAt ? "0" : "1"} /><button className={styles.textAction} type="submit">{account.archivedAt ? "Reativar conta" : "Arquivar conta"}</button></form>
              {uses === 0 ? <form action={deleteAccountAction}><input type="hidden" name="id" value={account.id} /><ConfirmSubmitButton formAction={deleteAccountAction} className={styles.textAction + " " + styles.cancelAction} message={`Excluir a conta ${account.name}?`}>Excluir</ConfirmSubmitButton></form> : null}
            </div>
          </details>
        </li>;
      })}</ul> : <div className="directory-empty"><p>Nenhuma conta cadastrada.</p><span>Adicione os bancos que você usa, da empresa e pessoais.</span></div>}
    </section>

    <section className={styles.ledger + " " + styles.catalogPanel} id="categorias" aria-label="Categorias">
      <div className={styles.ledgerHeading}><div><p className="eyebrow">Organização</p><h2>Categorias</h2><small>Renomear atualiza os lançamentos com o nome antigo; renomear para um nome que já existe une as duas. Remover tira só da lista.</small></div></div>
      <div className={styles.catalogScopes}>{FINANCE_SCOPES.map((scope) => <div key={scope} className={styles.catalogScope}>
        <h3>{financeScopeLabel[scope]}</h3>
        {TYPES.map((type) => {
          const items = group(scope, type.key);
          return <div key={type.key} className={styles.catalogGroup} id={`categorias-${scope}-${type.key}`.toLowerCase()}>
            <h4>{type.label}<span>{items.length}</span></h4>
            <ul className={styles.catalogList}>{items.map((item) => {
              const count = used(scope, type.key, item.name);
              return <li key={item.id}>
                <b>{item.name}</b>
                <small>{count ? plural(count, "lançamento", "lançamentos") : "Sem lançamentos"}</small>
                <details className={styles.catalogEdit}><summary><span>Editar</span><span>Fechar</span></summary>
                  <form action={renameCategoryAction}><input type="hidden" name="id" value={item.id} /><label>Nome<input name="name" maxLength={80} required defaultValue={item.name} /></label><button type="submit">Salvar nome</button></form>
                  <div className={styles.catalogEditActions}><form action={deleteCategoryAction}><input type="hidden" name="id" value={item.id} /><ConfirmSubmitButton formAction={deleteCategoryAction} className={styles.textAction + " " + styles.cancelAction} message={`Remover ${item.name} da lista? ${count ? "Os lançamentos que já a usam continuam com o nome." : ""}`}>Remover da lista</ConfirmSubmitButton></form></div>
                </details>
              </li>;
            })}</ul>
            <form action={createCategoryAction} className={styles.catalogAdd}><input type="hidden" name="scope" value={scope} /><input type="hidden" name="type" value={type.key} /><label>Nova categoria de {type.label.toLowerCase()}<input name="name" maxLength={80} required placeholder="Nome" /></label><button type="submit">Adicionar</button></form>
          </div>;
        })}
      </div>)}</div>
    </section>
  </section></div></main>;
}
