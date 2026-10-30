"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ClientPicker, type ClientPickerOption } from "@/features/clients/components/client-picker";

type KindOption = { slug: string; shortName: string; description: string; isProposal: boolean; clientOptional?: boolean };
type QuoteOption = { id: string; code: string; title: string };

const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Maceio" });

/**
 * Painel de produção do documento escolhido no seletor: cliente e, para contrato, cessão e memorial, a proposta de
 * referência e o título. A proposta comercial segue para o fluxo de orçamento com o cliente já escolhido. O documento
 * livre pede só o título; o cliente é opcional e serve para guardá-lo no perfil do cliente.
 */
export function DocumentProducer({ kind, initialClient, createAction }: { kind: KindOption; initialClient: ClientPickerOption | null; createAction: (formData: FormData) => Promise<void> }) {
  const [client, setClient] = useState<ClientPickerOption | null>(initialClient);
  const [quotes, setQuotes] = useState<Array<QuoteOption & { createdAt: string }>>([]);
  const [quoteId, setQuoteId] = useState("");
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setQuotes([]);
    setQuoteId("");
    if (!client || kind.isProposal || kind.clientOptional) return;
    const controller = new AbortController();
    setLoadingQuotes(true);
    fetch(`/api/clientes/${client.id}/propostas`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : { data: [] })
      .then((payload: { data: Array<QuoteOption & { createdAt: string }> }) => { setQuotes(payload.data); setQuoteId(payload.data[0]?.id ?? ""); })
      .catch(() => undefined)
      .finally(() => { if (!controller.signal.aborted) setLoadingQuotes(false); });
    return () => controller.abort();
  }, [client, kind.isProposal, kind.clientOptional]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (client || kind.clientOptional) return;
    event.preventDefault();
    setError("Escolha o cliente do documento.");
  }

  const selectedQuote = quotes.find((quote) => quote.id === quoteId);
  return <form className={`document-producer${kind.isProposal ? " is-proposal" : kind.clientOptional ? " is-free" : ""}`} action={kind.isProposal ? "/orcamentos/novo" : createAction} onSubmit={handleSubmit}>
    {kind.isProposal ? null : <input type="hidden" name="tipo" value={kind.slug} />}
    <ClientPicker label={kind.clientOptional ? "Cliente (opcional)" : "Cliente"} initialClient={initialClient} removeLabel="TROCAR" placeholder="Buscar cliente por nome, empresa ou e-mail" className="document-producer-client" onChange={(next) => { setClient(next); setError(null); }} />
    {kind.isProposal ? null : <>
      {kind.clientOptional ? null : <label className="document-producer-field">
        <span>Proposta de referência</span>
        <select name="quoteId" value={quoteId} disabled={!client || loadingQuotes} onChange={(event) => setQuoteId(event.target.value)}>
          <option value="">{!client ? "Escolha o cliente primeiro" : loadingQuotes ? "Carregando propostas..." : quotes.length ? "Nenhuma" : "Cliente sem propostas"}</option>
          {quotes.map((quote) => <option key={quote.id} value={quote.id}>{quote.title} · {date.format(new Date(quote.createdAt))}</option>)}
        </select>
      </label>}
      <label className="document-producer-field">
        <span>Título do documento</span>
        <input name="title" maxLength={180} required={kind.clientOptional || (Boolean(client) && !selectedQuote)} placeholder={kind.clientOptional ? "Título que vai na capa" : selectedQuote?.title ?? "Nome do projeto ou da entrega"} />
      </label>
    </>}
    <button className="primary-action document-producer-submit" type="submit">{kind.isProposal ? "CRIAR PROPOSTA" : `PRODUZIR ${kind.shortName.toUpperCase()}`}</button>
    {error ? <p className="form-error document-producer-error" role="alert">{error}</p> : null}
  </form>;
}
