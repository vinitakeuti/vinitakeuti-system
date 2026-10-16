"use client";

import { useEffect, useId, useState } from "react";
import type { KeyboardEvent } from "react";

export type ClientPickerOption = { id: string; name: string; company: string | null };

type Props = {
  name?: string;
  label?: string;
  hint?: string;
  initialClient?: ClientPickerOption | null;
  className?: string;
  /** Avisa quando o cliente escolhido muda (null ao remover). */
  onChange?: (client: ClientPickerOption | null) => void;
  removeLabel?: string;
  placeholder?: string;
};

/** Busca de cliente sob demanda: não carrega a base inteira e envia somente o id selecionado. */
export function ClientPicker({ name = "clientId", label = "Cliente vinculado", hint, initialClient = null, className, onChange, removeLabel = "REMOVER VÍNCULO", placeholder = "Buscar por nome, empresa ou e-mail" }: Props) {
  const listId = useId();
  const [selected, setSelected] = useState<ClientPickerOption | null>(initialClient);
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<ClientPickerOption[]>([]);

  useEffect(() => {
    if (!isOpen || selected) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/clientes/busca?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        if (!response.ok) return;
        const payload = await response.json() as { data: ClientPickerOption[] };
        setResults(payload.data);
      } catch { if (!controller.signal.aborted) setResults([]); }
      finally { if (!controller.signal.aborted) setIsLoading(false); }
    }, 180);
    return () => { controller.abort(); window.clearTimeout(timeout); };
  }, [isOpen, query, selected]);

  function choose(client: ClientPickerOption) {
    setSelected(client);
    setIsOpen(false);
    setQuery("");
    onChange?.(client);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") setIsOpen(false);
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (isOpen && !isLoading && results[0]) choose(results[0]);
  }

  return <div className={`client-picker${className ? ` ${className}` : ""}`} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false); }}>
    <span className="client-picker-label">{label}</span>
    <input type="hidden" name={name} value={selected?.id ?? ""} />
    {selected ? <div className="client-picker-selected">
      <div><b>{selected.name}</b><small>{selected.company ?? "Pessoa física"}</small></div>
      <button type="button" onClick={() => { setSelected(null); onChange?.(null); }}>{removeLabel}</button>
    </div> : <div className="client-picker-search">
      <input type="search" role="combobox" aria-label={label} aria-expanded={isOpen} aria-controls={listId} aria-autocomplete="list" value={query} onChange={(event) => { setQuery(event.target.value); setIsOpen(true); }} onFocus={() => setIsOpen(true)} onKeyDown={handleKeyDown} placeholder={placeholder} autoComplete="off" spellCheck={false} />
      {isOpen ? <div className="client-picker-results" id={listId} role="listbox">{isLoading && !results.length ? <p>Buscando clientes...</p> : results.length ? results.map((client) => <button type="button" role="option" aria-selected={false} key={client.id} onClick={() => choose(client)}><b>{client.name}</b><small>{client.company ?? "Pessoa física"}</small></button>) : <p>{query ? "Nenhum cliente encontrado." : "Nenhum cliente cadastrado."}</p>}</div> : null}
    </div>}
    {hint ? <small className="client-picker-hint">{hint}</small> : null}
  </div>;
}
