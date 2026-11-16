import Link from "next/link";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { AgendaModal } from "@/features/agenda/components/agenda-modal";
import { AgendaMonth, AgendaReview, AgendaWeek, AvailabilityPanel, DoneLink, ForgottenBanner, EventDetailPanel, EventForm, weekRangeLabel } from "@/features/agenda/components/agenda-panels";
import { countForgottenEvents, getCalendarEvent, listClientOptions, listReviewEvents, listReviewMonths, listEventsBetween, listWeekEvents } from "@/features/agenda/queries/agenda-queries";
import { findFreeSlots, getAgendaSettings } from "@/features/agenda/services/agenda-service";
import { addDays, addMonths, dayKey, isDayKey, isMonthKey, isReviewFilter, longDayLabel, monthGrid, monthLabel, monthOf, todayKey, weekStart } from "@/features/agenda/types/agenda";

export const dynamic = "force-dynamic";

/** Aviso da última ação (aparece flutuando e some sozinho). */
function notice(code: string | undefined, params: { dia?: string; total?: string }) {
  const day = params.dia && isDayKey(params.dia) ? longDayLabel(params.dia) : null;
  const moved = day ? `Remarcado para ${day}.` : "Evento remarcado.";
  const notices: Record<string, string> = {
    criado: "Evento criado.",
    conflito: "Evento criado. Atenção: ele coincide com outro compromisso da agenda.",
    salvo: "Evento atualizado.",
    concluido: "Evento concluído. Ele continua no calendário e aparece na Revisão.",
    "esquecidos-concluidos": params.total === "1" ? "1 evento esquecido marcado como concluído." : `${params.total ?? "Os"} eventos esquecidos marcados como concluídos.`,
    reaberto: "Evento reaberto.",
    cancelado: "Evento cancelado.",
    excluido: "Evento excluído.",
    remarcado: moved,
    "remarcado-conflito": `${moved} Atenção: ele coincide com outro compromisso.`,
    "remarcado-contato": `${moved} Avise o contato sobre a nova data.`,
    disponibilidade: "Disponibilidade salva. A assistente passa a oferecer os novos horários.",
  };
  return code ? notices[code] ?? null : null;
}

type AgendaPageProps = { searchParams: Promise<{ aba?: string; visao?: string; mes?: string; semana?: string; evento?: string; editar?: string; novo?: string; dia?: string; aviso?: string; erro?: string; destaque?: string; total?: string; filtro?: string; depois?: string }> };

/**
 * Agenda: semana em colunas, mês em grade e a Revisão (esquecidos, concluídos e cancelados por mês); detalhe e
 * formulário do evento num pop-up. Esquecido: evento ainda marcado de um dia anterior a hoje.
 */
