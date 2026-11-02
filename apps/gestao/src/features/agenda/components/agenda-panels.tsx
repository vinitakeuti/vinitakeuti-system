import Link from "next/link";
import { ConfirmSubmitButton } from "@/features/finance/components/confirm-submit-button";
import { createEventAction, deleteEventAction, saveAgendaSettingsAction, setEventStatusAction, updateEventAction } from "@/features/agenda/services/agenda-actions";
import { eventKindLabel, type AgendaSettingsView, type FreeDay } from "@/features/agenda/services/agenda-service";
import { addDays, dayKey, EVENT_KINDS, minutesToTime, monthGrid, monthOf, timeOf, todayKey, WEEKDAYS, WEEKDAYS_SHORT, weekdayOf, weekStart } from "@/features/agenda/types/agenda";
import type { getCalendarEvent, listWeekEvents } from "@/features/agenda/queries/agenda-queries";

/** Peças da tela da Agenda: semana em colunas, detalhe do evento, formulário de evento e disponibilidade. */

type WeekEvent = Awaited<ReturnType<typeof listWeekEvents>>[number];
type EventDetail = NonNullable<Awaited<ReturnType<typeof getCalendarEvent>>>;
type ClientOption = { id: string; name: string; company: string | null };

const monthDay = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", timeZone: "America/Maceio" });
const fullDate = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric", timeZone: "America/Maceio" });
const stamp = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Maceio" });
const noon = (day: string) => new Date(`${day}T12:00:00-03:00`);

function phoneLabel(value: string | null) {
  const digits = value?.replace(/\D/g, "") ?? "";
  const match = digits.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  return match ? `(${match[1]}) ${match[2]}-${match[3]}` : value;
}

export function weekRangeLabel(monday: string) {
  const sunday = addDays(monday, 6);
  return `${monthDay.format(noon(monday))} a ${monthDay.format(noon(sunday))} de ${sunday.slice(0, 4)}`;
}

export function AgendaWeek({ monday, events, workDays }: { monday: string; events: WeekEvent[]; workDays: number[] }) {
  const today = todayKey();
  const days = Array.from({ length: 7 }, (_, index) => addDays(monday, index));
  return <div className="agenda-week">
    {days.map((day) => {
      const dayEvents = events.filter((event) => dayKey(event.startsAt) === day);
      const weekday = weekdayOf(day);
      return <section key={day} className={`agenda-day${day === today ? " is-today" : ""}${workDays.includes(weekday) ? "" : " is-off"}`} aria-label={fullDate.format(noon(day))}>
        <header><span>{WEEKDAYS_SHORT[weekday]}</span><b>{day.slice(8, 10)}</b>{day === today ? <small>HOJE</small> : null}</header>
        <div className="agenda-day-events">
          {dayEvents.length ? dayEvents.map((event) => <Link key={event.id} href={`/agenda?semana=${monday}&evento=${event.id}`} className={`agenda-event is-${event.kind.toLowerCase()}${event.status === "DONE" ? " is-done" : ""}`}>
            <time>{timeOf(event.startsAt)}–{timeOf(event.endsAt)}</time>
            <b>{event.title}</b>
            {event.client?.name || event.contactName ? <small>{event.client?.name ?? event.contactName}</small> : null}
            {event.source === "ia-atendimento" ? <em>ATENDIMENTO</em> : null}
          </Link>) : <p className="agenda-empty">Sem eventos</p>}
        </div>
      </section>;
    })}
  </div>;
}

