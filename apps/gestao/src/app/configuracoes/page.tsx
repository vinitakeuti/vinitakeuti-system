import Link from "next/link";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { PasswordChangeForm } from "@/features/auth/components/password-change-form";
import { requireManagementUser } from "@/features/auth/services/auth-session";
import { EmailTestPanel } from "@/features/settings/components/email-test-panel";
import { emailConfigStatus } from "@/lib/integrations/email";
import { LOG_LEVELS, LOG_SOURCES, getSystemLogSummary, listEmailLogs, listSystemLogs } from "@/features/system-logs/queries/system-log-queries";

export const dynamic = "force-dynamic";

const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "medium", timeZone: "America/Maceio" });
const SECTIONS = [{ id: "email", label: "E-MAIL" }, { id: "senha", label: "SENHA" }, { id: "logs", label: "LOGS DO SISTEMA" }] as const;
type Section = (typeof SECTIONS)[number]["id"];

type SettingsPageProps = { searchParams: Promise<{ secao?: string; cursor?: string; origem?: string; nivel?: string; busca?: string; envio?: string }> };

function href(params: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => { if (value) query.set(key, value); });
  const serialized = query.toString();
  return serialized ? `/configuracoes?${serialized}` : "/configuracoes";
}

const sourceLabel = (value: string) => LOG_SOURCES.find((item) => item.value === value)?.label ?? value;
const levelLabel = (value: string) => LOG_LEVELS.find((item) => item.value === value)?.label ?? value;

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const params = await searchParams;
  const user = await requireManagementUser();
  const section: Section = SECTIONS.some((item) => item.id === params.secao) ? params.secao as Section : "email";

  return <main className="app-shell"><AppSidebar current="settings" /><div className="workspace"><section className="directory-page settings-page">
    <header className="directory-header"><div><p className="eyebrow">GESTÃO / CONFIGURAÇÕES</p><h1>Configurações.</h1><p>Envio de e-mails, sua senha de acesso e os registros detalhados da gestão e do portal do cliente.</p></div><div className="header-actions"><SidebarToggle location="header" /><Link className="text-link" href="/configuracoes/profissional">PERFIL PROFISSIONAL</Link></div></header>
    <nav className="client-tabs settings-tabs" aria-label="Seções das configurações">{SECTIONS.map((item) => <Link key={item.id} href={href({ secao: item.id })} className={section === item.id ? "active" : undefined} aria-current={section === item.id ? "page" : undefined}>{item.label}</Link>)}</nav>
    {section === "email" ? <EmailSection params={params} defaultTo={user.email} /> : null}
    {section === "senha" ? <section className="settings-panel"><div className="settings-panel-heading"><div><h2>Senha de acesso.</h2><p>Entrando como {user.email}. Ao trocar, os outros aparelhos conectados precisam entrar de novo.</p></div></div><div className="settings-panel-body"><PasswordChangeForm className="settings-password" /></div></section> : null}
    {section === "logs" ? <LogsSection params={params} /> : null}
  </section></div></main>;
}

async function EmailSection({ params, defaultTo }: { params: Awaited<SettingsPageProps["searchParams"]>; defaultTo: string }) {
  const config = emailConfigStatus();
  const { data: logs, nextCursor } = await listEmailLogs({ cursor: params.cursor, status: params.envio });
  return <>
    <section className="settings-panel">
      <div className="settings-panel-heading"><div><h2>Servidor de envio.</h2><p>E-mails saem por SMTP, configurado nas variáveis de ambiente do serviço no Easypanel.</p></div><span className={config.configured ? "settings-badge is-ok" : "settings-badge is-warning"}>{config.configured ? "CONFIGURADO" : "NÃO CONFIGURADO"}</span></div>
      <div className="settings-panel-body">
        <dl className="settings-facts">
          <div><dt>Servidor</dt><dd>{config.host ?? "—"}</dd></div>
          <div><dt>Porta</dt><dd>{config.port} · {config.secure ? "TLS" : "STARTTLS"}</dd></div>
          <div><dt>Usuário</dt><dd>{config.user ?? "—"}</dd></div>
          <div><dt>Remetente</dt><dd>{config.from ?? "—"}</dd></div>
        </dl>
        {!config.configured ? <p className="settings-note">Faltam as variáveis <b>{config.missing.join(", ")}</b>. Exemplo: <code>SMTP_HOST=smtp.hostinger.com</code>, <code>SMTP_PORT=465</code>, <code>SMTP_SECURE=true</code>, <code>SMTP_USER=contato@viniciusriudi.com</code>, <code>SMTP_PASSWORD=…</code>, <code>EMAIL_FROM=Vinicius Riudi &lt;contato@viniciusriudi.com&gt;</code>.</p> : null}
        <EmailTestPanel configured={config.configured} defaultTo={defaultTo} />
      </div>
    </section>
    <section className="settings-panel">
      <div className="settings-panel-heading"><div><h2>Registro de envios.</h2><p>Cada envio e teste de conexão, com a resposta do servidor ou o motivo da falha.</p></div><nav className="settings-filter" aria-label="Filtrar envios">{[{ value: undefined, label: "TODOS" }, { value: "SENT", label: "ENVIADOS" }, { value: "FAILED", label: "FALHAS" }].map((item) => <Link key={item.label} href={href({ secao: "email", envio: item.value })} aria-current={params.envio === item.value ? "true" : undefined}>{item.label}</Link>)}</nav></div>
      {logs.length ? <ul className="settings-log-list">{logs.map((log) => <li key={log.id}><details>
        <summary><time>{dateTime.format(log.createdAt)}</time><span className={log.status === "SENT" ? "settings-level is-info" : "settings-level is-error"}>{log.status === "SENT" ? (log.kind === "verify" ? "CONEXÃO OK" : "ENVIADO") : "FALHA"}</span><b>{log.kind === "verify" ? "Teste de conexão SMTP" : log.subject}</b><small>{log.kind === "verify" ? "—" : log.toAddress}{log.durationMs !== null ? ` · ${log.durationMs} ms` : ""}</small></summary>
        <dl className="settings-log-detail">
          {log.messageId ? <div><dt>ID da mensagem</dt><dd><code>{log.messageId}</code></dd></div> : null}
          {log.response ? <div><dt>Resposta do servidor</dt><dd><code>{log.response}</code></dd></div> : null}
          {log.error ? <div><dt>Erro</dt><dd><code>{log.error}</code></dd></div> : null}
          <div><dt>Disparado por</dt><dd>{log.actorEmail ?? "Sistema"}</dd></div>
        </dl>
      </details></li>)}</ul> : <p className="settings-empty">Nenhum envio registrado{params.envio ? " com esse filtro" : ""}.</p>}
      {nextCursor ? <div className="table-footer"><Link className="text-link" href={href({ secao: "email", envio: params.envio, cursor: nextCursor })}>CARREGAR MAIS 50</Link></div> : null}
    </section>
  </>;
}