export default async function AgendaPage({ searchParams }: AgendaPageProps) {
  const params = await searchParams;
  // "arquivo" é o endereço antigo da Revisão.
  const tab = params.aba === "disponibilidade" ? "disponibilidade" : params.aba === "revisao" || params.aba === "arquivo" ? "revisao" : params.visao === "mes" ? "mes" : "semana";
  const today = todayKey();
  const monday = weekStart(params.semana && isDayKey(params.semana) ? params.semana : today);
  const requestedMonth = params.mes && isMonthKey(params.mes) ? params.mes : null;
  const month = requestedMonth ?? monthOf(today);
  const grid = monthGrid(month);
  const settings = await getAgendaSettings();
  const [forgottenTotal, reviewMonths] = await Promise.all([countForgottenEvents(), tab === "revisao" ? listReviewMonths() : []]);
  // Revisão: sem mês, abre em todos os esquecidos (se houver); com mês, no filtro pedido ou no que tiver eventos.
  const requestedFilter = isReviewFilter(params.filtro) ? params.filtro : undefined;
  const monthStats = requestedMonth ? reviewMonths.find((item) => item.month === requestedMonth) : undefined;
  const reviewMonth = tab !== "revisao" ? null : monthStats ? monthStats.month : forgottenTotal && (!requestedFilter || requestedFilter === "esquecidos") ? null : reviewMonths[0]?.month ?? null;
  const reviewStats = reviewMonths.find((item) => item.month === reviewMonth);
  const reviewFilter = !reviewMonth ? "esquecidos" : requestedFilter ?? (reviewStats?.forgotten ? "esquecidos" : reviewStats?.done || !reviewStats?.cancelled ? "concluidos" : "cancelados");
  const view = tab === "mes" ? `visao=mes&mes=${month}` : tab === "revisao" ? `aba=revisao${reviewMonth ? `&mes=${reviewMonth}` : ""}&filtro=${reviewFilter}` : `semana=${monday}`;
  const modalOpen = tab !== "disponibilidade" && Boolean(params.evento || params.novo);

  const [events, review, event, clients, preview] = await Promise.all([
    tab === "semana" ? listWeekEvents(monday) : tab === "mes" ? listEventsBetween(grid[0], grid.at(-1)!, { take: 600 }) : [],
    tab === "revisao" && (reviewMonth || forgottenTotal) ? listReviewEvents(reviewFilter, reviewMonth, params.depois) : null,
    modalOpen && params.evento ? getCalendarEvent(params.evento) : null,
    modalOpen && (params.novo || params.editar) ? listClientOptions() : [],
    tab === "disponibilidade" ? findFreeSlots({ days: 5, perDay: 40 }) : [],
  ]);
  const defaultDay = params.dia && isDayKey(params.dia) ? params.dia : tab === "mes" ? (monthOf(today) === month ? today : `${month}-01`) : monday <= today && today < addDays(monday, 7) ? today : monday;
  const message = notice(params.aviso, params);
  const doneCount = events.filter((item) => item.status === "DONE" && (tab !== "mes" || monthOf(dayKey(item.startsAt)) === month)).length;
  const closeHref = `/agenda?${view}${params.depois ? `&depois=${params.depois}` : ""}`;
  const tabs = [
    { id: "semana", label: "Semana", href: `/agenda?semana=${monday}` },
    { id: "mes", label: "Mês", href: `/agenda?visao=mes&mes=${tab === "semana" ? monthOf(addDays(monday, 3)) : month}` },
    { id: "revisao", label: "Revisão", href: "/agenda?aba=revisao", alert: forgottenTotal },
    { id: "disponibilidade", label: "Disponibilidade", href: "/agenda?aba=disponibilidade" },
  ];

  return <main className="app-shell"><AppSidebar current="agenda" /><div className="workspace"><section className="directory-page settings-page agenda-page">
    <header className="directory-header"><div><h1>Agenda</h1><p>Reuniões, compromissos, demandas e lembretes. A assistente consulta e marca eventos aqui, e as reuniões do atendimento chegam com o contato e o resumo da conversa.</p></div><div className="header-actions"><SidebarToggle location="header" />{tab === "semana" || tab === "mes" ? <Link className="primary-action" href={`/agenda?${view}&novo=1`} scroll={false}>+ Novo evento</Link> : null}</div></header>
    <nav className="client-tabs settings-tabs" aria-label="Seções da agenda">
      {tabs.map((item) => <Link key={item.id} href={item.href} className={tab === item.id ? "active" : undefined} aria-current={tab === item.id ? "page" : undefined}>{item.label}{"alert" in item && item.alert ? <b className="agenda-tab-alert" title={`${item.alert} ${item.alert === 1 ? "esquecido" : "esquecidos"}`}>{item.alert}</b> : null}</Link>)}
    </nav>
    {message ? <p className="agenda-toast" role="status" key={`${params.aviso}-${params.destaque ?? ""}-${params.dia ?? ""}`}>{message}</p> : null}
    {params.erro && !modalOpen ? <p className="form-error" role="alert">{params.erro.slice(0, 300)}</p> : null}

    {tab === "disponibilidade" ? <AvailabilityPanel settings={settings} preview={preview} /> : null}

    {tab === "revisao" ? <AgendaReview months={reviewMonths} month={reviewMonth} filter={reviewFilter} events={review?.events ?? []} next={review?.next ?? null} cursor={params.depois} forgottenTotal={forgottenTotal} /> : null}

    {tab === "semana" || tab === "mes" ? <ForgottenBanner count={forgottenTotal} /> : null}

    {tab === "mes" ? <>
      <div className="agenda-toolbar">
        <div className="agenda-nav">
          <Link href={`/agenda?visao=mes&mes=${addMonths(month, -1)}`} aria-label="Mês anterior" title="Mês anterior">←</Link>
          <Link href={`/agenda?visao=mes&mes=${monthOf(today)}`} className="is-today">Hoje</Link>
          <Link href={`/agenda?visao=mes&mes=${addMonths(month, 1)}`} aria-label="Próximo mês" title="Próximo mês">→</Link>
        </div>
        <div className="agenda-toolbar-title"><b>{monthLabel(month)}</b><span>{events.filter((item) => monthOf(dayKey(item.startsAt)) === month).length} eventos no mês</span></div>
        <DoneLink month={month} count={doneCount} />
      </div>
      <AgendaMonth key={month} month={month} events={events} workDays={settings.workDays} highlight={params.destaque} />
    </> : null}

    {tab === "semana" ? <>
      <div className="agenda-toolbar">
        <div className="agenda-nav">
          <Link href={`/agenda?semana=${addDays(monday, -7)}`} aria-label="Semana anterior" title="Semana anterior">←</Link>
          <Link href={`/agenda?semana=${weekStart(today)}`} className="is-today">Hoje</Link>
          <Link href={`/agenda?semana=${addDays(monday, 7)}`} aria-label="Próxima semana" title="Próxima semana">→</Link>
        </div>
        <div className="agenda-toolbar-title"><b>{weekRangeLabel(monday)}</b><span>{addDays(monday, 6).slice(0, 4)} · {events.length} {events.length === 1 ? "evento" : "eventos"}</span></div>
        <DoneLink month={monthOf(addDays(monday, 3))} count={doneCount} />
      </div>
      <AgendaWeek key={monday} monday={monday} events={events} workDays={settings.workDays} highlight={params.destaque} />
    </> : null}

    {modalOpen ? <AgendaModal closeHref={closeHref} labelledBy="agenda-modal-title" size={params.novo || params.editar ? "wide" : "normal"}>
      {params.erro ? <p className="form-error agenda-modal-error" role="alert">{params.erro.slice(0, 300)}</p> : null}
      {params.novo ? <EventForm clients={clients} defaultDay={defaultDay} settings={settings} view={view} />
        : event && params.editar ? <EventForm clients={clients} event={event} defaultDay={defaultDay} settings={settings} view={view} />
          : event ? <EventDetailPanel event={event} view={view} />
            : <div className="agenda-sheet"><header className="agenda-sheet-head"><h2 id="agenda-modal-title">Evento não encontrado</h2><p className="agenda-sheet-sub">Ele pode ter sido excluído.</p></header></div>}
    </AgendaModal> : null}
  </section></div></main>;
}
