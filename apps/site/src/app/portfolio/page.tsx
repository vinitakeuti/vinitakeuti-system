import type { Metadata } from "next";
import { Arrow } from "@/components/arrow";
import { PortfolioGallery } from "@/components/portfolio-gallery";
import { PortfolioHero } from "@/components/portfolio-hero";
import { PortfolioSkills } from "@/components/portfolio-skills";
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
  const { hero, story, skills, closing } = portfolio;
  return <>
    <SiteHeader current="/portfolio" minimal />
    <main id="inicio" className="pf-page">
      <PortfolioHero eyebrow={hero.eyebrow} name={hero.name} />

      <section className="pf-story" id="trajetoria" aria-labelledby="trajetoria-title">
        <h2 className="site-tag" id="trajetoria-title">TRAJETÓRIA</h2>
        <div>{story.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
      </section>

      <PortfolioSkills skills={skills} />

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
