import { LogoMark } from "@/components/logo-mark";
import { site } from "@/content/site";

export function SiteFooter() {
  return <footer className="site-footer">
    <a className="site-brand" href="/"><LogoMark /><span><strong>{site.name}</strong><small>{site.title}</small></span></a>
    <nav aria-label="Rodapé"><a href="/portfolio">Portfólio</a><a href={site.clientAreaUrl}>Área do cliente</a><a href={`mailto:${site.contact.email}`}>{site.contact.email}</a></nav>
    <small>© {new Date().getFullYear()} {site.name}</small>
  </footer>;
}
