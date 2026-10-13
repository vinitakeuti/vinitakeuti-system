import Link from "next/link";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { ClientPicker } from "@/features/clients/components/client-picker";
import { getClientForMonitoring } from "@/features/monitoring/queries/monitoring-queries";
import { createMonitoredApp } from "@/features/monitoring/services/monitoring-actions";
import { monitoringEnvironments } from "@/features/monitoring/types/monitoring-labels";

export const dynamic = "force-dynamic";

export default async function NewMonitoredAppPage({ searchParams }: { searchParams: Promise<{ cliente?: string; error?: string }> }) {
  const { cliente, error } = await searchParams;
  const client = cliente ? await getClientForMonitoring(cliente.slice(0, 50)) : null;
  const backHref = client ? `/monitoramento?cliente=${client.id}` : "/monitoramento";

  return <main className="app-shell"><AppSidebar current="monitoring" /><div className="workspace"><section className="directory-page form-page">
    <header className="directory-header"><div><p className="eyebrow">MONITORAMENTO / NOVO SISTEMA</p><h1>Adicionar sistema.</h1><p>Informe a URL ou o endpoint de saúde. A verificação é feita sob demanda, pelo botão VERIFICAR na lista.</p></div><div className="header-actions"><SidebarToggle location="header" /><Link className="text-link" href={backHref}>VOLTAR PARA MONITORAMENTO</Link></div></header>
    <form className="client-form" action={createMonitoredApp}>
      {client ? <input type="hidden" name="filterClientId" value={client.id} /> : null}
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <section><p className="eyebrow">IDENTIFICAÇÃO E ENDPOINTS</p><div className="form-grid"><label>Nome do sistema<input name="name" required maxLength={140} autoFocus placeholder="Ex.: Site institucional" /></label><label>Ambiente<select name="environment" defaultValue="production">{monitoringEnvironments.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label>URL principal<input name="url" type="url" maxLength={500} placeholder="https://exemplo.com" /></label><label>Endpoint de saúde<input name="healthEndpoint" type="url" maxLength={500} placeholder="Opcional: https://exemplo.com/api/health" /></label></div></section>
      <section><p className="eyebrow">CLIENTE</p><ClientPicker label="Cliente associado" hint="Opcional. O sistema passa a aparecer no perfil do cliente." initialClient={client} /></section>
      <div className="form-actions"><Link className="text-link" href={backHref}>CANCELAR</Link><button className="primary-action" type="submit">ADICIONAR SISTEMA</button></div>
    </form>
  </section></div></main>;
}
