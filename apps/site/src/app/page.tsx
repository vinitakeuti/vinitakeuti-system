import { Arrow } from "@/components/arrow";
import { CopyEmail } from "@/components/copy-email";
import { HeroDiagnosis, type HeroNeed } from "@/components/hero-diagnosis";
import { HeroGraphic } from "@/components/hero-graphic";
import { LogoMark, LogoOutline } from "@/components/logo-mark";
import { ServicesExplorer, type ExplorerCategory } from "@/components/services-explorer";
import { SiteHeader } from "@/components/site-header";
import { site } from "@/content/site";

const pad = (index: number) => String(index + 1).padStart(2, "0");

function contactLinks() {
  const { email, whatsapp } = site.contact;
  return { mail: `mailto:${email}?subject=${encodeURIComponent("Quero conversar sobre um projeto")}`, whatsapp: whatsapp ? `https://wa.me/${whatsapp}?text=${encodeURIComponent("Olá, Vinicius! Quero conversar sobre um projeto.")}` : null };
}

/** Categorias prontas para a tela, com o link para pedir cada serviço já com o assunto preenchido. */
function explorerCategories(): ExplorerCategory[] {
  const { email, whatsapp } = site.contact;
  return site.serviceCategories.map((category) => ({
    ...category,
    services: category.services.map((service) => {
      const message = `Olá, Vinicius! Tenho interesse no serviço ${service.title}.`;
      const href = whatsapp ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}` : `mailto:${email}?subject=${encodeURIComponent(`Serviço: ${service.title}`)}&body=${encodeURIComponent(message)}`;
      return { ...service, href };
    }),
  }));
}

/** Necessidades do diagnóstico da abertura, com os serviços do catálogo e o link para conversar sobre aquela necessidade. */
function heroNeeds(): HeroNeed[] {
  const { email, whatsapp } = site.contact;
  const catalog = site.serviceCategories.flatMap((category) => category.services.map((service) => ({ id: service.id as string, title: service.title as string, category: category.short as string })));
  return site.diagnosis.needs.map((need) => {
    const message = `Olá, Vinicius! Preciso de ajuda para: ${need.label.toLowerCase()}.`;
    const href = whatsapp ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}` : `mailto:${email}?subject=${encodeURIComponent(need.label)}&body=${encodeURIComponent(message)}`;
    return { id: need.id, label: need.label, diagnosis: need.diagnosis, services: need.services.flatMap((id) => catalog.filter((service) => service.id === id)), href };
  });
}

export default function Home() {
  const links = contactLinks();
  const { hero, clientArea } = site;
  return <>
    <SiteHeader />
    <main id="inicio">
      <section className="site-hero">
        <HeroGraphic />
        <div className="site-hero-copy">
          <p className="site-tag">{hero.eyebrow}</p>
          <h1>{hero.title}</h1>
          <p>{hero.text}</p>
          <div className="site-hero-actions"><a className="site-button is-large" href="#contato">{hero.primary}<Arrow /></a><a className="site-button is-large is-ghost" href="#processo">{hero.secondary}</a></div>
        </div>
        <HeroDiagnosis question={site.diagnosis.question} needs={heroNeeds()} host={new URL(site.url).host} />
      </section>

      <section className="site-segments" aria-labelledby="segmentos-title">
        <p className="site-segments-label" id="segmentos-title">{site.segments.label}</p>
        <div className="site-segments-track">
          {[0, 1].map((copy) => <ul key={copy} aria-hidden={copy === 1 ? true : undefined}>{site.segments.items.map((item) => <li key={item}>{item}</li>)}</ul>)}
        </div>
      </section>

      <section className="site-band" id="servicos" aria-labelledby="servicos-title">
        <div className="site-band-inner">
        <div className="site-heading is-center reveal"><p className="site-tag">SERVIÇOS</p><h2 id="servicos-title">Servicos Disponíveis.</h2><p>Software sob medida, tráfego pago e ferramentas prontas. Escolha uma área e veja na prática como cada serviço funciona.</p></div>
        <div className="reveal"><ServicesExplorer categories={explorerCategories()} /></div>
        </div>
      </section>

      <section className="site-section" id="processo" aria-labelledby="processo-title">
        <div className="site-heading is-center reveal"><p className="site-tag">COMO FUNCIONA</p><h2 id="processo-title">Do primeiro contato à entrega, sem surpresas.</h2><p>Cada etapa é combinada antes e fica registrada. Você sabe o que está sendo feito e o que vem depois.</p></div>
        <ol className="site-process">{site.process.map((step, index) => <li key={step.title} className="reveal"><span>{pad(index)}</span><h3>{step.title}</h3><p>{step.text}</p></li>)}</ol>
      </section>

      <section className="site-section site-client" id="area-do-cliente" aria-labelledby="area-title">
        <div className="site-heading reveal"><p className="site-tag">{clientArea.eyebrow}</p><h2 id="area-title">{clientArea.title}</h2><p>{clientArea.text}</p><a className="site-button is-ghost" href={site.clientAreaUrl}>Acessar a área do cliente<Arrow /></a></div>
        <ul className="site-features">{clientArea.features.map((feature) => <li key={feature.title} className="reveal"><div><h3>{feature.title}</h3><p>{feature.text}</p></div></li>)}</ul>
      </section>

      <section className="site-section" id="perguntas" aria-labelledby="perguntas-title">
        <div className="site-faq-layout">
          <div className="site-heading reveal"><p className="site-tag">PERGUNTAS FREQUENTES</p><h2 id="perguntas-title">Dúvidas comuns antes de começar.</h2><p>Se a sua não estiver aqui, é só perguntar. A resposta vem de quem vai fazer o projeto.</p><a className="site-button is-ghost" href={links.mail}>Fazer uma pergunta<Arrow /></a></div>
          <div className="site-faq">{site.faq.map((item, index) => <details key={item.question} className="reveal" open={index === 0}><summary><span>{pad(index)}</span>{item.question}<i aria-hidden="true" /></summary><p>{item.answer}</p></details>)}</div>
        </div>
      </section>

      <section className="site-section" aria-labelledby="contato-title">
        <div className="site-cta reveal" id="contato">
          <LogoOutline className="site-cta-mark" />
          <div className="site-cta-copy"><p className="site-tag">CONTATO</p><h2 id="contato-title">{site.cta.title}</h2><p>{site.cta.text}</p></div>
          <div className="site-cta-actions">
            {links.whatsapp ? <a className="site-button is-large" href={links.whatsapp} target="_blank" rel="noreferrer">Chamar no WhatsApp<Arrow /></a> : null}
            <a className={links.whatsapp ? "site-button is-large is-ghost" : "site-button is-large"} href={links.mail}>Enviar e-mail<Arrow /></a>
            <CopyEmail email={site.contact.email} />
            <small>{site.contact.email}</small>
          </div>
        </div>
      </section>
    </main>
    <footer className="site-footer">
      <div className="site-brand"><LogoMark /><span><strong>{site.name}</strong><small>{site.title}</small></span></div>
      <nav aria-label="Rodapé"><a href={site.clientAreaUrl}>Área do cliente</a><a href={`mailto:${site.contact.email}`}>{site.contact.email}</a></nav>
      <small>© {new Date().getFullYear()} {site.name}</small>
    </footer>
  </>;
}
