import Link from "next/link";
import { notFound } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { prisma } from "@/lib/prisma";
import { ATTENDANCE_STATUSES, attendanceStatusLabel, getAttendance } from "@/features/attendance/queries/attendance-queries";
import { createClientFromAttendanceAction, saveAttendanceNotesAction, setAttendanceStatusAction } from "@/features/attendance/services/attendance-actions";
import { conversationView } from "@/features/ai/services/conversations";
import { formatPhone } from "@/features/ai/services/site-attendance";
import { formatCost } from "@/features/ai/services/ai-costs";
import { AssistantMarkdown } from "@/features/ai/components/assistant-markdown";
import { toolLabel } from "@/features/ai/types/tool-labels";

export const dynamic = "force-dynamic";

const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Maceio" });
const longDate = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "America/Maceio" });
const timeOnly = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Maceio" });
const number = new Intl.NumberFormat("pt-BR");
const channelLabel: Record<string, string> = { SITE: "Site", WHATSAPP: "WhatsApp", PORTAL: "Área do cliente" };
const notices: Record<string, string> = { situacao: "Situação atualizada.", anotacoes: "Anotações salvas.", cliente: "Cliente cadastrado e vinculado a este atendimento.", vinculado: "Já havia um cliente com este e-mail ou telefone: o atendimento foi vinculado a ele.", "ja-cliente": "Este atendimento já está vinculado a um cliente." };

type AttendancePageProps = { params: Promise<{ id: string }>; searchParams: Promise<{ aviso?: string; erro?: string }> };

