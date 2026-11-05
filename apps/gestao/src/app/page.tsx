import Link from "next/link";
import { cookies, headers } from "next/headers";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { LandingPage } from "@/features/landing/components/landing-page";
import { portalForRequest } from "@/features/auth/services/auth-host";
import { requireManagementUser } from "@/features/auth/services/auth-session";
import { getOverviewData } from "@/features/overview/queries/overview-queries";
import { ValuesToggle, VALUES_COOKIE } from "@/features/overview/components/values-toggle";
import { EVENT_KINDS, dayKey, isEventKind, timeOf } from "@/features/agenda/types/agenda";

export const dynamic = "force-dynamic";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Maceio" });
const monthName = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "America/Maceio" });
const longToday = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "America/Maceio" });

/** Valor em dinheiro que o olho pode ocultar. */
function Money({ cents, sign }: { cents: number; sign?: "-" }) {
  return <span className="sensitive"><span>{sign === "-" ? "− " : ""}{money.format(cents / 100)}</span></span>;
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export default async function Home() {
  const portal = portalForRequest(await headers());
  if (portal === "landing") return <LandingPage />;
  await requireManagementUser();
  const [data, cookieStore] = await Promise.all([getOverviewData(), cookies()]);
  const hidden = cookieStore.get(VALUES_COOKIE)?.value === "ocultos";
  const { finance, receivables, commitments, events, attentionApps, monitoring, openQuotes, pendingQuotes, newAttendances, period, today } = data;

  const monthLabel = monthName.format(new Date(Date.UTC(period.year, period.month - 1, 15)));
  const expected = finance.incomeSettled + finance.incomePending;
  const progress = expected ? Math.min(100, Math.round((finance.incomeSettled / expected) * 100)) : 0;
  const monthMax = Math.max(1, ...finance.months.map((item) => item.income));

  // Dinheiro do dia e dos próximos 7 dias: atrasadas primeiro, depois por data.
  const cash = [
    ...receivables.items.map((item) => ({ key: `in-${item.entryId}-${item.number}`, href: `/financeiro/lancamentos/${item.entryId}`, date: item.dueDate, overdue: item.overdue, title: item.counterparty ?? item.description, detail: item.total > 1 ? `Parcela ${item.number} de ${item.total}` : "A receber", cents: item.remaining, expense: false })),
    ...commitments.items.map((item) => ({ key: `out-${item.id}`, href: `/financeiro/lancamentos/${item.id}`, date: item.dueDate, overdue: false, title: item.description, detail: item.counterparty ?? (item.recurringEntryId ? "Custo fixo" : "Saída"), cents: item.amountCents, expense: true })),
  ].sort((left, right) => Number(right.overdue) - Number(left.overdue) || left.date.getTime() - right.date.getTime());
  const dueToday = cash.filter((item) => !item.overdue && dayKey(item.date) === today);
  const upcoming = cash.slice(0, 6);

  const operations = [
    ...attentionApps.map((app) => ({ key: `app-${app.id}`, tone: app.status === "DOWN" ? "is-critical" : "is-warning", title: app.status === "DOWN" ? `${app.name} fora do ar` : `${app.name} com resposta lenta`, detail: app.status === "DOWN" ? "Monitoramento · indisponível na última verificação" : `Monitoramento${app.lastResponseMs ? ` · ${app.lastResponseMs.toLocaleString("pt-BR")} ms` : ""}`, href: `/monitoramento/${app.id}`, action: "Abrir" })),
    ...(newAttendances ? [{ key: "attendances", tone: "is-warning", title: plural(newAttendances, "atendimento novo", "atendimentos novos"), detail: "Site, WhatsApp e área do cliente", href: "/atendimentos", action: "Ver" }] : []),
    ...(openQuotes ? [{ key: "open-quotes", tone: "is-info", title: plural(openQuotes, "proposta aguardando decisão", "propostas aguardando decisão"), detail: "Vendas", href: "/vendas", action: "Ver" }] : []),
    ...(pendingQuotes ? [{ key: "pending-quotes", tone: "is-neutral", title: plural(pendingQuotes, "orçamento por concluir", "orçamentos por concluir"), detail: "Documentos · edição do PDF em aberto", href: "/orcamentos/pendentes", action: "Continuar" }] : []),
  ];

  return <main className="app-shell">
    <AppSidebar current="overview" />
    <div className="workspace overview-page" id="visao-geral" data-values={hidden ? "hidden" : "visible"}>
      <header className="topbar"><div><h1>Visão geral</h1><p className="overview-date">{capitalize(longToday.format(new Date()))}</p></div><div className="topbar-actions"><SidebarToggle location="header" /><ValuesToggle initialHidden={hidden} targetId="visao-geral" /></div></header>

      <section className="ov-kpis" aria-label={`Números de ${monthLabel}`}>
        <div className="ov-kpi is-main">
          <span>Recebido em {monthLabel}</span>
          <strong><Money cents={finance.incomeSettled} /></strong>
          <div className="ov-kpi-foot">
            <small>{progress}% do previsto · <Money cents={expected} /></small>
            <span className="ov-bars" role="img" aria-label="Recebido em cada um dos últimos seis meses; o mês atual é a última barra">
              {finance.months.map((item, index) => <i key={item.label} className={index === finance.months.length - 1 ? "is-current" : undefined} style={{ height: `${Math.max(6, Math.round((item.income / monthMax) * 100))}%` }} title={item.label} />)}
            </span>
          </div>
        </div>
        <div className="ov-kpi"><span>A receber em {monthLabel}</span><b><Money cents={finance.incomePending} /></b><small>Parcelas que vencem no mês</small></div>
        <div className={`ov-kpi${finance.overdueAmount ? " is-late" : ""}`}><span>Em atraso</span><b><Money cents={finance.overdueAmount} /></b><small>{finance.overdueCount ? plural(finance.overdueCount, "lançamento", "lançamentos") : "Nenhum recebimento atrasado"}</small></div>
        <div className="ov-kpi"><span>Saldo realizado</span><b><Money cents={finance.balance} /></b><small>Recebido menos custos pagos no mês</small></div>
      </section>

      <div className="ov-columns">
        <section className="ov-panel" aria-labelledby="ov-today-title">
          <header><h2 id="ov-today-title">Hoje</h2><Link className="text-link" href="/agenda">Abrir agenda</Link></header>
          {events.length ? <ul className="ov-list ov-agenda">{events.map((event) => <li key={event.id}>
            <Link href={`/agenda?evento=${event.id}`}>
              <time>{timeOf(event.startsAt)}</time>
              <span className="ov-main"><b>{event.title}</b><small>{event.client?.name ?? event.contactName ?? event.location ?? "Sem participante"}</small></span>
              <span className={`ov-kind is-${event.kind.toLowerCase()}`}>{isEventKind(event.kind) ? EVENT_KINDS[event.kind] : event.kind}</span>
            </Link>
          </li>)}</ul> : <div className="ov-empty"><p>Nada na agenda hoje.</p><Link className="text-link" href="/agenda">Marcar um compromisso</Link></div>}
          {dueToday.length ? <>
            <h3 className="ov-subtitle">Vence hoje</h3>
            <ul className="ov-list ov-cash">{dueToday.map((item) => <li key={item.key}><Link href={item.href}><span className="ov-when">Hoje</span><span className="ov-main"><b>{item.title}</b><small>{item.detail}</small></span><span className={`ov-amount${item.expense ? " is-expense" : ""}`}><Money cents={item.cents} sign={item.expense ? "-" : undefined} /></span></Link></li>)}</ul>
          </> : null}
        </section>

        <section className="ov-panel" aria-labelledby="ov-week-title">
          <header><h2 id="ov-week-title">Próximos 7 dias</h2><span className="ov-panel-meta">Entra <Money cents={receivables.upcoming} /> · Sai <Money cents={commitments.total} /></span></header>
          {upcoming.length ? <ul className="ov-list ov-cash">{upcoming.map((item) => <li key={item.key}><Link href={item.href}>
            {item.overdue ? <span className="ov-when is-late">Atrasada</span> : <span className="ov-when">{shortDate.format(item.date)}</span>}
            <span className="ov-main"><b>{item.title}</b><small>{item.detail}</small></span>
            <span className={`ov-amount${item.expense ? " is-expense" : item.overdue ? " is-late" : ""}`}><Money cents={item.cents} sign={item.expense ? "-" : undefined} /></span>
          </Link></li>)}</ul> : <div className="ov-empty"><p>Nada a receber ou pagar nos próximos 7 dias.</p><Link className="text-link" href="/financeiro#novo-lancamento">Registrar lançamento</Link></div>}
          <footer><Link className="text-link" href="/financeiro">Abrir financeiro</Link></footer>
        </section>

        <section className="ov-panel" aria-labelledby="ov-ops-title">
          <header><h2 id="ov-ops-title">Operação</h2>{monitoring.total ? <span className="ov-panel-meta">{monitoring.operational} de {monitoring.total} sistemas operacionais</span> : null}</header>
          {operations.length ? <ul className="ov-list ov-ops">{operations.map((item) => <li key={item.key} className={item.tone}>
            <span className="ov-dot" aria-hidden="true" />
            <span className="ov-main"><b>{item.title}</b><small>{item.detail}</small></span>
            <Link className="secondary-action ov-action" href={item.href}>{item.action}</Link>
          </li>)}</ul> : <div className="ov-empty"><p>Tudo em ordem.</p><span>Nenhum sistema com problema, nenhum atendimento novo e nenhuma proposta esperando decisão.</span></div>}
          <footer><Link className="text-link" href="/monitoramento">Abrir monitoramento</Link></footer>
        </section>
      </div>
    </div>
  </main>;
}
