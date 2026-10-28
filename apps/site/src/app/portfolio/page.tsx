import type { Metadata } from "next";
import { Arrow } from "@/components/arrow";
import { PortfolioGallery } from "@/components/portfolio-gallery";
import { PortfolioSpotlight } from "@/components/portfolio-spotlight";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { portfolio } from "@/content/portfolio";
import { site } from "@/content/site";

export const metadata: Metadata = {
  title: portfolio.seo.title,
  description: portfolio.seo.description,
  alternates: { canonical: "/portfolio" },
  openGraph: { type: "profile", locale: "pt_BR", url: `${site.url}/portfolio`, siteName: site.name, title: portfolio.seo.title, description: portfolio.seo.description },
};

export default function Portfolio() {
  const { hero, story, closing } = portfolio;
  return <>
    <SiteHeader current="/portfolio" />
    <main id="inicio" className="pf-page">
      <section className="pf-hero" aria-label="Apresentação">
        <p className="site-tag">{hero.eyebrow}</p>
        <PortfolioSpotlight name={hero.name} />
        <div className="pf-hero-foot">
          <p>{hero.text}</p>
          <a className="pf-scroll" href="#historia"><span>A HISTÓRIA</span><i aria-hidden="true" /></a>
        </div>
      </section>

      <section className="pf-story" id="historia" aria-labelledby="historia-title">
        <h2 className="site-tag" id="historia-title">A HISTÓRIA</h2>
        <div>{story.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
      </section>

      <PortfolioGallery projects={portfolio.projects} />

      <section className="pf-closing" aria-labelledby="fechamento-title">
        <h2 id="fechamento-title">{closing.title}</h2>
        <p>{closing.text}</p>
        <nav aria-label="Próximos passos">
          <a href="/#servicos">Conhecer os serviços<Arrow /></a>
          <a href={`mailto:${site.contact.email}`}>{site.contact.email}<Arrow /></a>
          <a href={site.clientAreaUrl}>Área do cliente<Arrow /></a>
        </nav>
      </section>
    </main>
    <SiteFooter />
  </>;
}
