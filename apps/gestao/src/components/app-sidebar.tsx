import Link from "next/link";
import { Logo } from "@/components/logo";
import { NavIcon } from "@/components/nav-icon";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { logoutAction } from "@/features/auth/services/auth-actions";
import { getProfessionalProfile } from "@/features/professional-profile/queries/professional-profile-queries";

const navigation = [
  { href: "/", id: "overview", icon: "overview", label: "Visão geral" },
  { href: "/assistente", id: "assistant", icon: "assistant", label: "Eliza" },
  { href: "/atendimentos", id: "attendances", icon: "attendances", label: "Atendimentos" },
  { href: "/agenda", id: "agenda", icon: "agenda", label: "Agenda" },
  { href: "/projetos", id: "projects", icon: "projects", label: "Projetos" },
  { href: "/clientes", id: "clients", icon: "clients", label: "Clientes" },
  { href: "/financeiro", id: "finance", icon: "finance", label: "Financeiro" },
  { href: "/documentos", id: "quotes", icon: "documents", label: "Documentos" },
  { href: "/vendas", id: "sales", icon: "sales", label: "Vendas" },
  { href: "/servicos", id: "services", icon: "services", label: "Serviços" },
  { href: "/monitoramento", id: "monitoring", icon: "monitoring", label: "Monitoramento" },
  { href: "/integracoes", id: "integrations", icon: "integrations", label: "Integrações" },
  { href: "/configuracoes", id: "settings", icon: "settings", label: "Configurações" },
] as const;

type AppSidebarProps = { current: (typeof navigation)[number]["id"] | "identity" };

export async function AppSidebar({ current }: AppSidebarProps) {
  const profile = await getProfessionalProfile();
  const name = profile?.name ?? "Vinicius Riudi";
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "VR";

  return (
    <aside className="sidebar">
      <Logo />
      <SidebarToggle location="sidebar" />
      <nav aria-label="Navegação principal">
        {navigation.map((item) => <Link className={`nav-item ${item.id === current ? "active" : ""}`} href={item.href} key={item.id} aria-current={item.id === current ? "page" : undefined} title={item.label}><NavIcon name={item.icon} /><span className="nav-label">{item.label}</span></Link>)}
      </nav>
      <div className="sidebar-footer"><Link className={`sidebar-profile-link ${current === "identity" ? "active" : ""}`} href="/configuracoes/profissional" aria-label={`Abrir perfil de ${name}`} aria-current={current === "identity" ? "page" : undefined}><span className="sidebar-profile-mark" aria-hidden="true">{initials}</span><span className="sidebar-profile-copy"><strong>{name}</strong><small>Meu perfil</small></span></Link><form action={logoutAction}><button className="sidebar-logout" type="submit">Encerrar sessão</button></form></div>
    </aside>
  );
}