async function LogsSection({ params }: { params: Awaited<SettingsPageProps["searchParams"]> }) {
  const [{ data: logs, nextCursor }, summary] = await Promise.all([listSystemLogs({ cursor: params.cursor, source: params.origem, level: params.nivel, query: params.busca }), getSystemLogSummary()]);
  const filters = { secao: "logs", origem: params.origem, nivel: params.nivel, busca: params.busca };
  return <section className="settings-panel">
    <div className="settings-panel-heading"><div><h2>Logs do sistema.</h2><p>Logins, senhas, acessos ao portal, envios de e-mail e erros do servidor, da gestão e do portal do cliente. Guardados por 90 dias.</p></div>
      <dl className="settings-log-summary" aria-label="Últimas 24 horas"><div><dt>24H · INFORMAÇÃO</dt><dd>{summary.info}</dd></div><div><dt>ATENÇÃO</dt><dd className={summary.warning ? "is-warning" : undefined}>{summary.warning}</dd></div><div><dt>ERROS</dt><dd className={summary.error ? "is-error" : undefined}>{summary.error}</dd></div></dl>
    </div>
    <form className="settings-log-filters" action="/configuracoes">
      <input type="hidden" name="secao" value="logs" />
      <label className="settings-search">BUSCAR<input name="busca" defaultValue={params.busca ?? ""} placeholder="Evento, mensagem ou e-mail" /></label>
      <label>ORIGEM<select name="origem" defaultValue={params.origem ?? ""}><option value="">Todas</option>{LOG_SOURCES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      <label>NÍVEL<select name="nivel" defaultValue={params.nivel ?? ""}><option value="">Todos</option>{LOG_LEVELS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      <button type="submit">FILTRAR</button>
      {params.origem || params.nivel || params.busca ? <Link className="text-link" href={href({ secao: "logs" })}>LIMPAR</Link> : null}
    </form>
    {logs.length ? <ul className="settings-log-list">{logs.map((log) => <li key={log.id}><details>
      <summary><time>{dateTime.format(log.createdAt)}</time><span className={`settings-level is-${log.level}`}>{levelLabel(log.level).toUpperCase()}</span><b>{log.message}</b><small>{sourceLabel(log.source)} · {log.event}{log.actorEmail ? ` · ${log.actorEmail}` : ""}</small></summary>
      <dl className="settings-log-detail">
        <div><dt>Evento</dt><dd><code>{log.event}</code></dd></div>
        <div><dt>Origem</dt><dd>{sourceLabel(log.source)}</dd></div>
        {log.actorEmail ? <div><dt>Conta</dt><dd>{log.actorEmail}</dd></div> : null}
        {log.ip ? <div><dt>IP</dt><dd><code>{log.ip}</code></dd></div> : null}
        {log.userAgent ? <div><dt>Navegador</dt><dd>{log.userAgent}</dd></div> : null}
        {log.metadata ? <div><dt>Detalhes</dt><dd><pre>{JSON.stringify(log.metadata, null, 2)}</pre></dd></div> : null}
      </dl>
    </details></li>)}</ul> : <p className="settings-empty">Nenhum evento registrado{params.origem || params.nivel || params.busca ? " com esses filtros" : " ainda"}.</p>}
    {nextCursor ? <div className="table-footer"><Link className="text-link" href={href({ ...filters, cursor: nextCursor })}>CARREGAR MAIS 50</Link></div> : null}
  </section>;
}
