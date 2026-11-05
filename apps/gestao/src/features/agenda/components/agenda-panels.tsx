import Link from "next/link";
import { ConfirmSubmitButton } from "@/features/finance/components/confirm-submit-button";
import { PendingButton } from "@/features/agenda/components/agenda-modal";
import { archiveDoneAction, archiveEventAction, createEventAction, deleteEventAction, saveAgendaSettingsAction, setEventStatusAction, shiftEventAction, updateEventAction } from "@/features/agenda/services/agenda-actions";
import { eventKindLabel, type AgendaSettingsView, type FreeDay } from "@/features/agenda/services/agenda-service";
import { addDays, dayKey, EVENT_KINDS, minutesToTime, monthGrid, monthLabel, monthOf, timeOf, todayKey, WEEKDAYS, WEEKDAYS_SHORT, weekdayOf, weekStart } from "@/features/agenda/types/agenda";
import type { getCalendarEvent, listWeekEvents } from "@/features/agenda/queries/agenda-queries";

/**
 * Peças da tela da Agenda: semana em colunas (com as setas de remarcação), mês em grade, arquivo por mês, detalhe e
 * formulário do evento (no pop-up) e disponibilidade. `view` é a tela de origem (semana=…, visao=mes&mes=… ou
 * aba=arquivo&mes=…): links e ações voltam para ela.
 */

type WeekEvent = Awaited<ReturnType<typeof listWeekEvents>>[number];
type EventDetail = NonNullable<Awaited<ReturnType<typeof getCalendarEvent>>>;
type ClientOption = { id: string; name: string; company: string | null };

const fullDate = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric", timeZone: "America/Maceio" });
const stamp = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Maceio" });
const noon = (day: string) => new Date(`${day}T12:00:00-03:00`);
const shortDay = (day: string) => `${WEEKDAYS_SHORT[weekdayOf(day)].toLowerCase()}, ${day.slice(8, 10)}/${day.slice(5, 7)}`;
const kindClass = (kind: string) => `is-${kind.toLowerCase()}`;

function phoneLabel(value: string | null) {
  const digits = value?.replace(/\D/g, "") ?? "";
  const match = digits.match(/^55(\d{2})(\d{4,5})(\d{4})$/);
  return match ? `(${match[1]}) ${match[2]}-${match[3]}` : value;
}

const monthLong = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "America/Maceio" });

/** "2 a 8 de novembro" ou, virando o mês, "30 de novembro a 6 de dezembro". */
export function weekRangeLabel(monday: string) {
  const sunday = addDays(monday, 6);
  const first = Number(monday.slice(8, 10));
  const last = Number(sunday.slice(8, 10));
  return monthOf(monday) === monthOf(sunday) ? `${first} a ${last} de ${monthLong.format(noon(sunday))}` : `${first} de ${monthLong.format(noon(monday))} a ${last} de ${monthLong.format(noon(sunday))}`;
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d={direction === "left" ? "M10 3.5 5.5 8l4.5 4.5" : "M6 3.5 10.5 8 6 12.5"} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" /></svg>;
}

/** Origem da tela nos formulários: as ações voltam para ela. */
const Origin = ({ view }: { view: string }) => <input type="hidden" name="voltar" value={view} />;

/** Setas de remarcação: passam o evento para o dia anterior ou o seguinte, no mesmo horário. */
function MoveButtons({ event, view, large = false }: { event: { id: string; startsAt: Date }; view: string; large?: boolean }) {
  const day = dayKey(event.startsAt);
  return <div className={`agenda-move${large ? " is-large" : ""}`}>
    {([-1, 1] as const).map((days) => {
      const target = addDays(day, days);
      return <form key={days} action={shiftEventAction}>
        <input type="hidden" name="id" value={event.id} /><input type="hidden" name="dias" value={days} /><Origin view={view} />{large ? <input type="hidden" name="manter" value="1" /> : null}
        <PendingButton className="agenda-move-button" label={`Remarcar para ${shortDay(target)}`} title={`Remarcar para ${shortDay(target)}`}>
          {days < 0 ? <Chevron direction="left" /> : null}{large ? <span>{days < 0 ? "Dia anterior" : "Dia seguinte"}</span> : null}{days > 0 ? <Chevron direction="right" /> : null}
        </PendingButton>
      </form>;
    })}
  </div>;
}

