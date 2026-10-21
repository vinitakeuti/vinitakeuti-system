import Link from "next/link";
import { AppSidebar } from "@/components/app-sidebar";
import { CopyTextButton } from "@/components/copy-text-button";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { getMonitoredApp } from "@/features/monitoring/queries/monitoring-queries";
import { monitoringIntegrationGuide } from "@/features/monitoring/services/integration-guide";

export const dynamic = "force-dynamic";

/** Guia para outra IA implementar o endpoint de saúde; com ?sistema=, vem preenchido com o nome e o endereço dele. */
export default async function MonitoringGuidePage({ searchParams }: { searchParams: Promise<{ sistema?: string }> }) {
  const { sistema } = await searchParams;
  const app = sistema ? await getMonitoredApp(sistema.slice(0, 50)) : null;
  const text = monitoringIntegrationGuide({ systemName: app?.name, siteUrl: app?.url, healthUrl: app?.healthEndpoint });
  const backHref = app ? `/monitoramento/${app.id}` : "/monitoramento";

  return <main className="app-shell"><AppSidebar current="monitoring" /><div className="workspace"><section className="directory-page">
    <header className="directory-header"><div><p className="eyebrow">MONITORAMENTO / GUIA DO ENDPOINT</p><h1>Guia do endpoint de saúde.</h1><p>Copie e cole na IA que desenvolve {app ? `o sistema ${app.name}` : "o sistema do cliente"}. O texto explica o formato que este monitoramento entende, a lógica das verificações, a segurança e como testar.</p></div><div className="header-actions"><SidebarToggle location="header" /><Link className="text-link" href={backHref}>VOLTAR</Link><CopyTextButton text={text} label="COPIAR GUIA" className="primary-action" /></div></header>
    <pre className="monitoring-guide-text">{text}</pre>
  </section></div></main>;
}
