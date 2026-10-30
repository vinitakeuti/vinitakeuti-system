import { Arrow } from "@/components/arrow";
import { LogoMark } from "@/components/logo-mark";
import { MobileMenu } from "@/components/mobile-menu";
import { site } from "@/content/site";

/**
 * Cabeçalho fixo: transparente no topo, ganha fundo ao rolar. Marca, navegação, área do cliente e o convite para conversar.
 * Fora da home (current = "/portfolio"), as âncoras das seções apontam para a home.
 * `minimal` (portfólio): só o botão do menu no canto, abrindo a navegação numa barra lateral que começa com o link de volta para a home.
 */
export function SiteHeader({ current = "/", minimal = false }: { current?: string; minimal?: boolean }) {
  const home = current === "/";
  const href = (target: string) => target.startsWith("#") && !home ? `/${target}` : target;
  const links = site.nav.map((item) => <a key={item.href} href={href(item.href)} aria-current={item.href === current ? "page" : undefined}>{item.label}</a>);
  const back = minimal ? <a className="site-menu-home" href="/"><Arrow />Voltar para a página inicial</a> : null;
  const menu = <MobileMenu>{back}{links}<a href={site.clientAreaUrl}>Entrar na área do cliente</a><a className="site-button is-large" href={href("#contato")}>Iniciar projeto<Arrow /></a></MobileMenu>;
  if (minimal) return <header className="site-header is-minimal"><div className="site-header-inner">{menu}</div></header>;
  return <header className="site-header">
    <div className="site-header-inner">
      <a className="site-brand" href={home ? "#inicio" : "/"} aria-label={`${site.name}, início`}><LogoMark /><span><strong>{site.name}</strong><small>{site.title}</small></span></a>
      <nav className="site-nav" aria-label="Seções">{links}</nav>
      <div className="site-header-actions"><a href={site.clientAreaUrl}>Entrar</a><a className="site-button" href={href("#contato")}>Iniciar projeto<Arrow /></a></div>
      {menu}
    </div>
  </header>;
}
