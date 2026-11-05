import Link from "next/link";
import { Logo } from "@/components/logo";
import { NavIcon } from "@/components/nav-icon";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { logoutAction } from "@/features/auth/services/auth-actions";

export const portalNavigation = [
  { href: "/", id: "home", icon: "home", label: "Início" },
  { href: "/servicos", id: "services", icon: "services", label: "Serviços" },
  { href: "/pagamentos", id: "payments", icon: "payments", label: "Pagamentos" },
  { href: "/documentos", id: "documents", icon: "documents", label: "Documentos" },
  { href: "/configuracoes", id: "settings", icon: "settings", label: "Configurações" },
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
        {portalNavigation.map((item) => <Link className={`nav-item ${item.id === current ? "active" : ""}`} href={item.href} key={item.id} aria-current={item.id === current ? "page" : undefined} title={item.label}><NavIcon name={item.icon} /><span className="nav-label">{item.label}</span>{item.id === "payments" && overdueCount ? <b className="nav-alert" aria-label={`${overdueCount} em atraso`}>{overdueCount}</b> : null}</Link>)}
      </nav>
      <div className="sidebar-footer"><Link className={`sidebar-profile-link ${current === "settings" ? "active" : ""}`} href="/configuracoes" aria-label={`Abrir a conta de ${clientName}`}><span className="sidebar-profile-mark" aria-hidden="true">{initials}</span><span className="sidebar-profile-copy"><strong>{clientName}</strong><small>Área do cliente</small></span></Link><form action={logoutAction}><button className="sidebar-logout" type="submit">Encerrar sessão</button></form></div>
    </aside>
  );
}
