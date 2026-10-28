import { Arrow } from "@/components/arrow";
import { LogoMark } from "@/components/logo-mark";
import { MobileMenu } from "@/components/mobile-menu";
import { site } from "@/content/site";

/**
 * Cabeçalho fixo: transparente no topo, ganha fundo ao rolar. Marca, navegação, área do cliente e o convite para conversar.
 * Fora da home (current = "/portfolio"), as âncoras das seções apontam para a home.
 */
export function SiteHeader({ current = "/" }: { current?: string }) {
  const home = current === "/";
  const href = (target: string) => target.startsWith("#") && !home ? `/${target}` : target;
  const links = site.nav.map((item) => <a key={item.href} href={href(item.href)} aria-current={item.href === current ? "page" : undefined}>{item.label}</a>);
  return <header className="site-header">
    <div className="site-header-inner">
      <a className="site-brand" href={home ? "#inicio" : "/"} aria-label={`${site.name}, início`}><LogoMark /><span><strong>{site.name}</strong><small>{site.title}</small></span></a>
      <nav className="site-nav" aria-label="Seções">{links}</nav>
      <div className="site-header-actions"><a href={site.clientAreaUrl}>Entrar</a><a className="site-button" href="#contato">Iniciar projeto<Arrow /></a></div>
      <MobileMenu>{links}<a href={site.clientAreaUrl}>Entrar na área do cliente</a><a className="site-button is-large" href="#contato">Iniciar projeto<Arrow /></a></MobileMenu>
    </div>
  </header>;
}