function EventCard({ event, view, index, highlight }: { event: WeekEvent; view: string; index: number; highlight?: string }) {
  const done = event.status === "DONE";
  const person = event.client?.name ?? event.contactName;
  return <article className={`agenda-event ${kindClass(event.kind)}${done ? " is-done" : ""}${highlight === event.id ? " is-highlight" : ""}`} style={{ "--i": index } as React.CSSProperties}>
    <Link className="agenda-event-main" href={`/agenda?${view}&evento=${event.id}`} scroll={false}>
      <span className="agenda-event-time" aria-hidden="true"><b>{timeOf(event.startsAt)}</b><small>{timeOf(event.endsAt)}</small></span>
      <span className="agenda-event-body">
        <span className="agenda-event-meta"><i className="agenda-kind-mark" aria-hidden="true" />{eventKindLabel(event.kind)}<time>{timeOf(event.startsAt)}–{timeOf(event.endsAt)}</time></span>
        <b>{event.title}</b>
        {person ? <small>{person}</small> : null}
        {done || event.rescheduledCount || event.source === "ia-atendimento" ? <span className="agenda-event-tags">
          {done ? <em className="is-done">Concluído</em> : null}
          {event.rescheduledCount ? <em>Remarcado{event.rescheduledCount > 1 ? ` ${event.rescheduledCount}×` : ""}</em> : null}
          {event.source === "ia-atendimento" ? <em>Atendimento</em> : null}
        </span> : null}
      </span>
    </Link>
    {event.status === "SCHEDULED" ? <MoveButtons event={event} view={view} /> : done ? <form action={archiveEventAction} className="agenda-event-archive">
      <input type="hidden" name="id" value={event.id} /><Origin view={view} />
      <PendingButton className="agenda-text-button">Arquivar</PendingButton>
    </form> : null}
  </article>;
}

const nowTime = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "America/Maceio" });

/**
 * Semana. No computador, sete colunas; no celular, uma faixa fixa com os sete dias (toque leva ao dia) e a lista de
 * dias, cada um com cabeçalho numa linha só. Hoje recebe a linha de "agora" entre os eventos.
 */
export function AgendaWeek({ monday, events, workDays, highlight }: { monday: string; events: WeekEvent[]; workDays: number[]; highlight?: string }) {
  const today = todayKey();
  const now = new Date();
  const view = `semana=${monday}`;
  const days = Array.from({ length: 7 }, (_, index) => addDays(monday, index));
  const byDay = new Map(days.map((day) => [day, events.filter((event) => dayKey(event.startsAt) === day)]));
  return <>
    <nav className="agenda-strip" aria-label="Ir para o dia">
      {days.map((day) => {
        const dayEvents = byDay.get(day)!;
        return <a key={day} href={`#dia-${day}`} className={`${day === today ? "is-today" : ""}${day < today ? " is-past" : ""}`}>
          <small>{WEEKDAYS_SHORT[weekdayOf(day)]}</small>
          <b>{Number(day.slice(8, 10))}</b>
          <span className="agenda-strip-dots" aria-label={dayEvents.length ? `${dayEvents.length} ${dayEvents.length === 1 ? "evento" : "eventos"}` : "livre"}>{dayEvents.slice(0, 3).map((event) => <i key={event.id} className={kindClass(event.kind)} />)}</span>
        </a>;
      })}
    </nav>
    <div className="agenda-week">
      {days.map((day, index) => {
        const dayEvents = byDay.get(day)!;
        const weekday = weekdayOf(day);
        const isToday = day === today;
        const showMonth = day.endsWith("-01");
        const nowAt = isToday ? dayEvents.findIndex((event) => event.startsAt > now) : -2;
        const nowLine = <div className="agenda-now" key="agora" aria-label={`Agora, ${nowTime.format(now)}`}><span>Agora · {nowTime.format(now)}</span></div>;
        const classes = ["agenda-day", isToday ? "is-today" : "", day < today ? "is-past" : "", workDays.includes(weekday) ? "" : "is-off", dayEvents.length ? "" : "is-empty"].filter(Boolean).join(" ");
        return <section key={day} id={`dia-${day}`} className={classes} style={{ "--i": index } as React.CSSProperties} aria-label={fullDate.format(noon(day))}>
          <header className="agenda-day-head">
            <b className="agenda-day-num">{day.slice(8, 10)}</b>
            <span className="agenda-day-name">
              <span className="agenda-day-weekday"><span className="is-short">{WEEKDAYS_SHORT[weekday]}</span><span className="is-long">{WEEKDAYS[weekday]}</span>{isToday ? <em>Hoje</em> : null}</span>
              <small className={showMonth ? "is-shown" : undefined}>{monthLong.format(noon(day))}</small>
            </span>
            {dayEvents.length ? <span className="agenda-day-count" title={`${dayEvents.length} ${dayEvents.length === 1 ? "evento" : "eventos"}`}>{dayEvents.length}</span> : <span className="agenda-day-free">Livre</span>}
            <Link className="agenda-day-add" href={`/agenda?${view}&novo=1&dia=${day}`} scroll={false} aria-label={`Novo evento em ${shortDay(day)}`} title="Novo evento neste dia"><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M8 3v10M3 8h10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" /></svg></Link>
          </header>
          <div className="agenda-day-events">
            {dayEvents.map((event, eventIndex) => [eventIndex === nowAt ? nowLine : null, <EventCard key={event.id} event={event} view={view} index={eventIndex} highlight={highlight} />])}
            {isToday && dayEvents.length && nowAt === -1 ? nowLine : null}
            {dayEvents.length ? null : <p className="agenda-empty">Livre</p>}
          </div>
        </section>;
      })}
    </div>
  </>;
}

