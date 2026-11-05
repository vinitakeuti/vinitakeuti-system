import Link from "next/link";

export default function NotFound() {
  return <main className="route-state">
    <section className="route-state-surface" aria-labelledby="not-found-title">
      <img src="/assets/images/logo-vr.svg" alt="" aria-hidden="true" />
      <h1 id="not-found-title">Página não encontrada</h1>
      <p>O endereço pode ter mudado ou o registro não existe mais. Volte ao início para continuar.</p>
      <div className="route-state-actions"><Link className="primary-action" href="/">Ir para o início</Link></div>
    </section>
  </main>;
}
