import Link from "next/link";
import { Logo } from "@/components/logo";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { logoutAction } from "@/features/auth/services/auth-actions";

export const portalNavigation = [
  { code: "01", href: "/", id: "home", label: "Início" },
  { code: "02", href: "/servicos", id: "services", label: "Serviços" },
  { code: "03", href: "/pagamentos", id: "payments", label: "Pagamentos" },
  { code: "04", href: "/documentos", id: "documents", label: "Documentos" },
  { code: "05", href: "/configuracoes", id: "settings", label: "Configurações" },
] as const;

export type PortalSection = (typeof portalNavigation)[number]["id"];

/** Barra lateral do portal do cliente, no mesmo desenho da gestão. Pagamentos mostra quantas parcelas estão em atraso. */
export function PortalSidebar({ current, clientName, overdueCount }: { current: PortalSection; clientName: string; overdueCount: number }) {
  const initials = clientName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "CL";
  return (
    <aside className="sidebar">
      <Logo />
      <SidebarToggle location="sidebar" />
      <nav aria-label="Navegação da área do cliente">
        {portalNavigation.map((item) => <Link className={`nav-item ${item.id === current ? "active" : ""}`} href={item.href} key={item.id} aria-current={item.id === current ? "page" : undefined}><span className="nav-code">{item.code}</span>{item.label}{item.id === "payments" && overdueCount ? <b className="nav-alert" aria-label={`${overdueCount} em atraso`}>{overdueCount}</b> : null}</Link>)}
      </nav>
      <div className="sidebar-footer"><Link className={`sidebar-profile-link ${current === "settings" ? "active" : ""}`} href="/configuracoes" aria-label={`Abrir a conta de ${clientName}`}><span className="sidebar-profile-mark" aria-hidden="true">{initials}</span><span className="sidebar-profile-copy"><strong>{clientName}</strong><small>ÁREA DO CLIENTE</small></span></Link><form action={logoutAction}><button className="sidebar-logout" type="submit">ENCERRAR SESSÃO</button></form></div>
    </aside>
  );
}
