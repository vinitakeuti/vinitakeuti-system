"use client";

import Link from "next/link";

/** Erro inesperado ao montar uma página: explica, oferece tentar de novo e mostra o código para suporte. */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="route-state">
    <section className="route-state-surface" aria-labelledby="route-error-title" role="alert">
      <img src="/assets/images/logo-vr.svg" alt="" aria-hidden="true" />
      <h1 id="route-error-title">Não foi possível carregar esta página</h1>
      <p>Algo falhou ao buscar as informações. Tente novamente; se o problema continuar, volte ao início e repita a ação em alguns minutos.</p>
      {error.digest ? <code>Código do erro: {error.digest}</code> : null}
      <div className="route-state-actions"><button className="primary-action" type="button" onClick={reset}>Tentar novamente</button><Link className="secondary-action" href="/">Ir para o início</Link></div>
    </section>
  </main>;
}
