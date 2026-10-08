import Link from "next/link";
import { Logo } from "@/components/logo";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { getProfessionalProfile } from "@/features/professional-profile/queries/professional-profile-queries";

const navigation = [
  { code: "01", href: "/", id: "overview", label: "Visão geral" },
  { code: "02", href: "/clientes", id: "clients", label: "Clientes" },
  { code: "03", href: "/#financeiro", id: "finance", label: "Financeiro" },
  { code: "04", href: "/orcamentos", id: "quotes", label: "Orçamentos" },
  { code: "05", href: "/vendas", id: "sales", label: "Vendas" },
  { code: "06", href: "/servicos", id: "services", label: "Serviços" },
  { code: "07", href: "/#monitoramento", id: "monitoring", label: "Monitoramento" },
  { code: "08", href: "/#sistemas", id: "systems", label: "Sistemas" },
  { code: "09", href: "/#integracoes", id: "integrations", label: "Integrações" },
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
        {navigation.map((item) => <Link className={`nav-item ${item.id === current ? "active" : ""}`} href={item.href} key={item.id}><span className="nav-code">{item.code}</span>{item.label}</Link>)}
      </nav>
      <div className="sidebar-footer"><Link className={`sidebar-profile-link ${current === "identity" ? "active" : ""}`} href="/configuracoes/profissional" aria-label={`Abrir perfil de ${name}`} aria-current={current === "identity" ? "page" : undefined}><span className="sidebar-profile-mark" aria-hidden="true">{initials}</span><span className="sidebar-profile-copy"><strong>{name}</strong><small>MEU PERFIL</small></span></Link></div>
    </aside>
  );
}