/** Arquivar de uma vez os concluídos do período na tela. */
export function ArchiveDoneButton({ from, to, view, count }: { from: string; to: string; view: string; count: number }) {
  if (!count) return null;
  return <form action={archiveDoneAction} className="agenda-archive-done">
    <input type="hidden" name="de" value={from} /><input type="hidden" name="ate" value={to} /><Origin view={view} />
    <PendingButton className="secondary-action">Arquivar concluídos · {count}</PendingButton>
  </form>;
}

export function EventDetailPanel({ event, view }: { event: EventDetail; view: string }) {
  const statusLabel = event.archivedAt ? "Arquivado" : event.status === "CANCELLED" ? "Cancelado" : event.status === "DONE" ? "Concluído" : "Marcado";
  const statusForm = (status: string, label: string, className = "secondary-action") => <form action={setEventStatusAction}>
    <input type="hidden" name="id" value={event.id} /><input type="hidden" name="status" value={status} /><Origin view={view} />
    <PendingButton className={className}>{label}</PendingButton>
  </form>;
  return <div className="agenda-sheet">
    <header className={`agenda-sheet-head ${kindClass(event.kind)}`}>
      <p className="agenda-sheet-kind"><i className="agenda-kind-mark" aria-hidden="true" />{eventKindLabel(event.kind)}{event.source === "ia-atendimento" ? " · marcado pela assistente no atendimento" : event.source === "ia-gestao" ? " · criado pela assistente" : ""}</p>
      <h2 id="agenda-modal-title">{event.title}</h2>
      <p className="agenda-sheet-when"><span>{fullDate.format(event.startsAt)}</span><b>{timeOf(event.startsAt)} – {timeOf(event.endsAt)}</b></p>
      <span className={`agenda-status is-${event.archivedAt ? "archived" : event.status.toLowerCase()}`}>{statusLabel}</span>
    </header>
    <div className="agenda-sheet-body">
      {event.rescheduledFrom ? <p className="agenda-sheet-note">Remarcado {event.rescheduledCount > 1 ? `${event.rescheduledCount} vezes` : "uma vez"} · originalmente {fullDate.format(event.rescheduledFrom)}, às {timeOf(event.rescheduledFrom)}.</p> : null}
      <dl className="agenda-facts">
        {event.client ? <div><dt>Cliente</dt><dd><Link href={`/clientes/${event.client.id}`}>{event.client.name}</Link></dd></div> : null}
        {event.contactName && !event.client ? <div><dt>Contato</dt><dd>{event.contactName}</dd></div> : null}
        {event.contactPhone ? <div><dt>Telefone</dt><dd><a href={`https://wa.me/${event.contactPhone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer noopener">{phoneLabel(event.contactPhone)}</a></dd></div> : null}
        {event.contactEmail ? <div><dt>E-mail</dt><dd><a href={`mailto:${event.contactEmail}`}>{event.contactEmail}</a></dd></div> : null}
        {event.location ? <div><dt>Local ou formato</dt><dd>{/^https?:\/\//.test(event.location) ? <a href={event.location} target="_blank" rel="noreferrer noopener">{event.location}</a> : event.location}</dd></div> : null}
        <div><dt>Criado</dt><dd>{stamp.format(event.createdAt)}{event.createdBy && event.createdBy !== "ia" ? ` · ${event.createdBy}` : ""}</dd></div>
        {event.archivedAt ? <div><dt>Arquivado</dt><dd>{stamp.format(event.archivedAt)}</dd></div> : null}
      </dl>
      {event.conversation?.summary ? <div className="ai-session-summary"><span>Resumo do atendimento{event.conversation.summaryUpdatedAt ? ` · ${stamp.format(event.conversation.summaryUpdatedAt)}` : ""}</span><p>{event.conversation.summary}</p></div> : null}
      {event.description && !event.conversation?.summary ? <p className="agenda-description">{event.description}</p> : null}
      {event.conversation ? <Link className="text-link agenda-sheet-link" href={`/integracoes/ia?aba=atividade${event.conversation.channel === "GESTAO" || event.conversation.channel === "SISTEMA" ? "" : "&escopo=atendimento"}`}>Ver na atividade da IA →</Link> : null}
    </div>
    {event.status === "SCHEDULED" ? <div className="agenda-sheet-move"><span>Remarcar</span><MoveButtons event={event} view={view} large /></div> : null}
    <footer className="agenda-sheet-actions">
      {event.status === "SCHEDULED" ? statusForm("DONE", "Concluir", "primary-action") : null}
      {event.status === "DONE" && !event.archivedAt ? <form action={archiveEventAction}><input type="hidden" name="id" value={event.id} /><Origin view={view} /><PendingButton className="primary-action">Arquivar</PendingButton></form> : null}
      {event.archivedAt ? <form action={archiveEventAction}><input type="hidden" name="id" value={event.id} /><input type="hidden" name="arquivar" value="0" /><Origin view={view} /><PendingButton className="primary-action">Desarquivar</PendingButton></form> : null}
      {event.status !== "SCHEDULED" ? statusForm("SCHEDULED", "Reabrir") : null}
      {event.archivedAt ? null : <Link className="secondary-action" href={`/agenda?${view}&evento=${event.id}&editar=1`} scroll={false}>Editar</Link>}
      <span className="agenda-detail-spacer" />
      {event.status === "SCHEDULED" ? <form><input type="hidden" name="id" value={event.id} /><input type="hidden" name="status" value="CANCELLED" /><Origin view={view} /><ConfirmSubmitButton formAction={setEventStatusAction} className="text-link integration-disconnect" message="Cancelar este evento? Ele sai da agenda, mas continua no histórico.">Cancelar evento</ConfirmSubmitButton></form> : null}
      <form><input type="hidden" name="id" value={event.id} /><Origin view={view} /><ConfirmSubmitButton formAction={deleteEventAction} className="text-link integration-disconnect" message="Excluir este evento de vez? Não dá para desfazer.">Excluir</ConfirmSubmitButton></form>
    </footer>
  </div>;
}

const KIND_HINTS: Record<string, string> = { MEETING: "com cliente ou contato", APPOINTMENT: "um compromisso seu", TASK: "tarefa do dia a dia", REMINDER: "para não esquecer" };

export function EventForm({ clients, event, defaultDay, settings, view }: { clients: ClientOption[]; event?: EventDetail; defaultDay: string; settings: AgendaSettingsView; view: string }) {
  const day = event ? dayKey(event.startsAt) : defaultDay;
  const start = event ? timeOf(event.startsAt) : minutesToTime(settings.dayStart);
  const end = event ? timeOf(event.endsAt) : minutesToTime(settings.dayStart + settings.meetingMinutes);
  return <div className="agenda-sheet">
    <header className="agenda-sheet-head">
      <p className="agenda-sheet-kind">{event ? "Editar evento" : `Novo evento · ${shortDay(day)}`}</p>
      <h2 id="agenda-modal-title">{event ? event.title : "O que entra na agenda?"}</h2>
      <p className="agenda-sheet-sub">{event ? "Altere o que for preciso. O resumo do atendimento continua ligado ao evento." : "Reunião, compromisso, demanda ou lembrete. Conflitos de horário são avisados, mas não impedem."}</p>
    </header>
    <form className="settings-form agenda-form" action={event ? updateEventAction : createEventAction}>
      {event ? <input type="hidden" name="id" value={event.id} /> : null}
      <Origin view={view} />
      <fieldset className="settings-form-wide agenda-kinds"><legend>Tipo</legend>
        {Object.entries(EVENT_KINDS).map(([value, label]) => <label key={value} className={kindClass(value)}>
          <input type="radio" name="kind" value={value} defaultChecked={(event?.kind ?? "MEETING") === value} />
          <span><i className="agenda-kind-mark" aria-hidden="true" /><b>{label}</b><small>{KIND_HINTS[value]}</small></span>
        </label>)}
      </fieldset>
      <label className="settings-form-wide">Título<input name="title" required maxLength={160} defaultValue={event?.title ?? ""} placeholder="Ex.: Reunião de briefing · Construtora Virtus" autoFocus={!event} /></label>
      <div className="settings-form-wide agenda-when">
        <label>Data<input name="day" type="date" required defaultValue={day} /></label>
        <label>Início<input name="start" type="time" required defaultValue={start} /></label>
        <label>FIM<input name="end" type="time" required defaultValue={end} /></label>
      </div>
      <label className="settings-form-wide">Cliente<select name="clientId" className="ai-select" defaultValue={event?.clientId ?? ""}><option value="">Nenhum</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}{client.company ? ` · ${client.company}` : ""}</option>)}</select></label>
      <label className="settings-form-wide">Local ou link<input name="location" maxLength={300} defaultValue={event?.location ?? (event ? "" : settings.meetingFormat ?? "")} placeholder="Endereço, link do Meet ou 'por telefone'" /></label>
      <label className="settings-form-wide">Descrição<textarea name="description" rows={3} maxLength={4000} defaultValue={event?.description ?? ""} placeholder="Pauta, o que levar, observações…" /></label>
      <div className="settings-form-actions agenda-form-actions"><PendingButton className="primary-action">{event ? "Salvar" : "Criar evento"}</PendingButton><Link className="text-link" href={`/agenda?${view}${event ? `&evento=${event.id}` : ""}`} scroll={false}>Cancelar</Link></div>
    </form>
  </div>;
}

export function AvailabilityPanel({ settings, preview }: { settings: AgendaSettingsView; preview: FreeDay[] }) {
  const workDays = new Set(settings.workDays);
  return <section className="settings-panel" aria-labelledby="agenda-availability-title">
    <div className="settings-panel-heading"><div><h2 id="agenda-availability-title">Disponibilidade para reuniões</h2><p>Quando a assistente pode marcar reuniões no atendimento. Ela só oferece horários livres dentro destas regras e nunca mostra os seus compromissos.</p></div></div>
    <div className="settings-panel-body">
      <form className="settings-form" action={saveAgendaSettingsAction}>
        <fieldset className="settings-form-wide agenda-days"><legend>Dias de atendimento</legend>{[1, 2, 3, 4, 5, 6, 0].map((day) => <label key={day}><input type="checkbox" name="workDays" value={day} defaultChecked={workDays.has(day)} /><span>{WEEKDAYS[day]}</span></label>)}</fieldset>
        <div className="settings-form-wide agenda-when">
          <label>Início do atendimento<input name="dayStart" type="time" required defaultValue={minutesToTime(settings.dayStart)} /></label>
          <label>Fim do atendimento<input name="dayEnd" type="time" required defaultValue={minutesToTime(settings.dayEnd)} /></label>
          <label>Pausa · início<input name="breakStart" type="time" defaultValue={settings.breakStart !== null ? minutesToTime(settings.breakStart) : ""} /></label>
          <label>Pausa · fim<input name="breakEnd" type="time" defaultValue={settings.breakEnd !== null ? minutesToTime(settings.breakEnd) : ""} /></label>
        </div>
        <div className="settings-form-wide agenda-when">
          <label>Duração da reunião<select name="meetingMinutes" className="ai-select" defaultValue={settings.meetingMinutes}>{[15, 20, 30, 45, 60, 90, 120].map((minutes) => <option key={minutes} value={minutes}>{minutes} minutos</option>)}</select></label>
          <label>Intervalo entre compromissos<select name="bufferMinutes" className="ai-select" defaultValue={settings.bufferMinutes}>{[0, 5, 10, 15, 30, 60].map((minutes) => <option key={minutes} value={minutes}>{minutes ? `${minutes} minutos` : "Sem intervalo"}</option>)}</select></label>
          <label>Antecedência mínima (horas)<input name="minNoticeHours" type="number" min={0} max={336} required defaultValue={settings.minNoticeHours} /></label>
          <label>Até quantos dias à frente<input name="maxDaysAhead" type="number" min={1} max={120} required defaultValue={settings.maxDaysAhead} /></label>
        </div>
        <label className="settings-form-wide">Como a reunião acontece<input name="meetingFormat" maxLength={300} defaultValue={settings.meetingFormat ?? ""} placeholder="Ex.: Google Meet, com o link enviado pelo WhatsApp" /></label>
        <label className="settings-form-wide ai-check"><input type="checkbox" name="aiBooking" defaultChecked={settings.aiBooking} /><span><b>A assistente pode marcar reuniões no atendimento.</b><small>No site, no WhatsApp de clientes e na área do cliente. Você recebe um e-mail a cada reunião marcada, com o contato e o resumo da conversa.</small></span></label>
        <div className="settings-form-actions"><button className="primary-action" type="submit">Salvar</button></div>
      </form>
      <div className="agenda-preview">
        <p className="ai-previews-title">Próximos horários que a assistente ofereceria</p>
        {preview.length ? <ul>{preview.map((day) => <li key={day.data}><b>{day.dia}</b><span>{day.horarios.join(" · ")}</span></li>)}</ul> : <p className="settings-empty">Nenhum horário livre no período configurado.</p>}
      </div>
    </div>
  </section>;
}

/**
 * Mês em grade (segunda a domingo). Cada dia mostra até 3 eventos e "+N" para o resto (abre a semana); o número do
 * dia abre a semana e o "+" cria um evento naquela data. No celular, os eventos viram marcadores.
 */
export function AgendaMonth({ month, events, workDays, highlight }: { month: string; events: WeekEvent[]; workDays: number[]; highlight?: string }) {
  const today = todayKey();
  const days = monthGrid(month);
  const view = `visao=mes&mes=${month}`;
  return <div className="agenda-month" role="grid" aria-label={monthLabel(month)}>
    <div className="agenda-month-head" role="row">{[1, 2, 3, 4, 5, 6, 0].map((weekday) => <span key={weekday} role="columnheader">{WEEKDAYS_SHORT[weekday]}</span>)}</div>
    <div className="agenda-month-grid">
      {days.map((day, index) => {
        const dayEvents = events.filter((event) => dayKey(event.startsAt) === day);
        const outside = monthOf(day) !== month;
        const weekday = weekdayOf(day);
        const classes = ["agenda-cell", outside ? "is-outside" : "", day === today ? "is-today" : "", day < today ? "is-past" : "", workDays.includes(weekday) ? "" : "is-off"].filter(Boolean).join(" ");
        return <div key={day} className={classes} role="gridcell" style={{ "--i": index } as React.CSSProperties}>
          <div className="agenda-cell-head">
            <Link className="agenda-cell-day" href={`/agenda?semana=${weekStart(day)}#dia-${day}`} aria-label={`Abrir a semana de ${day.slice(8, 10)}/${day.slice(5, 7)}`}>{Number(day.slice(8, 10))}</Link>
            <Link className="agenda-cell-add" href={`/agenda?${view}&novo=1&dia=${day}`} scroll={false} aria-label={`Novo evento em ${day.slice(8, 10)}/${day.slice(5, 7)}`}>+</Link>
          </div>
          <div className="agenda-cell-events">
            {dayEvents.slice(0, 3).map((event) => <Link key={event.id} href={`/agenda?${view}&evento=${event.id}`} scroll={false} className={`agenda-chip ${kindClass(event.kind)}${event.status === "DONE" ? " is-done" : ""}${highlight === event.id ? " is-highlight" : ""}`} title={`${timeOf(event.startsAt)} · ${event.title}`}><time>{timeOf(event.startsAt)}</time><span>{event.title}</span></Link>)}
            {dayEvents.length > 3 ? <Link className="agenda-more" href={`/agenda?semana=${weekStart(day)}`}>+{dayEvents.length - 3} {dayEvents.length - 3 === 1 ? "evento" : "eventos"}</Link> : null}
          </div>
          {dayEvents.length ? <span className="agenda-dots" aria-hidden="true">{dayEvents.slice(0, 4).map((event) => <i key={event.id} className={kindClass(event.kind)} />)}</span> : null}
        </div>;
      })}
    </div>
  </div>;
}

