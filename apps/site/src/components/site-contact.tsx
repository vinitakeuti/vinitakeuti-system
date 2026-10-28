import { Arrow } from "@/components/arrow";
import { CopyEmail } from "@/components/copy-email";
import { LogoOutline } from "@/components/logo-mark";
import { site } from "@/content/site";

/** Links de contato com mensagem pronta (WhatsApp vazio esconde o botão). */
export function contactLinks() {
  const { email, whatsapp } = site.contact;
  return { mail: `mailto:${email}?subject=${encodeURIComponent("Quero conversar sobre um projeto")}`, whatsapp: whatsapp ? `https://wa.me/${whatsapp}?text=${encodeURIComponent("Olá, Vinicius! Quero conversar sobre um projeto.")}` : null };
}

/** Convite final para conversar, usado na home e no portfólio. */
export function SiteContact({ title = site.cta.title, text = site.cta.text }: { title?: string; text?: string }) {
  const links = contactLinks();
  return <section className="site-section" aria-labelledby="contato-title">
    <div className="site-cta reveal" id="contato">
      <LogoOutline className="site-cta-mark" />
      <div className="site-cta-copy"><p className="site-tag">CONTATO</p><h2 id="contato-title">{title}</h2><p>{text}</p></div>
      <div className="site-cta-actions">
        {links.whatsapp ? <a className="site-button is-large" href={links.whatsapp} target="_blank" rel="noreferrer">Chamar no WhatsApp<Arrow /></a> : null}
        <a className={links.whatsapp ? "site-button is-large is-ghost" : "site-button is-large"} href={links.mail}>Enviar e-mail<Arrow /></a>
        <CopyEmail email={site.contact.email} />
        <small>{site.contact.email}</small>
      </div>
    </div>
  </section>;
}
