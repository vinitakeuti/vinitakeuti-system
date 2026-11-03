"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { searchCounterpartyClientsAction, type CounterpartyClient } from "@/features/finance/services/finance-actions";

/**
 * Contraparte do lançamento: busca um cliente cadastrado (vincula o lançamento a ele) ou aceita só um nome digitado.
 * Envia `clientId` (vazio quando não há cliente) e `counterparty` (o nome). A busca roda no servidor, 8 por vez.
 */
export function CounterpartyField({ initialClient, initialText = "", placeholder = "Busque um cliente ou digite um nome" }: { initialClient?: CounterpartyClient | null; initialText?: string; placeholder?: string }) {
  const [client, setClient] = useState<CounterpartyClient | null>(initialClient ?? null);
  const [text, setText] = useState(initialClient ? "" : initialText);
  const [results, setResults] = useState<CounterpartyClient[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef(0);
  const listId = useId();

  // Busca com uma pequena espera entre as teclas; respostas atrasadas de buscas anteriores são descartadas.
  useEffect(() => {
    if (!open || client) return;
    const request = ++requestRef.current;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const found = await searchCounterpartyClientsAction(text);
        if (request === requestRef.current) { setResults(found); setActive(-1); }
      } catch { if (request === requestRef.current) setResults([]); }
      finally { if (request === requestRef.current) setLoading(false); }
    }, text ? 180 : 0);
    return () => window.clearTimeout(timer);
  }, [text, open, client]);

  const pick = (item: CounterpartyClient) => { setClient(item); setText(""); setOpen(false); };
  const clear = () => { setClient(null); setText(""); setOpen(true); window.setTimeout(() => inputRef.current?.focus(), 0); };
  const typed = text.trim();
  const exact = results.some((item) => item.name.trim().toLowerCase() === typed.toLowerCase());

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); setActive((index) => Math.min(results.length - 1, index + 1)); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setActive((index) => Math.max(-1, index - 1)); }
    else if (event.key === "Enter" && open && active >= 0 && results[active]) { event.preventDefault(); pick(results[active]); }
    else if (event.key === "Escape" && open) { event.preventDefault(); setOpen(false); }
  };

  if (client) return <span className="counterparty-field is-client">
    <input type="hidden" name="clientId" value={client.id} />
    <input type="hidden" name="counterparty" value={client.name} />
    <span className="counterparty-chip">
      <i aria-hidden="true">CLIENTE</i>
      <b>{client.name}{client.company ? <small> · {client.company}</small> : null}</b>
      <Link href={`/clientes/${client.id}?section=finance`} className="counterparty-open" target="_blank" title="Abrir o perfil do cliente" aria-label={`Abrir o perfil de ${client.name}`}><svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M6 3h7v7M13 3 4 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" /></svg></Link>
      <button type="button" className="counterparty-clear" onClick={clear} title="Trocar o cliente" aria-label={`Trocar o cliente ${client.name}`}><svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" /></svg></button>
    </span>
  </span>;

  return <span className="counterparty-field">
    <input type="hidden" name="clientId" value="" />
    <input ref={inputRef} name="counterparty" value={text} maxLength={160} placeholder={placeholder} autoComplete="off" spellCheck={false}
      role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
      onChange={(event) => { setText(event.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => window.setTimeout(() => setOpen(false), 120)} onKeyDown={onKeyDown} />
    {open ? <span className="counterparty-list" id={listId} role="listbox" aria-label="Clientes cadastrados">
      <small className="counterparty-list-title">{loading ? "BUSCANDO…" : results.length ? (typed ? "CLIENTES ENCONTRADOS" : "CLIENTES CADASTRADOS") : typed ? "NENHUM CLIENTE COM ESSE NOME" : "NENHUM CLIENTE CADASTRADO"}</small>
      {results.map((item, index) => <button key={item.id} id={`${listId}-${index}`} type="button" role="option" aria-selected={index === active} className={index === active ? "is-active" : undefined} onMouseDown={(event) => event.preventDefault()} onClick={() => pick(item)}>
        <b>{item.name}</b>{item.company ? <small>{item.company}</small> : null}
      </button>)}
      {typed && !exact ? <span className="counterparty-free">“{typed}” fica só como nome, sem vínculo com cliente.</span> : null}
    </span> : null}
  </span>;
}
