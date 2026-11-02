import Link from "next/link";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { AgendaMonth, AgendaWeek, AvailabilityPanel, EventDetailPanel, EventForm, weekRangeLabel } from "@/features/agenda/components/agenda-panels";
import { getCalendarEvent, listClientOptions, listEventsBetween, listWeekEvents } from "@/features/agenda/queries/agenda-queries";
import { findFreeSlots, getAgendaSettings } from "@/features/agenda/services/agenda-service";
import { addDays, addMonths, dayKey, isDayKey, isMonthKey, monthGrid, monthLabel, monthOf, todayKey, weekStart } from "@/features/agenda/types/agenda";

export const dynamic = "force-dynamic";

const notices: Record<string, string> = {
  criado: "Evento criado.",
  conflito: "Evento criado. Atenção: ele coincide com outro compromisso da agenda.",
  salvo: "Evento atualizado.",
  concluido: "Evento marcado como concluído.",
  reaberto: "Evento reaberto.",
  cancelado: "Evento cancelado.",
  excluido: "Evento excluído.",
  disponibilidade: "Disponibilidade salva. A assistente passa a oferecer os novos horários.",
};

type AgendaPageProps = { searchParams: Promise<{ aba?: string; visao?: string; mes?: string; semana?: string; evento?: string; editar?: string; novo?: string; dia?: string; aviso?: string; erro?: string }> };

/** Agenda: a semana em colunas ou o mês em grade, com o detalhe do evento, o formulário e a disponibilidade para reuniões. */
export default async function AgendaPage({ searchParams }: AgendaPageProps) {
  const params = await searchParams;
  const tab = params.aba === "disponibilidade" ? "disponibilidade" : params.visao === "mes" ? "mes" : "semana";
  const calendar = tab !== "disponibilidade";
  const today = todayKey();
  const monday = weekStart(params.semana && isDayKey(params.semana) ? params.semana : today);
  const month = params.mes && isMonthKey(params.mes) ? params.mes : monthOf(today);
  const grid = monthGrid(month);
  const view = tab === "mes" ? `visao=mes&mes=${month}` : `semana=${monday}`;
  const settings = await getAgendaSettings();
  const [events, event, clients, preview] = await Promise.all([
    tab === "semana" ? listWeekEvents(monday) : tab === "mes" ? listEventsBetween(grid[0], grid.at(-1)!, { take: 600 }) : [],
    calendar && params.evento ? getCalendarEvent(params.evento) : null,
    calendar && (params.novo || params.editar) ? listClientOptions() : [],
    tab === "disponibilidade" ? findFreeSlots({ days: 5, perDay: 40 }) : [],
  ]);
  const eventMonday = event ? weekStart(dayKey(event.startsAt)) : monday;
  const defaultDay = params.dia && isDayKey(params.dia) ? params.dia : tab === "mes" ? (monthOf(today) === month ? today : `${month}-01`) : monday <= today && today < addDays(monday, 7) ? today : monday;

  return <main className="app-shell"><AppSidebar current="agenda" /><div className="workspace"><section className="directory-page settings-page">
    <header className="directory-header"><div><p className="eyebrow">GESTÃO / AGENDA</p><h1>Agenda.</h1><p>Reuniões, compromissos e lembretes. A assistente consulta e marca eventos aqui, e as reuniões do atendimento chegam com o contato e o resumo da conversa.</p></div><div className="header-actions"><SidebarToggle location="header" />{calendar ? <Link className="primary-action" href={`/agenda?${view}&novo=1`}>+ NOVO EVENTO</Link> : null}</div></header>
    <nav className="client-tabs settings-tabs" aria-label="Seções da agenda">
      <Link href={`/agenda?semana=${monday}`} className={tab === "semana" ? "active" : undefined} aria-current={tab === "semana" ? "page" : undefined}>SEMANA</Link>
      <Link href={`/agenda?visao=mes&mes=${tab === "semana" ? monthOf(addDays(monday, 3)) : month}`} className={tab === "mes" ? "active" : undefined} aria-current={tab === "mes" ? "page" : undefined}>MÊS</Link>
      <Link href="/agenda?aba=disponibilidade" className={tab === "disponibilidade" ? "active" : undefined} aria-current={tab === "disponibilidade" ? "page" : undefined}>DISPONIBILIDADE</Link>
    </nav>
    {params.aviso && notices[params.aviso] ? <p className="form-success" role="status">{notices[params.aviso]}</p> : null}
    {params.erro ? <p className="form-error" role="alert">{params.erro.slice(0, 300)}</p> : null}

    {tab === "disponibilidade" ? <AvailabilityPanel settings={settings} preview={preview} /> : <>
      {params.novo ? <EventForm clients={clients} monday={monday} defaultDay={defaultDay} settings={settings} view={view} /> : null}
      {event && params.editar ? <EventForm clients={clients} monday={eventMonday} event={event} defaultDay={defaultDay} settings={settings} view={tab === "mes" ? view : undefined} /> : null}
      {event && !params.editar ? <EventDetailPanel event={event} monday={eventMonday} view={tab === "mes" ? view : undefined} /> : null}
      {params.evento && !event ? <p className="form-error" role="alert">Evento não encontrado.</p> : null}
      {tab === "mes" ? <>
        <div className="agenda-toolbar">
          <Link className="secondary-action" href={`/agenda?visao=mes&mes=${addMonths(month, -1)}`} aria-label="Mês anterior">← ANTERIOR</Link>
          <Link className="secondary-action" href={`/agenda?visao=mes&mes=${monthOf(today)}`}>HOJE</Link>
          <Link className="secondary-action" href={`/agenda?visao=mes&mes=${addMonths(month, 1)}`} aria-label="Próximo mês">PRÓXIMO →</Link>
          <b className="agenda-month-label">{monthLabel(month)}</b>
          <span>{events.filter((item) => monthOf(dayKey(item.startsAt)) === month).length} eventos no mês</span>
        </div>
        <AgendaMonth month={month} events={events} workDays={settings.workDays} />
      </> : <>
        <div className="agenda-toolbar">
          <Link className="secondary-action" href={`/agenda?semana=${addDays(monday, -7)}`} aria-label="Semana anterior">← ANTERIOR</Link>
          <Link className="secondary-action" href={`/agenda?semana=${weekStart(today)}`}>HOJE</Link>
          <Link className="secondary-action" href={`/agenda?semana=${addDays(monday, 7)}`} aria-label="Próxima semana">PRÓXIMA →</Link>
          <b>{weekRangeLabel(monday)}</b>
          <span>{events.length} {events.length === 1 ? "evento" : "eventos"}</span>
        </div>
        <AgendaWeek monday={monday} events={events} workDays={settings.workDays} />
      </>}
    </>}
  </section></div></main>;
}