/** Um atendimento: a pessoa e o contato, o resumo, a reunião, suas anotações e a conversa inteira com a assistente. */
export default async function AttendancePage({ params, searchParams }: AttendancePageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const attendance = await getAttendance(id);
  if (!attendance) notFound();
  const [view, settings] = await Promise.all([conversationView(attendance.id, { take: 600 }), prisma.aiSettings.findUnique({ where: { id: "default" }, select: { assistantName: true, usdBrlCents: true } })]);
  const assistant = settings?.assistantName ?? "Assistente";
  const phone = attendance.phone ? (attendance.phone.startsWith("55") ? attendance.phone : `55${attendance.phone}`) : null;
  const cost = formatCost(attendance.costMicros, settings?.usdBrlCents ?? null);
  const nextMeeting = attendance.events.find((event) => event.status === "SCHEDULED" && event.startsAt > new Date());

  return <main className="app-shell"><AppSidebar current="attendances" /><div className="workspace"><section className="directory-page">
    <header className="directory-header"><div><p className="eyebrow"><Link className="integration-crumb" href="/atendimentos">GESTÃO / ATENDIMENTOS</Link> / {channelLabel[attendance.channel]?.toUpperCase()}</p><h1>{attendance.person}.</h1><p>{channelLabel[attendance.channel] ?? attendance.channel} · começou em {dateTime.format(attendance.createdAt)} · última mensagem em {dateTime.format(attendance.lastMessageAt)}</p></div><div className="header-actions"><span className={`settings-badge ${attendance.attendanceStatus === "NEW" ? "is-warning" : "is-ok"}`}>{attendanceStatusLabel[attendance.attendanceStatus].toUpperCase()}</span><SidebarToggle location="header" /></div></header>
    {query.aviso && notices[query.aviso] ? <p className="form-success" role="status">{notices[query.aviso]}</p> : null}
    {query.erro ? <p className="form-error" role="alert">{query.erro.slice(0, 300)}</p> : null}

    <div className="attendance-detail">
      <aside className="attendance-side" aria-label="Dados do atendimento">
        <section>
          <h2>Contato</h2>
          <dl className="attendance-facts">
            <div><dt>NOME</dt><dd>{attendance.person}</dd></div>
            <div><dt>TELEFONE</dt><dd>{phone ? <a href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer noopener">{formatPhone(phone)}</a> : "—"}</dd></div>
            <div><dt>E-MAIL</dt><dd>{attendance.email ? <a href={`mailto:${attendance.email}`}>{attendance.email}</a> : "—"}</dd></div>
            <div><dt>CLIENTE</dt><dd>{attendance.client ? <Link href={`/clientes/${attendance.client.id}`}>{attendance.client.name}</Link> : "Não cadastrado"}</dd></div>
          </dl>
          <div className="attendance-buttons">
            {phone ? <a className="primary-action" href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer noopener">WHATSAPP</a> : null}
            {attendance.email ? <a className="secondary-action" href={`mailto:${attendance.email}`}>E-MAIL</a> : null}
            {!attendance.client ? <form action={createClientFromAttendanceAction}><input type="hidden" name="id" value={attendance.id} /><button className="secondary-action" type="submit">CADASTRAR COMO CLIENTE</button></form> : null}
          </div>
        </section>
        <section>
          <h2>Situação</h2>
          <form className="attendance-status" action={setAttendanceStatusAction}>
            <input type="hidden" name="id" value={attendance.id} />
            {ATTENDANCE_STATUSES.map((status) => <button key={status} type="submit" name="status" value={status} aria-pressed={attendance.attendanceStatus === status} className={attendance.attendanceStatus === status ? "is-current" : undefined}>{attendanceStatusLabel[status]}</button>)}
          </form>
        </section>
        <section>
          <h2>Resumo</h2>
          {attendance.summary ? <p className="attendance-summary-full">{attendance.summary}</p> : <p className="attendance-muted">A assistente ainda não registrou o resumo desta conversa.</p>}
          {attendance.summaryUpdatedAt ? <small className="attendance-muted">Atualizado em {dateTime.format(attendance.summaryUpdatedAt)}</small> : null}
        </section>
        <section>
          <h2>Reunião</h2>
          {attendance.events.length ? <ul className="attendance-meetings">{attendance.events.map((event) => <li key={event.id} className={event.status !== "SCHEDULED" ? "is-past" : undefined}><Link href={`/agenda?evento=${event.id}`}><b>{longDate.format(event.startsAt)}</b><small>{event.status === "CANCELLED" ? "cancelada" : event.status === "DONE" ? "concluída" : event === nextMeeting ? "marcada" : "marcada (passou)"}</small></Link></li>)}</ul> : <p className="attendance-muted">Nenhuma reunião marcada nesta conversa.</p>}
        </section>
        <section>
          <h2>Anotações</h2>
          <form className="attendance-notes" action={saveAttendanceNotesAction}>
            <input type="hidden" name="id" value={attendance.id} />
            <textarea name="notes" rows={5} maxLength={4000} defaultValue={attendance.ownerNotes ?? ""} placeholder="O que você combinou, próximos passos, observações…" aria-label="Anotações" />
            <button className="secondary-action" type="submit">SALVAR ANOTAÇÕES</button>
          </form>
        </section>
        <section>
          <h2>Consumo</h2>
          <p className="attendance-muted">{attendance.userMessages} {attendance.userMessages === 1 ? "mensagem" : "mensagens"} da pessoa · {attendance.runs} {attendance.runs === 1 ? "resposta" : "respostas"} · {number.format(attendance.tokens)} tokens{attendance.costMicros !== null ? ` · ${cost.usd}${cost.brl ? ` (${cost.brl})` : ""}` : ""}</p>
        </section>
      </aside>

      <section className="attendance-thread" aria-label="Conversa">
        <header><h2>Conversa</h2><span>{view.items.filter((item) => item.kind === "user").length} mensagens de {attendance.person.split(" ")[0]}</span></header>
        <ol>
          {view.items.map((item) => {
            if (item.kind === "tools") return <li key={item.id} className="attendance-steps">{item.tools.map((tool, index) => <span key={index} className={`is-${tool.status}`}><i aria-hidden="true" />{toolLabel(tool.name)}</span>)}</li>;
            const mine = item.kind === "user";
            return <li key={item.id} className={mine ? "is-person" : "is-assistant"}>
              <span className="attendance-author">{mine ? attendance.person.split(" ")[0] : assistant} · {timeOnly.format(new Date(item.at))}</span>
              {mine ? <p>{item.text}</p> : <div className="attendance-text"><AssistantMarkdown text={item.text} /></div>}
            </li>;
          })}
        </ol>
      </section>
    </div>
  </section></div></main>;
}
