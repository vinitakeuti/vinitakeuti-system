function portalUrl(host: string) {
  return `https://${host}/entrar`;
}

export function LandingPage() {
  const managementHost = process.env.MANAGEMENT_HOST?.trim() || "gestao.viniciusriudi.com";
  const clientHost = process.env.CLIENT_PORTAL_HOST?.trim() || "clientes.viniciusriudi.com";

  return <main className="landing-shell">
    <header className="landing-header"><div className="landing-brand"><img src="/assets/images/logo-vr.svg" alt="Vinicius Riudi" /><span className="landing-brand-copy"><strong>Vinicius Riudi</strong><small>Desenvolvedor de Software</small></span></div><p>Estratégia, tecnologia e operação</p></header>
    <section className="landing-hero"><p className="eyebrow">Vinitakeuti / Digital</p><h1>Estruturas digitais<br />que sustentam crescimento.</h1><p>Desenvolvimento, estratégia e operação para negócios que precisam transformar presença digital em resultado.</p></section>
    <footer className="landing-footer"><span>© {new Date().getFullYear()} Vinicius Riudi</span><nav aria-label="Acessos"><a href={portalUrl(managementHost)}>Área de gestão</a><a href={portalUrl(clientHost)}>Área do cliente</a></nav></footer>
  </main>;
}