export function EventDetailPanel({ event, monday, view }: { event: EventDetail; monday: string; view?: string }) {
  const back = view ?? `semana=${monday}`;
  const month = view?.match(/mes=(\d{4}-\d{2})/)?.[1];
  const place = month ? <><input type="hidden" name="visao" value="mes" /><input type="hidden" name="mes" value={month} /></> : null;
  const day = dayKey(event.startsAt);
  const statusLabel = event.status === "CANCELLED" ? "CANCELADO" : event.status === "DONE" ? "CONCLUÍDO" : "MARCADO";
  return <section className="settings-panel agenda-detail" aria-labelledby="agenda-event-title">
    <div className="settings-panel-heading">
      <div><p className="agenda-detail-kind">{eventKindLabel(event.kind).toUpperCase()}{event.source === "ia-atendimento" ? " · MARCADO PELA ASSISTENTE NO ATENDIMENTO" : event.source === "ia-gestao" ? " · CRIADO PELA ASSISTENTE" : ""}</p><h2 id="agenda-event-title">{event.title}</h2><p>{fullDate.format(event.startsAt)} · {timeOf(event.startsAt)} às {timeOf(event.endsAt)}</p></div>
      <span className={`settings-badge ${event.status === "SCHEDULED" ? "is-ok" : "is-warning"}`}>{statusLabel}</span>
    </div>
    <div className="settings-panel-body">
      <dl className="agenda-facts">
        {event.client ? <div><dt>CLIENTE</dt><dd><Link href={`/clientes/${event.client.id}`}>{event.client.name}</Link></dd></div> : null}
        {event.contactName && !event.client ? <div><dt>CONTATO</dt><dd>{event.contactName}</dd></div> : null}
        {event.contactPhone ? <div><dt>TELEFONE</dt><dd><a href={`https://wa.me/${event.contactPhone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer noopener">{phoneLabel(event.contactPhone)}</a></dd></div> : null}
        {event.contactEmail ? <div><dt>E-MAIL</dt><dd><a href={`mailto:${event.contactEmail}`}>{event.contactEmail}</a></dd></div> : null}
        {event.location ? <div><dt>LOCAL OU FORMATO</dt><dd>{/^https?:\/\//.test(event.location) ? <a href={event.location} target="_blank" rel="noreferrer noopener">{event.location}</a> : event.location}</dd></div> : null}
        <div><dt>CRIADO</dt><dd>{stamp.format(event.createdAt)}{event.createdBy && event.createdBy !== "ia" ? ` · ${event.createdBy}` : ""}</dd></div>
      </dl>
      {event.conversation?.summary ? <div className="ai-session-summary"><span>RESUMO DO ATENDIMENTO{event.conversation.summaryUpdatedAt ? ` · ${stamp.format(event.conversation.summaryUpdatedAt)}` : ""}</span><p>{event.conversation.summary}</p></div> : null}
      {event.description && !event.conversation?.summary ? <p className="agenda-description">{event.description}</p> : null}
      <div className="agenda-detail-actions">
        <Link className="secondary-action" href={`/agenda?${back}&evento=${event.id}&editar=1`}>EDITAR</Link>
        {event.status === "SCHEDULED" ? <form action={setEventStatusAction}><input type="hidden" name="id" value={event.id} /><input type="hidden" name="semana" value={monday} />{place}<input type="hidden" name="status" value="DONE" /><button className="secondary-action" type="submit">CONCLUÍDO</button></form> : <form action={setEventStatusAction}><input type="hidden" name="id" value={event.id} /><input type="hidden" name="semana" value={monday} />{place}<input type="hidden" name="status" value="SCHEDULED" /><button className="secondary-action" type="submit">REABRIR</button></form>}
        {event.conversation ? <Link className="text-link" href={`/integracoes/ia?aba=atividade${event.conversation.channel === "GESTAO" || event.conversation.channel === "SISTEMA" ? "" : "&escopo=atendimento"}`}>VER NA ATIVIDADE DA IA</Link> : null}
        <span className="agenda-detail-spacer" />
        {event.status === "SCHEDULED" ? <form><input type="hidden" name="id" value={event.id} /><input type="hidden" name="semana" value={monday} />{place}<input type="hidden" name="status" value="CANCELLED" /><ConfirmSubmitButton formAction={setEventStatusAction} className="text-link integration-disconnect" message="Cancelar este evento? Ele sai da agenda, mas continua no histórico.">CANCELAR EVENTO</ConfirmSubmitButton></form> : null}
        <form><input type="hidden" name="id" value={event.id} /><input type="hidden" name="semana" value={monday} />{place}<ConfirmSubmitButton formAction={deleteEventAction} className="text-link integration-disconnect" message="Excluir este evento de vez? Não dá para desfazer.">EXCLUIR</ConfirmSubmitButton></form>
        <Link className="text-link" href={`/agenda?${back}`}>FECHAR</Link>
      </div>
    </div>
  </section>;
}

export function EventForm({ clients, monday, event, defaultDay, settings, view }: { clients: ClientOption[]; monday: string; event?: EventDetail; defaultDay: string; settings: AgendaSettingsView; view?: string }) {
  const day = event ? dayKey(event.startsAt) : defaultDay;
  const start = event ? timeOf(event.startsAt) : minutesToTime(settings.dayStart);
  const end = event ? timeOf(event.endsAt) : minutesToTime(settings.dayStart + settings.meetingMinutes);
  return <section className="settings-panel" aria-labelledby="agenda-form-title">
    <div className="settings-panel-heading"><div><h2 id="agenda-form-title">{event ? "Editar evento." : "Novo evento."}</h2><p>{event ? "Altere o que for preciso. O resumo do atendimento continua ligado ao evento." : "Reunião, compromisso ou lembrete. Conflitos de horário são avisados, mas não impedem."}</p></div></div>
    <div className="settings-panel-body">
      <form className="settings-form" action={event ? updateEventAction : createEventAction}>
        {event ? <input type="hidden" name="id" value={event.id} /> : null}
        {view?.startsWith("visao=mes") ? <input type="hidden" name="visao" value="mes" /> : null}
        <label className="settings-form-wide">TÍTULO<input name="title" required maxLength={160} defaultValue={event?.title ?? ""} placeholder="Ex.: Reunião de briefing · Construtora Virtus" /></label>
        <label>TIPO<select name="kind" className="ai-select" defaultValue={event?.kind ?? "MEETING"}>{Object.entries(EVENT_KINDS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>CLIENTE<select name="clientId" className="ai-select" defaultValue={event?.clientId ?? ""}><option value="">Nenhum</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}{client.company ? ` · ${client.company}` : ""}</option>)}</select></label>
        <div className="settings-form-wide agenda-when">
          <label>DATA<input name="day" type="date" required defaultValue={day} /></label>
          <label>INÍCIO<input name="start" type="time" required defaultValue={start} /></label>
          <label>FIM<input name="end" type="time" required defaultValue={end} /></label>
        </div>
        <label className="settings-form-wide">LOCAL OU LINK<input name="location" maxLength={300} defaultValue={event?.location ?? settings.meetingFormat ?? ""} placeholder="Endereço, link do Meet ou 'por telefone'" /></label>
        <label className="settings-form-wide">DESCRIÇÃO<textarea name="description" rows={4} maxLength={4000} defaultValue={event?.description ?? ""} placeholder="Pauta, o que levar, observações…" /></label>
        <div className="settings-form-actions"><button className="primary-action" type="submit">{event ? "SALVAR" : "CRIAR EVENTO"}</button><Link className="text-link" href={`/agenda?${view ?? `semana=${monday}`}${event ? `&evento=${event.id}` : ""}`}>CANCELAR</Link></div>
      </form>
    </div>
  </section>;
}

export function AvailabilityPanel({ settings, preview }: { settings: AgendaSettingsView; preview: FreeDay[] }) {
  const workDays = new Set(settings.workDays);
  return <section className="settings-panel" aria-labelledby="agenda-availability-title">
    <div className="settings-panel-heading"><div><h2 id="agenda-availability-title">Disponibilidade para reuniões.</h2><p>Quando a assistente pode marcar reuniões no atendimento. Ela só oferece horários livres dentro destas regras e nunca mostra os seus compromissos.</p></div></div>
    <div className="settings-panel-body">
      <form className="settings-form" action={saveAgendaSettingsAction}>
        <fieldset className="settings-form-wide agenda-days"><legend>DIAS DE ATENDIMENTO</legend>{[1, 2, 3, 4, 5, 6, 0].map((day) => <label key={day}><input type="checkbox" name="workDays" value={day} defaultChecked={workDays.has(day)} /><span>{WEEKDAYS[day]}</span></label>)}</fieldset>
        <div className="settings-form-wide agenda-when">
          <label>INÍCIO DO ATENDIMENTO<input name="dayStart" type="time" required defaultValue={minutesToTime(settings.dayStart)} /></label>
          <label>FIM DO ATENDIMENTO<input name="dayEnd" type="time" required defaultValue={minutesToTime(settings.dayEnd)} /></label>
          <label>PAUSA · INÍCIO<input name="breakStart" type="time" defaultValue={settings.breakStart !== null ? minutesToTime(settings.breakStart) : ""} /></label>
          <label>PAUSA · FIM<input name="breakEnd" type="time" defaultValue={settings.breakEnd !== null ? minutesToTime(settings.breakEnd) : ""} /></label>
        </div>
        <div className="settings-form-wide agenda-when">
          <label>DURAÇÃO DA REUNIÃO<select name="meetingMinutes" className="ai-select" defaultValue={settings.meetingMinutes}>{[15, 20, 30, 45, 60, 90, 120].map((minutes) => <option key={minutes} value={minutes}>{minutes} minutos</option>)}</select></label>
          <label>INTERVALO ENTRE COMPROMISSOS<select name="bufferMinutes" className="ai-select" defaultValue={settings.bufferMinutes}>{[0, 5, 10, 15, 30, 60].map((minutes) => <option key={minutes} value={minutes}>{minutes ? `${minutes} minutos` : "Sem intervalo"}</option>)}</select></label>
          <label>ANTECEDÊNCIA MÍNIMA (HORAS)<input name="minNoticeHours" type="number" min={0} max={336} required defaultValue={settings.minNoticeHours} /></label>
          <label>ATÉ QUANTOS DIAS À FRENTE<input name="maxDaysAhead" type="number" min={1} max={120} required defaultValue={settings.maxDaysAhead} /></label>
        </div>
        <label className="settings-form-wide">COMO A REUNIÃO ACONTECE<input name="meetingFormat" maxLength={300} defaultValue={settings.meetingFormat ?? ""} placeholder="Ex.: Google Meet, com o link enviado pelo WhatsApp" /></label>
        <label className="settings-form-wide ai-check"><input type="checkbox" name="aiBooking" defaultChecked={settings.aiBooking} /><span><b>A assistente pode marcar reuniões no atendimento.</b><small>No site, no WhatsApp de clientes e na área do cliente. Você recebe um e-mail a cada reunião marcada, com o contato e o resumo da conversa.</small></span></label>
        <div className="settings-form-actions"><button className="primary-action" type="submit">SALVAR</button></div>
      </form>
      <div className="agenda-preview">
        <p className="ai-previews-title">PRÓXIMOS HORÁRIOS QUE A ASSISTENTE OFERECERIA</p>
        {preview.length ? <ul>{preview.map((day) => <li key={day.data}><b>{day.dia}</b><span>{day.horarios.join(" · ")}</span></li>)}</ul> : <p className="settings-empty">Nenhum horário livre no período configurado.</p>}
      </div>
    </div>
  </section>;
}

/**
 * Mês em grade (segunda a domingo). Cada dia mostra até 3 eventos e "+N" para o resto (abre a semana); o número do
 * dia abre a semana e o "+" cria um evento naquela data. No celular, os eventos viram marcadores.
 */
export function AgendaMonth({ month, events, workDays }: { month: string; events: WeekEvent[]; workDays: number[] }) {
  const today = todayKey();
  const days = monthGrid(month);
  const view = `visao=mes&mes=${month}`;
  return <div className="agenda-month" role="grid" aria-label="Mês">
    <div className="agenda-month-head" role="row">{[1, 2, 3, 4, 5, 6, 0].map((weekday) => <span key={weekday} role="columnheader">{WEEKDAYS_SHORT[weekday]}</span>)}</div>
    <div className="agenda-month-grid">
      {days.map((day) => {
        const dayEvents = events.filter((event) => dayKey(event.startsAt) === day);
        const outside = monthOf(day) !== month;
        const weekday = weekdayOf(day);
        const classes = ["agenda-cell", outside ? "is-outside" : "", day === today ? "is-today" : "", workDays.includes(weekday) ? "" : "is-off"].filter(Boolean).join(" ");
        return <div key={day} className={classes} role="gridcell">
          <div className="agenda-cell-head">
            <Link className="agenda-cell-day" href={`/agenda?semana=${weekStart(day)}`} aria-label={`Abrir a semana de ${day.slice(8, 10)}/${day.slice(5, 7)}`}>{Number(day.slice(8, 10))}</Link>
            <Link className="agenda-cell-add" href={`/agenda?${view}&novo=1&dia=${day}`} aria-label={`Novo evento em ${day.slice(8, 10)}/${day.slice(5, 7)}`}>+</Link>
          </div>
          <div className="agenda-cell-events">
            {dayEvents.slice(0, 3).map((event) => <Link key={event.id} href={`/agenda?${view}&evento=${event.id}`} className={`agenda-chip is-${event.kind.toLowerCase()}${event.status === "DONE" ? " is-done" : ""}`} title={`${timeOf(event.startsAt)} · ${event.title}`}><time>{timeOf(event.startsAt)}</time><span>{event.title}</span></Link>)}
            {dayEvents.length > 3 ? <Link className="agenda-more" href={`/agenda?semana=${weekStart(day)}`}>+{dayEvents.length - 3} {dayEvents.length - 3 === 1 ? "evento" : "eventos"}</Link> : null}
          </div>
          {dayEvents.length ? <span className="agenda-dots" aria-hidden="true">{dayEvents.slice(0, 4).map((event) => <i key={event.id} className={`is-${event.kind.toLowerCase()}`} />)}</span> : null}
        </div>;
      })}
    </div>
  </div>;
}
