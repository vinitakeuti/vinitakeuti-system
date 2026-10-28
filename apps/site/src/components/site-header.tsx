import { Arrow } from "@/components/arrow";
import { LogoMark } from "@/components/logo-mark";
import { MobileMenu } from "@/components/mobile-menu";
import { site } from "@/content/site";

/** Cabeçalho fixo: transparente no topo, ganha fundo ao rolar. Marca, navegação por âncoras, área do cliente e o convite para conversar. */
export function SiteHeader() {
  return <header className="site-header">
    <div className="site-header-inner">
      <a className="site-brand" href="#inicio" aria-label={`${site.name}, início`}><LogoMark /><span><strong>{site.name}</strong><small>{site.title}</small></span></a>
      <nav className="site-nav" aria-label="Seções">{site.nav.map((item) => <a key={item.href} href={item.href}>{item.label}</a>)}</nav>
      <div className="site-header-actions"><a href={site.clientAreaUrl}>Entrar</a><a className="site-button" href="#contato">Iniciar projeto<Arrow /></a></div>
      <MobileMenu>{site.nav.map((item) => <a key={item.href} href={item.href}>{item.label}</a>)}<a href={site.clientAreaUrl}>Entrar na área do cliente</a><a className="site-button is-large" href="#contato">Iniciar projeto<Arrow /></a></MobileMenu>
    </div>
  </header>;
}
