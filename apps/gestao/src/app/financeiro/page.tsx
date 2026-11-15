import Link from "next/link";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { getConfirmedSalesSummary, getUpcomingCommitments, getUpcomingReceivables, listPaymentConditions, listFinancialEntries, getFinanceSummary, financeEntryStatusKey, financeEntryStatusLabel, financeTypeLabel } from "@/features/finance/queries/finance-queries";
import { FINANCE_PERIOD_SHORTCUTS, financePeriodLabel, resolveFinancePeriod } from "@/features/finance/queries/finance-period";
import { ensureRecurringEntries } from "@/features/finance/services/recurring-entries";
import { nextOpenInstallment } from "@/features/finance/services/installments";
import { cancelFinancialEntryAction, createFinancialEntryAction, settleFinancialEntryAction } from "@/features/finance/services/finance-actions";
import { FinancialEntryStatus, FinancialEntryType } from "@prisma/client";
import { FinanceEntryForm } from "@/features/finance/components/finance-entry-form";
import { listFinanceAccounts, listFinanceCategories, recentAccountByScope } from "@/features/finance/services/finance-catalog";
import { financeScopeLabel, financeScopeParam, scopeFromParam, type FinanceScopeKey } from "@/features/finance/types/finance-scope";
import { prisma } from "@/lib/prisma";
import styles from "./financeiro.module.css";

export const dynamic = "force-dynamic";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "America/Maceio" });
const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Maceio" });
const isoDay = new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Maceio" });
const SCOPE_TABS: Array<{ key: FinanceScopeKey | undefined; label: string }> = [{ key: undefined, label: "Tudo" }, { key: "BUSINESS", label: financeScopeLabel.BUSINESS }, { key: "PERSONAL", label: financeScopeLabel.PERSONAL }];

type FinancePageProps = { searchParams: Promise<{ cliente?: string; tipo?: string; recurring?: string; periodo?: string; cursor?: string; query?: string; type?: string; status?: string; from?: string; to?: string; fixed?: string; escopo?: string; conta?: string; error?: string; created?: string; series?: string; settled?: string; cancelled?: string }> };

function href(filters: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => { if (value) query.set(key, value); });
  const serialized = query.toString();
  return serialized ? "/financeiro?" + serialized : "/financeiro";
}

function statusClass(entry: Parameters<typeof financeEntryStatusKey>[0]) { return styles[financeEntryStatusKey(entry)]; }
/** Quanto já entrou (ou saiu) de um lançamento em aberto e quanto falta. */
function progress(entry: { type: string; status: string; amountCents: number; paidCents: number }) {
  if (entry.status !== FinancialEntryStatus.PENDING || entry.paidCents < 1) return null;
  return <small className={styles.progress}><span>{entry.type === FinancialEntryType.INCOME ? "Recebido" : "Pago"} {money.format(entry.paidCents / 100)} ·</span> <span>falta {money.format((entry.amountCents - entry.paidCents) / 100)}</span></small>;
}
const editHref = (id: string) => `/financeiro/lancamentos/${id}`;
/** "Parcela 2 de 4" para entradas parceladas ainda em aberto. */
function installmentLabel(entry: { status: string; paidCents: number; installments: Array<{ number: number; dueDate: Date; amountCents: number }> }) {
  if (entry.installments.length < 2 || entry.status !== FinancialEntryStatus.PENDING) return null;
  const next = nextOpenInstallment(entry.installments, entry.paidCents);
  return next ? `Parcela ${next.number} de ${entry.installments.length}` : null;
}
/** Quando a entrada foi recebida, ou quando a saída foi (ou será) paga. */
function settledText(entry: { type: string; settledAt: Date | null; dueDate: Date }) {
  const when = date.format(entry.settledAt ?? entry.dueDate);
  if (entry.type === FinancialEntryType.INCOME) return "Recebido em " + when;
  return entry.dueDate.getTime() > Date.now() ? "Programado para " + when : "Pago em " + when;
}

