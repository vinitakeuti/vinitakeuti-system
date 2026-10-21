import Link from "next/link";
import { SidebarToggle } from "@/components/sidebar-toggle";
import type { PortalContext } from "@/features/client-portal/queries/portal-queries";
import { PortalSidebar, type PortalSection } from "@/features/client-portal/components/portal-sidebar";
import { day, money } from "@/features/client-portal/components/portal-format";

type PortalShellProps = { context: PortalContext; current: PortalSection; section: string; title: string; description?: string; children: React.ReactNode };

/** Moldura das páginas do portal: barra lateral, cabeçalho e, havendo parcelas vencidas, o alerta de atraso. */
export function PortalShell({ context, current, section, title, description, children }: PortalShellProps) {
  const name = context.client?.name ?? context.user.name;
  const { overdue } = context.receivables;
  return <main className="app-shell"><PortalSidebar current={current} clientName={name} overdueCount={overdue.count} /><div className="workspace"><section className="directory-page portal-page">
    <header className="directory-header"><div><p className="eyebrow">ÁREA DO CLIENTE / {section}</p><h1>{title}</h1>{description ? <p>{description}</p> : null}</div><div className="header-actions"><SidebarToggle location="header" /></div></header>
    {/* Em Início e Pagamentos, o card do pagamento em questão já mostra o atraso. */}
    {overdue.count && current !== "home" && current !== "payments" ? <div className="portal-alert" role="alert"><span className="portal-alert-mark" aria-hidden="true" /><div><b>{overdue.count === 1 ? "Você tem 1 pagamento em atraso." : `Você tem ${overdue.count} pagamentos em atraso.`}</b><p>{money(overdue.amountCents)} em aberto{overdue.oldest ? `, o mais antigo venceu em ${day(overdue.oldest)}` : ""}. Regularize para manter seus serviços em dia.</p></div><Link className="primary-action" href="/pagamentos">VER PAGAMENTOS</Link></div> : null}
    {children}
  </section></div></main>;
}
