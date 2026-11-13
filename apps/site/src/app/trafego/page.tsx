import type { Metadata, Viewport } from "next";
import "@fontsource-variable/bricolage-grotesque/opsz.css";
import "./trafego.css";
import { LogoMark } from "@/components/logo-mark";
import { IconArrowRight, IconArrowUpRight, IconCheck, IconClock, IconCode, IconSpark, IconWhatsApp } from "@/components/trafego/icons";
import { TrafficFaq } from "@/components/trafego/traffic-faq";
import { TrafficQuiz } from "@/components/trafego/traffic-quiz";
import { TrafficResults } from "@/components/trafego/traffic-results";
import { TrafficServices } from "@/components/trafego/traffic-services";
import { site } from "@/content/site";
import { trafego } from "@/content/trafego";

export const metadata: Metadata = {
  title: trafego.seo.title,
  description: trafego.seo.description,
  alternates: { canonical: "/trafego" },
  openGraph: { type: "website", locale: "pt_BR", url: `${site.url}/trafego`, siteName: site.name, title: trafego.seo.title, description: trafego.seo.description },
};

/** Página clara: barra do navegador e controles nativos no tema claro, diferente do resto do site. */
export const viewport: Viewport = { themeColor: "#ffffff", colorScheme: "light" };

/**
 * Página de tráfego: landing própria (cabeçalho e rodapé dela), em fundo claro e verde-oliva.
 * Resultados, serviços, quiz e perguntas são interativos; o resto é estático.
 */
export default function Trafego() {
  const { brand, nav, hero, platforms, marquee, steps, quiz, contact, footer } = trafego;
  const whatsapp = site.contact.whatsapp;
  const whatsappHref = `https://wa.me/${whatsapp}`;
  return <div className="tf-page">
    <header className="tf-header">
      <nav className="tf-header-inner" aria-label="Principal">
        <a className="tf-brand" href="#topo" aria-label={`${brand.name}, início`}>
          <LogoMark className="tf-brand-mark" />
          <span><strong>{brand.name}</strong><small>{brand.tagline}</small></span>
        </a>
        <div className="tf-header-links">{nav.map((item) => <a key={item.href} href={item.href}>{item.label}</a>)}</div>
      </nav>
    </header>
    <div className="tf-header-space" aria-hidden="true" />

    <main>
      <section id="topo" className="tf-hero tf-dots" aria-labelledby="topo-title">
        <div className="tf-wrap tf-hero-grid">
          <div className="tf-hero-copy tf-rise">
            <h1 id="topo-title">{hero.title.map(([text, accent]) => accent ? <span key={text}>{text}</span> : text)}</h1>
            <p>{hero.text}</p>
            <div className="tf-hero-actions">
              <a className="tf-btn tf-btn-primary" href="#contato">{hero.primary}<IconArrowRight /></a>
              <a className="tf-btn tf-btn-outline" href="#resultados">{hero.secondary}</a>
            </div>
            <div className="tf-platforms">
              <span>{hero.platformsLabel}</span>
              <ul>{platforms.map((item) => <li key={item.name}>
                {item.label
                  ? <><img className="tf-platform-icon" src={item.logo} alt="" /><span>{item.label}</span></>
                  : <img src={item.logo} alt={item.name} style={{ height: item.height }} />}
              </li>)}</ul>
            </div>
          </div>
          <div className="tf-included tf-rise">
            <LogoMark className="tf-included-mark" />
            <div>
              <span className="tf-included-label">{hero.includedLabel}</span>
              <ul>{hero.included.map((item) => <li key={item}><IconCheck className="tf-check" /><span>{item}</span></li>)}</ul>
            </div>
          </div>
        </div>
      </section>

      <section className="tf-marquee" aria-label="Destaques">
        <div className="tf-marquee-track">
          {[0, 1].map((copy) => <div key={copy} className="tf-marquee-set" aria-hidden={copy === 1 ? true : undefined}>
            {marquee.map((item) => <span key={item}>{item}<IconSpark /></span>)}
          </div>)}
        </div>
      </section>

      <TrafficResults />

      <TrafficServices />

      <section id="como" className="tf-section tf-steps-section" aria-labelledby="como-title">
        <div className="tf-wrap">
          <div className="tf-heading">
            <span className="tf-label">{steps.label}</span>
            <h2 id="como-title" className="tf-title">{steps.title}</h2>
          </div>
          <ol className="tf-steps">{steps.items.map((item, index) => <li key={item.title}>
            <div><span>{index + 1}</span><strong>{item.title}</strong></div>
            <p>{item.text}</p>
          </li>)}</ol>
        </div>
      </section>

      <section id="indicacao" className="tf-quiz" aria-labelledby="indicacao-title">
        <div className="tf-wrap tf-quiz-grid">
          <div className="tf-quiz-copy">
            <span className="tf-label">{quiz.label}</span>
            <h2 id="indicacao-title" className="tf-title">{quiz.title}</h2>
            <p>{quiz.text}</p>
            <div className="tf-quiz-badges">{quiz.badges.map((badge) => <span key={badge.label}>{badge.icon === "clock" ? <IconClock /> : <IconCheck size={14} width={2.4} />}{badge.label}</span>)}</div>
          </div>
          <TrafficQuiz whatsapp={whatsapp} />
        </div>
      </section>

      <TrafficFaq />

      <section id="contato" className="tf-contact tf-dots" aria-labelledby="contato-title">
        <LogoMark className="tf-contact-mark" />
        <div className="tf-contact-inner">
          <span className="tf-label">{contact.label}</span>
          <h2 id="contato-title">{contact.title}</h2>
          <p>{contact.text}</p>
          <a className="tf-btn tf-btn-primary tf-contact-cta" href={whatsappHref} target="_blank" rel="noopener noreferrer">
            <IconWhatsApp size={24} />{contact.cta}
          </a>
          <small>{contact.phone}</small>
        </div>
      </section>
    </main>

    <footer className="tf-footer">
      <div className="tf-wrap tf-footer-inner">
        <a className="tf-footer-software" href={footer.software.href}>
          <span className="tf-footer-software-copy">
            <span className="tf-footer-software-icon"><IconCode /></span>
            <span><small>{footer.software.kicker}</small><strong>{footer.software.title}</strong></span>
          </span>
          <span className="tf-footer-software-link">{footer.software.domain}<IconArrowUpRight /></span>
        </a>
        <div className="tf-footer-cols">
          <div className="tf-footer-about"><LogoMark className="tf-footer-mark" /><p>{footer.about}</p></div>
          <nav aria-label="Contato">
            <span>{footer.contactLabel}</span>
            <a href={`mailto:${site.contact.email}`}>{site.contact.email}</a>
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer">WhatsApp · {contact.phone}</a>
            <a href={footer.instagram.href} target="_blank" rel="noopener noreferrer">Instagram · {footer.instagram.label}</a>
          </nav>
        </div>
        <div className="tf-footer-bottom"><span>{footer.copyright}</span><span>{footer.cnpj}</span></div>
      </div>
    </footer>
  </div>;
}
