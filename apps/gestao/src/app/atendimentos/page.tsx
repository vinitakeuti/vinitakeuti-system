import Link from "next/link";
import type { AttendanceStatus } from "@prisma/client";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { ATTENDANCE_CHANNELS, ATTENDANCE_STATUSES, attendanceStatusLabel, countAttendances, listAttendances, type AttendanceChannelFilter } from "@/features/attendance/queries/attendance-queries";
import { formatPhone } from "@/features/ai/services/site-attendance";

export const dynamic = "force-dynamic";

const dateTime = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Maceio" });
const timeOnly = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Maceio" });
const dayOnly = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Maceio" });
const channelLabel: Record<string, string> = { SITE: "Site", WHATSAPP: "WhatsApp", PORTAL: "Área do cliente" };
const TABS: Array<{ id: AttendanceStatus | "ALL"; label: string }> = [...ATTENDANCE_STATUSES.map((status) => ({ id: status, label: attendanceStatusLabel[status] })), { id: "ALL", label: "Todos" }];

function when(date: Date) {
  return dayOnly.format(date) === dayOnly.format(new Date()) ? `Hoje, ${timeOnly.format(date)}` : dateTime.format(date);
}

const phoneText = (value: string | null) => value ? formatPhone(value.startsWith("55") ? value : `55${value}`) : "—";

type AttendancesPageProps = { searchParams: Promise<{ situacao?: string; canal?: string; busca?: string; cursor?: string }> };

/** Atendimentos: conversas da assistente com clientes e visitantes, por situação, com busca e filtro por canal. */
export default async function AttendancesPage({ searchParams }: AttendancesPageProps) {
  const params = await searchParams;
  const status = (TABS.some((tab) => tab.id === params.situacao) ? params.situacao : "NEW") as AttendanceStatus | "ALL";
  const channel = params.canal && Object.hasOwn(ATTENDANCE_CHANNELS, params.canal) ? params.canal as AttendanceChannelFilter : undefined;
  const query = params.busca?.trim().slice(0, 120) || undefined;
  const [counts, list] = await Promise.all([countAttendances({ channel, query }), listAttendances({ status, channel, query, cursor: params.cursor })]);
  const href = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams(Object.entries({ situacao: status === "NEW" ? undefined : status, canal: channel, busca: query, ...changes }).filter((entry): entry is [string, string] => Boolean(entry[1])));
    return `/atendimentos${next.size ? `?${next}` : ""}`;
  };

  return <main className="app-shell"><AppSidebar current="attendances" /><div className="workspace"><section className="directory-page">
    <header className="directory-header"><div><h1>Atendimentos</h1><p>As conversas da assistente com clientes e visitantes no site, no WhatsApp e na área do cliente: quem é a pessoa, como falar com ela e o resumo do que ela precisa.</p></div><div className="header-actions"><SidebarToggle location="header" /></div></header>
    <nav className="client-tabs settings-tabs" aria-label="Situação dos atendimentos">{TABS.map((tab) => <Link key={tab.id} href={href({ situacao: tab.id === "NEW" ? undefined : tab.id, cursor: undefined })} className={status === tab.id ? "active" : undefined} aria-current={status === tab.id ? "page" : undefined}>{tab.label} <b>{counts[tab.id]}</b></Link>)}</nav>

    <div className="directory-surface">
      <form className="client-search attendance-filters" action="/atendimentos">
        {status !== "NEW" ? <input type="hidden" name="situacao" value={status} /> : null}
        <label className="search-control">Buscar<input name="busca" defaultValue={query ?? ""} placeholder="Nome, telefone, e-mail ou assunto" maxLength={120} /></label>
        <label className="search-control attendance-channel">Canal<select name="canal" defaultValue={channel ?? ""}><option value="">Todos</option><option value="site">Site</option><option value="whatsapp">WhatsApp</option><option value="portal">Área do cliente</option></select></label>
        <button type="submit">Filtrar</button>
        {query || channel ? <Link className="text-link" href={href({ busca: undefined, canal: undefined, cursor: undefined })}>Limpar</Link> : null}
      </form>

      {list.data.length ? <div className="attendance-table" role="table" aria-label="Atendimentos">
        <div className="attendance-row is-head" role="row"><span role="columnheader">Pessoa</span><span role="columnheader">Telefone</span><span role="columnheader">Resumo</span><span role="columnheader">Reunião</span><span role="columnheader">Última mensagem</span></div>
        {list.data.map((item) => <Link key={item.id} href={`/atendimentos/${item.id}`} className={`attendance-row is-${item.attendanceStatus.toLowerCase()}`} role="row">
          <span className="attendance-person" role="cell"><b>{item.person}</b><small>{item.email ?? "sem e-mail"}</small><em>{channelLabel[item.channel] ?? item.channel}{status === "ALL" ? ` · ${attendanceStatusLabel[item.attendanceStatus]}` : ""}</em></span>
          <span className="attendance-phone" role="cell">{phoneText(item.phone)}</span>
          <span className="attendance-summary" role="cell">{item.summary ? item.summary : item.firstMessage ? <i>“{item.firstMessage.slice(0, 160)}”</i> : <i>Deixou os dados, mas ainda não mandou mensagem.</i>}</span>
          <span className={`attendance-meeting${item.meetingAt ? "" : " is-empty"}`} role="cell">{item.meetingAt ? <><b>{dateTime.format(item.meetingAt)}</b><small>Marcada</small></> : <small>—</small>}</span>
          <span className="attendance-when" role="cell"><time>{when(item.lastMessageAt)}</time><small>{item.messages} {item.messages === 1 ? "mensagem" : "mensagens"}</small></span>
        </Link>)}
      </div> : <div className="directory-empty"><p>{query || channel ? "Nenhum atendimento encontrado." : status === "NEW" ? "Nenhum atendimento novo." : "Nenhum atendimento nesta situação."}</p><span>{query || channel ? "Tente outra busca ou limpe os filtros." : "Os atendimentos aparecem aqui quando alguém conversa com a assistente no site, no WhatsApp ou na área do cliente."}</span></div>}
      {list.nextCursor ? <div className="table-footer"><Link className="text-link" href={href({ cursor: list.nextCursor })}>Carregar mais</Link></div> : null}
    </div>
  </section></div></main>;
}