const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

/** Árvore do arquivo: anos (o do mês aberto fica expandido) e, dentro de cada um, os meses com a quantidade. */
function ArchiveTree({ months, month }: { months: Array<{ month: string; count: number }>; month: string | null }) {
  const years = [...new Set(months.map((item) => item.month.slice(0, 4)))];
  const activeYear = month?.slice(0, 4);
  return <nav className="agenda-tree">
    {years.map((year) => {
      const items = months.filter((item) => item.month.startsWith(year));
      const total = items.reduce((sum, item) => sum + item.count, 0);
      return <details key={year} className="agenda-tree-year" open={year === activeYear}>
        <summary><svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" /></svg><b>{year}</b><small>{total}</small></summary>
        <ul>{items.map((item) => <li key={item.month}><Link href={`/agenda?aba=arquivo&mes=${item.month}`} className={item.month === month ? "is-active" : undefined} aria-current={item.month === month ? "page" : undefined}><span>{MONTH_NAMES[Number(item.month.slice(5, 7)) - 1]}</span><small>{item.count}</small></Link></li>)}</ul>
      </details>;
    })}
  </nav>;
}

/** Arquivo: meses com eventos arquivados e a lista do mês escolhido, agrupada por dia, em páginas. */
export function AgendaArchive({ months, month, events, next, cursor }: { months: Array<{ month: string; count: number }>; month: string | null; events: WeekEvent[]; next: string | null; cursor?: string }) {
  if (!months.length) return <div className="agenda-archive-empty">
    <span className="agenda-archive-empty-mark" aria-hidden="true" />
    <h2>Nada arquivado ainda</h2>
    <p>Conclua eventos e demandas e arquive para tirá-los da semana. Eles ficam guardados aqui, organizados por mês.</p>
  </div>;
  const view = `aba=arquivo&mes=${month}`;
  const days = [...new Set(events.map((event) => dayKey(event.startsAt)))];
  const total = months.find((item) => item.month === month)?.count ?? 0;
  const tree = <ArchiveTree months={months} month={month} />;
  return <div className="agenda-archive">
    <aside className="agenda-archive-side" aria-label="Arquivo por ano e mês">{tree}</aside>
    <details className="agenda-archive-picker">
      <summary><span>Navegar no arquivo</span><b>{month ? monthLabel(month) : ""}</b><svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" /></svg></summary>
      {tree}
    </details>
    <div className="agenda-archive-list">
      <header><p className="agenda-archive-crumb">Arquivo / {month?.slice(0, 4)}</p><h2>{month ? MONTH_NAMES[Number(month.slice(5, 7)) - 1] : ""}</h2><span>{total} {total === 1 ? "evento arquivado" : "eventos arquivados"}</span></header>
      {days.length ? days.map((day) => <section key={day} className="agenda-archive-day">
        <h3><b>{day.slice(8, 10)}</b><span>{WEEKDAYS[weekdayOf(day)]}</span></h3>
        <ul>{events.filter((event) => dayKey(event.startsAt) === day).map((event) => <li key={event.id} className={kindClass(event.kind)}>
          <Link href={`/agenda?${view}${cursor ? `&depois=${cursor}` : ""}&evento=${event.id}`} scroll={false}>
            <time>{timeOf(event.startsAt)}</time>
            <span className="agenda-archive-kind"><i className="agenda-kind-mark" aria-hidden="true" />{eventKindLabel(event.kind)}</span>
            <b>{event.title}</b>
            <small>{event.client?.name ?? event.contactName ?? ""}</small>
          </Link>
          <form action={archiveEventAction}><input type="hidden" name="id" value={event.id} /><input type="hidden" name="arquivar" value="0" /><Origin view={view} /><PendingButton className="agenda-text-button" label={`Desarquivar ${event.title}`}>Desarquivar</PendingButton></form>
        </li>)}</ul>
      </section>) : <p className="settings-empty">Nenhum evento arquivado neste mês.</p>}
      {cursor || next ? <div className="agenda-archive-pages">
        {cursor ? <Link className="secondary-action" href={`/agenda?${view}`}>← Mais recentes</Link> : <span />}
        {next ? <Link className="secondary-action" href={`/agenda?${view}&depois=${next}`}>Mais antigos →</Link> : null}
      </div> : null}
    </div>
  </div>;
}