export default async function FinancePage({ searchParams }: FinancePageProps) {
  const params = await searchParams;
  // Sem período escolhido, o painel mostra o mês atual.
  const period = resolveFinancePeriod(params);
  const range = { from: period.from, to: period.to };
  // Empresa, pessoal ou tudo: vale para o painel, os próximos 7 dias e as movimentações.
  const scope = scopeFromParam(params.escopo);
  const scopeParams = scope ? { escopo: financeScopeParam[scope] } : {};
  const account = params.conta?.slice(0, 50) || undefined;
  // Custos fixos e entradas mensais ganham as ocorrências que faltam até o fim do período consultado.
  await ensureRecurringEntries(period.to?.slice(0, 7));
  const [{ data: entries, nextCursor }, summary, sales, commitments, receivables, paymentConditionsInUse, categories, accounts, recentAccounts] = await Promise.all([
    listFinancialEntries({ ...params, ...range, scope, account }),
    getFinanceSummary({ ...range, scope }),
    scope === "PERSONAL" ? null : getConfirmedSalesSummary(),
    getUpcomingCommitments(6, scope),
    getUpcomingReceivables(6, scope),
    listPaymentConditions(),
    listFinanceCategories(),
    listFinanceAccounts(),
    recentAccountByScope(),
  ]);
  const conditionOptions = [...new Set([...paymentConditionsInUse.map((condition) => condition.name), "Mensal no Pix", "Boleto parcelado", "Cartão parcelado", "Entrada + parcelas"])];
  // Na URL, o período vai como atalho; datas só quando escolhidas à mão.
  const periodParams = period.key === "personalizado" ? { from: period.from, to: period.to } : { periodo: period.key };
  const listFilters = { query: params.query, type: params.type, status: params.status, conta: account, ...scopeParams };
  const filters = { ...listFilters, ...periodParams };
  const seriesCount = Number(params.series) || 0;
  const feedback = params.error ?? (params.created ? "Lançamento registrado." : seriesCount ? `${seriesCount} saídas lançadas, uma por mês. Cada parcela conta no seu mês.` : params.recurring ? "Recorrência criada: os próximos meses aparecem sozinhos. Veja e edite em Custos fixos." : params.settled ? "Lançamento quitado: o valor que faltava foi registrado como recebido." : params.cancelled ? "Lançamento cancelado." : null);
  const dashboardPeriod = financePeriodLabel(period);
  // Vindo do perfil do cliente (NOVA ENTRADA / NOVA SAÍDA): o formulário abre com o cliente e o tipo escolhidos.
  const prefillClient = params.cliente ? await prisma.client.findUnique({ where: { id: params.cliente.slice(0, 50) }, select: { id: true, name: true, company: true } }) : null;
  const prefillType = params.tipo === "saida" ? FinancialEntryType.EXPENSE : FinancialEntryType.INCOME;
  const accountName = (id: string | undefined) => accounts.find((item) => item.id === id)?.name;
  /** Escopo e conta de um lançamento, na linha de detalhes. Na visão "Tudo", os pessoais levam a marca "Pessoal". */
  const entryMeta = (entry: (typeof entries)[number]) => [!scope && entry.scope === "PERSONAL" ? financeScopeLabel.PERSONAL : null, entry.account?.name ?? null].filter(Boolean).join(" · ");
  return <main className="app-shell"><AppSidebar current="finance" /><div className="workspace"><section className={"directory-page " + styles.page}>
    <header className="directory-header"><div><h1>Financeiro</h1><p>Controle o caixa da empresa e o pessoal, acompanhe o que já foi realizado e veja o que ainda está previsto para entrar ou sair.</p></div><div className={"header-actions " + styles.financeHeaderActions}><div className={styles.financeHeaderNavigation}><SidebarToggle location="header" /><Link className="text-link" href="/financeiro/receber">Parcelas a receber</Link><Link className="text-link" href="/financeiro/custos-fixos">Custos fixos</Link><Link className="text-link" href="/financeiro/condicoes">Condições especiais</Link><Link className="text-link" href="/financeiro/categorias">Categorias e contas</Link></div><a className="primary-action" href="#novo-lancamento">Novo lançamento</a></div></header>
    <nav className={"client-tabs " + styles.scopeTabs} aria-label="Empresa ou pessoal">{SCOPE_TABS.map((tab) => <Link key={tab.label} className={tab.key === scope ? "active" : undefined} aria-current={tab.key === scope ? "page" : undefined} href={href({ ...periodParams, query: params.query, type: params.type, status: params.status, ...(tab.key ? { escopo: financeScopeParam[tab.key] } : {}) })}>{tab.label}</Link>)}</nav>
    {feedback ? <p className={params.error ? "form-error" : "form-success"} role={params.error ? "alert" : "status"}>{feedback}</p> : null}
    <section className={styles.periodBar} aria-label="Período do painel">
      <div className={styles.periodHead}><span>Período</span><small>{dashboardPeriod}</small></div>
      <div className={styles.periodShortcutsGroup}><span>Atalhos</span><nav className={styles.periodShortcuts} aria-label="Atalhos de período">{FINANCE_PERIOD_SHORTCUTS.map((shortcut) => <Link key={shortcut.key} href={href({ ...listFilters, periodo: shortcut.key })} aria-current={period.key === shortcut.key ? "true" : undefined}>{shortcut.label}</Link>)}</nav></div>
      <form className={styles.periodRange} action="/financeiro">
        {Object.entries(listFilters).map(([name, value]) => value ? <input key={name} type="hidden" name={name} value={value} /> : null)}
        <label>De<input name="from" type="date" defaultValue={period.from} /></label>
        <label>Até<input name="to" type="date" defaultValue={period.to} /></label>
        <button type="submit" aria-current={period.key === "personalizado" ? "true" : undefined}>Aplicar</button>
      </form>
    </section>
    <div className={styles.dashboardHeading}><span>{scope ? `Caixa ${scope === "PERSONAL" ? "pessoal" : "da empresa"}` : "Visão do caixa"}</span><small>{dashboardPeriod}</small></div><section className={styles.summary} aria-label="Resumo financeiro"><div className={styles.balance}><span>Saldo realizado</span><strong>{money.format(summary.balance / 100)}</strong><small>Recebido menos custos no período</small></div><div><span>A receber</span><b className={styles.income}>{money.format(summary.incomePending / 100)}</b><small>Entradas em aberto com vencimento no período</small></div><div><span>Custos</span><b className={styles.expense}>{money.format((summary.expenseSettled + summary.expensePending) / 100)}</b><small>Saídas do período, fixas e avulsas, contadas na data</small></div><div><span>Resultado líquido</span><b>{money.format(summary.forecast / 100)}</b><small>Recebido + a receber − custos</small></div></section>
    {sales ? <section className={styles.confirmedSales} aria-label="Vendas confirmadas"><div><span>Vendas confirmadas · todo o histórico</span><strong>{money.format(sales.expected / 100)}</strong><small>{sales.count} {sales.count === 1 ? "venda confirmada" : "vendas confirmadas"}, recebido mais a receber. Não depende do período.</small></div><dl><div><dt>Recebido</dt><dd className={styles.income}>{money.format(sales.received / 100)}</dd></div><div><dt>A receber</dt><dd>{money.format(sales.remaining / 100)}</dd></div></dl><Link className="text-link" href="/vendas">Ver vendas</Link></section> : null}
    <section className={styles.insights}><div className={styles.chart}><div className={styles.sectionHeading}><div><p className="eyebrow">Fluxo realizado</p><h2>Últimos seis meses</h2></div><span>Entradas e saídas</span></div><div className={styles.bars} aria-label="Gráfico de entradas e saídas dos últimos seis meses">{summary.months.map((month) => { const max = Math.max(month.income, month.expense, 1); return <div className={styles.barMonth} key={month.label}><div className={styles.barTrack}><i className={styles.barIncome} style={{ height: Math.max(4, month.income / max * 100) + "%" }} /><i className={styles.barExpense} style={{ height: Math.max(4, month.expense / max * 100) + "%" }} /></div><small>{month.label}</small></div>; })}</div><div className={styles.chartLegend}><span><i className={styles.legendIncome} /> entradas</span><span><i className={styles.legendExpense} /> saídas</span></div></div><section className={styles.upcomingBlock + " " + styles.upcomingExpense} aria-label="Compromissos próximos"><div className={styles.sectionHeading}><div><p className="eyebrow">Próximos 7 dias</p><h2>Compromissos próximos</h2></div></div><div className={styles.upcomingValue}><strong>{money.format(commitments.total / 100)}</strong><span>{commitments.count ? `${commitments.count} ${commitments.count === 1 ? "saída programada" : "saídas programadas"}` : "Nenhuma saída nos próximos 7 dias"}</span></div>{commitments.items.length ? <ul className={styles.upcomingList}>{commitments.items.slice(0, 4).map((item) => <li key={item.id}><Link href={editHref(item.id)}><span>{shortDate.format(item.dueDate)}</span><b>{item.description}</b><em>{money.format(item.amountCents / 100)}</em></Link></li>)}</ul> : null}</section><section className={styles.upcomingBlock + " " + styles.upcomingIncome} aria-label="Cobranças próximas"><div className={styles.sectionHeading}><div><p className="eyebrow">Próximos 7 dias</p><h2>Cobranças próximas</h2></div></div><div className={styles.upcomingValue}><strong>{money.format(receivables.upcoming / 100)}</strong><span>{receivables.upcomingCount ? `${receivables.upcomingCount} ${receivables.upcomingCount === 1 ? "cobrança a receber" : "cobranças a receber"}` : "Nenhuma cobrança nos próximos 7 dias"}</span>{receivables.overdueCount ? <span className={styles.upcomingOverdue}>+ {money.format(receivables.overdue / 100)} em atraso ({receivables.overdueCount})</span> : null}<Link className="text-link" href="/financeiro/receber">Ver todas e confirmar pagamentos</Link></div>{receivables.items.length ? <ul className={styles.upcomingList}>{receivables.items.slice(0, 4).map((item) => <li key={`${item.entryId}-${item.number}`}><Link href={editHref(item.entryId)}><span className={item.overdue ? styles.upcomingLate : undefined}>{item.overdue ? "Atrasada" : shortDate.format(item.dueDate)}</span><b>{item.counterparty ?? item.description}{item.total > 1 ? ` · parcela ${item.number}/${item.total}` : ""}</b><em>{money.format(item.remaining / 100)}</em></Link></li>)}</ul> : null}</section></section>
    <details className={styles.entryPanel} id="novo-lancamento" open={params.fixed === "1" || Boolean(prefillClient) || Boolean(params.error)}>
      <summary><span><b>Adicionar movimentação</b><small>Entrada ou saída, da empresa ou pessoal: uma vez, parcelada ou todo mês.</small></span><strong>Abrir</strong></summary>
      <FinanceEntryForm action={createFinancialEntryAction} categories={categories} accounts={accounts} recentAccounts={recentAccounts} conditions={conditionOptions} today={isoDay.format(new Date())} view={scope ? financeScopeParam[scope] : undefined} initial={{ type: prefillType, scope: scope ?? "BUSINESS", repeat: params.fixed === "1" ? "monthly" : "once", client: prefillClient }} />
    </details>
    <section className={styles.ledger}><div className={styles.ledgerHeading}><div><p className="eyebrow">Histórico do caixa{scope ? ` · ${financeScopeLabel[scope]}` : ""}</p><h2>Movimentações</h2><small>Lançamentos que vencem no período ou tiveram recebimento nele.</small></div><span>{entries.length} exibidos</span></div><form className={styles.filters} action="/financeiro">{Object.entries({ ...periodParams, ...scopeParams }).map(([name, value]) => <input key={name} type="hidden" name={name} value={value ?? ""} />)}<label className={styles.search}>Buscar<input name="query" defaultValue={params.query ?? ""} placeholder="Descrição, categoria ou contraparte" /></label><label>Tipo<select name="type" defaultValue={params.type ?? ""}><option value="">Todos</option><option value="INCOME">Entradas</option><option value="EXPENSE">Saídas</option></select></label><label>Status<select name="status" defaultValue={params.status ?? ""}><option value="">Todos</option><option value="PENDING">Pendentes</option><option value="SETTLED">Realizados</option><option value="CANCELLED">Cancelados</option></select></label>{accounts.length ? <label>Conta<select name="conta" defaultValue={account ?? ""}><option value="">Todas</option>{accounts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}<option value="sem">Sem conta</option></select></label> : null}<button type="submit">Filtrar</button>{params.query || params.type || params.status || account ? <Link className="text-link" href={href({ ...periodParams, ...scopeParams })}>Limpar</Link> : null}</form>{account ? <p className={styles.filterNote}>Conta: {account === "sem" ? "sem conta" : accountName(account) ?? "arquivada"}</p> : null}{entries.length ? <><div className={styles.tableScroll}><table><thead><tr><th>Lançamento</th><th>Categoria</th><th>Vencimento</th><th>Valor</th><th>Status</th><th /></tr></thead><tbody>{entries.map((entry) => <tr key={entry.id}><td><b className={entry.type === FinancialEntryType.INCOME ? styles.incomeText : styles.expenseText}>{financeTypeLabel[entry.type]}{entry.paymentCondition ? <span className={styles.inlineTag}>{entry.paymentCondition}</span> : null}</b><Link className={styles.entryLink} href={editHref(entry.id)}>{entry.description}</Link><small>{entry.clientId ? <Link className={styles.clientLink} href={`/clientes/${entry.clientId}?section=finance`}>{entry.counterparty ?? "Cliente"}</Link> : entry.counterparty ?? (entry.origin === "QUOTE" ? "Orçamento confirmado" : "Sem contraparte")}</small></td><td>{entry.category}{entryMeta(entry) ? <small className={styles.entryMeta}>{entryMeta(entry)}</small> : null}</td><td>{date.format(entry.dueDate)}{installmentLabel(entry) ? <small className={styles.progress}>{installmentLabel(entry)}</small> : null}</td><td><strong>{money.format(entry.amountCents / 100)}</strong>{progress(entry)}</td><td><span className={styles.status + " " + statusClass(entry)}>{financeEntryStatusLabel(entry)}</span></td><td><div className={styles.actions}>{entry.type === FinancialEntryType.INCOME && entry.status === FinancialEntryStatus.PENDING ? <><form action={settleFinancialEntryAction}><input type="hidden" name="id" value={entry.id} /><button type="submit">Marcar recebido</button></form><form action={cancelFinancialEntryAction}><input type="hidden" name="id" value={entry.id} /><button type="submit" className={styles.cancelAction}>Cancelar</button></form></> : entry.status === FinancialEntryStatus.SETTLED && entry.settledAt ? <small>{settledText(entry)}</small> : null}<Link className={styles.editAction} href={editHref(entry.id)}>Editar</Link></div></td></tr>)}</tbody></table></div><div className={styles.mobileList}>{entries.map((entry) => <article key={entry.id}><div className={styles.mobileTop}><b className={entry.type === FinancialEntryType.INCOME ? styles.incomeText : styles.expenseText}>{financeTypeLabel[entry.type]}</b><span className={styles.status + " " + statusClass(entry)}>{financeEntryStatusLabel(entry)}</span></div><Link className={styles.entryLink} href={editHref(entry.id)}>{entry.description}</Link><small>{[entry.counterparty ?? "Sem contraparte", entry.category, entry.paymentCondition, entryMeta(entry)].filter(Boolean).join(" · ")}</small>{progress(entry)}<div className={styles.mobileBottom}><b>{money.format(entry.amountCents / 100)}</b><span>Vence {date.format(entry.dueDate)}{installmentLabel(entry) ? ` · ${installmentLabel(entry)}` : ""}</span></div><div className={styles.mobileActions}>{entry.type === FinancialEntryType.INCOME && entry.status === FinancialEntryStatus.PENDING ? <><form action={settleFinancialEntryAction}><input type="hidden" name="id" value={entry.id} /><button type="submit">Marcar recebido</button></form><form action={cancelFinancialEntryAction}><input type="hidden" name="id" value={entry.id} /><button type="submit" className={styles.cancelAction}>Cancelar</button></form></> : null}<Link className={styles.editAction} href={editHref(entry.id)}>Editar</Link></div></article>)}</div></> : <div className="directory-empty"><p>Nenhum lançamento encontrado.</p><span>{scope === "PERSONAL" ? "Registre uma entrada ou saída pessoal para começar a separar o seu dinheiro do da empresa." : "Registre uma entrada ou saída para começar a acompanhar o caixa."}</span></div>}{nextCursor ? <div className="table-footer"><Link className="text-link" href={href({ ...filters, cursor: nextCursor })}>Carregar próximos 50</Link></div> : null}</section>
  </section></div></main>;
}
