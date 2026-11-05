import Link from "next/link";
import { SidebarToggle } from "@/components/sidebar-toggle";

/** Cabeçalho das páginas de cada integração: caminho, título, situação e as abas da integração. */
export function IntegrationHeader({ title, description, badge, tabs, current, basePath }: {
  crumb: string;
  title: string;
  description: string;
  badge?: { label: string; tone: "is-ok" | "is-warning" };
  tabs: ReadonlyArray<{ id: string; label: string }>;
  current: string;
  basePath: string;
}) {
  return <>
    <header className="directory-header">
      <div><p className="eyebrow page-crumb"><Link href="/integracoes">Integrações</Link></p><h1>{title}</h1><p>{description}</p></div>
      <div className="header-actions">{badge ? <span className={`settings-badge ${badge.tone}`}>{badge.label}</span> : null}<SidebarToggle location="header" /></div>
    </header>
    <nav className="client-tabs settings-tabs" aria-label={`Seções de ${title.replace(/\.$/, "")}`}>
      {tabs.map((tab, index) => <Link key={tab.id} href={index === 0 ? basePath : `${basePath}?aba=${tab.id}`} className={current === tab.id ? "active" : undefined} aria-current={current === tab.id ? "page" : undefined}>{tab.label}</Link>)}
    </nav>
  </>;
}
