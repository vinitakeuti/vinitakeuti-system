import Link from "next/link";
import { notFound } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { ClientPicker } from "@/features/clients/components/client-picker";
import { DeleteMonitoredAppButton } from "@/features/monitoring/components/delete-monitored-app-button";
import { getMonitoredApp } from "@/features/monitoring/queries/monitoring-queries";
import { MonitoringGuide } from "@/features/monitoring/components/monitoring-guide";
import { deleteMonitoredApp, updateMonitoredApp } from "@/features/monitoring/services/monitoring-actions";
import { monitoringEnvironments, monitoringStatusClass, monitoringStatusLabel } from "@/features/monitoring/types/monitoring-labels";

export const dynamic = "force-dynamic";

const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Maceio" });

export default async function MonitoredAppPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; updated?: string }> }) {
  const [{ id }, { error, updated }] = await Promise.all([params, searchParams]);
  const app = await getMonitoredApp(id);
  if (!app) notFound();

  return <main className="app-shell"><AppSidebar current="monitoring" /><div className="workspace"><section className="directory-page form-page">
    <header className="directory-header"><div><p className="eyebrow">MONITORAMENTO / SISTEMA</p><h1>{app.name}</h1><p><span className={`monitoring-status monitoring-status-${monitoringStatusClass[app.status]}`}><i />{monitoringStatusLabel[app.status]}</span> · {app.lastCheckedAt ? `Última verificação em ${date.format(app.lastCheckedAt)}${app.lastResponseMs !== null ? ` · ${app.lastResponseMs} ms` : ""}` : "Ainda não verificado"}</p></div><div className="header-actions"><SidebarToggle location="header" /><Link className="text-link" href="/monitoramento">VOLTAR PARA MONITORAMENTO</Link></div></header>
    <form className="client-form" action={updateMonitoredApp}>
      <input type="hidden" name="id" value={app.id} />
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {updated ? <p className="form-success" role="status">Sistema atualizado.</p> : null}
      <section><p className="eyebrow">CLIENTE</p><ClientPicker label="Cliente associado" hint="Vincule o sistema ao cliente para vê-lo no perfil dele. Remova o vínculo para deixá-lo sem cliente." initialClient={app.client} /></section>
      <section><p className="eyebrow">IDENTIFICAÇÃO E ENDPOINTS</p><div className="form-grid"><label>Nome do sistema<input name="name" required maxLength={140} defaultValue={app.name} /></label><label>Ambiente<select name="environment" defaultValue={app.environment}>{monitoringEnvironments.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label>URL principal<input name="url" type="url" maxLength={500} defaultValue={app.url ?? ""} placeholder="https://exemplo.com" /></label><label>Endpoint de saúde<input name="healthEndpoint" type="url" maxLength={500} defaultValue={app.healthEndpoint ?? ""} placeholder="Opcional: https://exemplo.com/api/health" /></label></div></section>
      <div className="form-actions"><Link className="text-link" href="/monitoramento">CANCELAR</Link><button className="primary-action" type="submit">SALVAR SISTEMA</button></div>
    </form>
    {app.lastCheckSummary ? <p className="monitor-last-check"><span>ÚLTIMA VERIFICAÇÃO</span>{app.lastCheckSummary}</p> : null}
    <MonitoringGuide systemName={app.name} siteUrl={app.url} healthUrl={app.healthEndpoint} />
    <section className="service-record-actions"><div><p className="eyebrow">GESTÃO DO REGISTRO</p><p>Ao remover, o sistema deixa de ser monitorado e o histórico de verificações é apagado. O cliente vinculado não é alterado.</p></div><DeleteMonitoredAppButton id={app.id} action={deleteMonitoredApp} /></section>
  </section></div></main>;
}
