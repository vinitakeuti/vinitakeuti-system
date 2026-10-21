import { SiteHeader } from "@/components/site-header";
import { site } from "@/content/site";

const pad = (index: number) => String(index + 1).padStart(2, "0");

function contactLinks() {
  const { email, whatsapp } = site.contact;
  return { mail: `mailto:${email}?subject=${encodeURIComponent("Quero conversar sobre um projeto")}`, whatsapp: whatsapp ? `https://wa.me/${whatsapp}?text=${encodeURIComponent("Olá, Vinicius! Quero conversar sobre um projeto.")}` : null };
}

export default function Home() {
  const links = contactLinks();
  const { hero, clientArea } = site;
  return <>
    <SiteHeader />
    <main id="inicio">
      <section className="site-hero">
        <div className="site-hero-copy">
          <p className="site-eyebrow">{hero.eyebrow}</p>
          <h1>{hero.title}</h1>
          <p>{hero.text}</p>
          <div className="site-hero-actions"><a className="site-button is-large" href="#contato">{hero.primary}</a><a className="site-link" href="#processo">{hero.secondary}</a></div>
        </div>
        <figure className="site-journey" aria-label="Exemplo da jornada do projeto na área do cliente">
          <figcaption><span>SEU PROJETO</span><b>Plataforma do cliente</b><small>2 de 4 etapas concluídas</small></figcaption>
          <ol>{clientArea.journey.map((step, index) => <li key={step.label} className={`is-${step.state}`}><span>{index + 1}</span><b>{step.label}</b><small>{step.detail}</small></li>)}</ol>
          <p>Assim o cliente acompanha o projeto na área do cliente.</p>
        </figure>
      </section>

      <section className="site-highlights" aria-label="Diferenciais">{site.highlights.map((item) => <div key={item.label}><span>{item.label}</span><p>{item.text}</p></div>)}</section>

      <section className="site-section" id="servicos" aria-labelledby="servicos-title">
        <div className="site-section-heading"><p className="site-eyebrow">SERVIÇOS</p><h2 id="servicos-title">O que eu faço.</h2><p>Projetos digitais pensados para resolver um problema real do negócio, não só para existir.</p></div>
        <div className="site-services">{site.services.map((service, index) => <article key={service.title}><span>{pad(index)}</span><h3>{service.title}</h3><p>{service.text}</p></article>)}</div>
      </section>

      <section className="site-section" id="processo" aria-labelledby="processo-title">
        <div className="site-section-heading"><p className="site-eyebrow">COMO TRABALHO</p><h2 id="processo-title">Do primeiro contato à entrega, sem surpresas.</h2><p>Cada etapa é combinada antes e fica registrada. Você sabe o que está sendo feito e o que vem depois.</p></div>
        <ol className="site-process">{site.process.map((step, index) => <li key={step.title}><span>{pad(index)}</span><h3>{step.title}</h3><p>{step.text}</p></li>)}</ol>
      </section>

      <section className="site-section site-client-area" id="area-do-cliente" aria-labelledby="area-title">
        <div className="site-section-heading"><p className="site-eyebrow">{clientArea.eyebrow}</p><h2 id="area-title">{clientArea.title}</h2><p>{clientArea.text}</p><a className="site-link" href={site.clientAreaUrl}>ACESSAR A ÁREA DO CLIENTE</a></div>
        <ul className="site-features">{clientArea.features.map((feature, index) => <li key={feature.title}><span>{pad(index)}</span><div><h3>{feature.title}</h3><p>{feature.text}</p></div></li>)}</ul>
      </section>

      <section className="site-section" id="perguntas" aria-labelledby="perguntas-title">
        <div className="site-section-heading"><p className="site-eyebrow">PERGUNTAS</p><h2 id="perguntas-title">Antes de começar.</h2></div>
        <div className="site-faq">{site.faq.map((item) => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div>
      </section>

      <section className="site-cta" id="contato" aria-labelledby="contato-title">
        <div><p className="site-eyebrow">CONTATO</p><h2 id="contato-title">{site.cta.title}</h2><p>{site.cta.text}</p></div>
        <div className="site-cta-actions">
          {links.whatsapp ? <a className="site-button is-large" href={links.whatsapp} target="_blank" rel="noreferrer">CHAMAR NO WHATSAPP</a> : null}
          <a className={links.whatsapp ? "site-button is-large is-outline" : "site-button is-large"} href={links.mail}>ENVIAR E-MAIL</a>
          <small>{site.contact.email}</small>
        </div>
      </section>
    </main>
    <footer className="site-footer">
      <div className="site-brand"><img src="/logo-vr.svg" alt="" aria-hidden="true" /><span><strong>{site.name}</strong><small>{site.title}</small></span></div>
      <nav aria-label="Rodapé"><a href={site.clientAreaUrl}>ÁREA DO CLIENTE</a><a href={`mailto:${site.contact.email}`}>{site.contact.email.toUpperCase()}</a></nav>
      <small>© {new Date().getFullYear()} {site.name.toUpperCase()}</small>
    </footer>
  </>;
}
