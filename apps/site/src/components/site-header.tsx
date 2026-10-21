import { site } from "@/content/site";

/** Cabeçalho fixo: marca, navegação por âncoras, área do cliente e o convite para conversar. No celular, um menu sem JavaScript. */
export function SiteHeader() {
  return <header className="site-header">
    <a className="site-brand" href="#inicio" aria-label={`${site.name}, início`}><img src="/logo-vr.svg" alt="" aria-hidden="true" /><span><strong>{site.name}</strong><small>{site.title}</small></span></a>
    <nav className="site-nav" aria-label="Seções">{site.nav.map((item) => <a key={item.href} href={item.href}>{item.label}</a>)}</nav>
    <div className="site-header-actions"><a className="site-link" href={site.clientAreaUrl}>ÁREA DO CLIENTE</a><a className="site-button" href="#contato">INICIAR PROJETO</a></div>
    <details className="site-menu">
      <summary aria-label="Abrir menu"><i /><i /></summary>
      <nav aria-label="Menu">{site.nav.map((item) => <a key={item.href} href={item.href}>{item.label}</a>)}<a href={site.clientAreaUrl}>Área do cliente</a><a className="site-button" href="#contato">INICIAR PROJETO</a></nav>
    </details>
  </header>;
}
