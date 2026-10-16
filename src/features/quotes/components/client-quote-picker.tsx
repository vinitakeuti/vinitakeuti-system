"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ClientOption = { id: string; name: string; company: string | null; email: string | null };

/** `params` são mantidos ao escolher ou buscar o cliente (o tipo de documento, por exemplo). */
export function ClientQuotePicker({ clients, query, basePath = "/orcamentos/novo", params = {}, help = "Selecione um perfil para avançar para os serviços do orçamento." }: { clients: ClientOption[]; query?: string; basePath?: string; params?: Record<string, string>; help?: string }) {
  const router = useRouter();
  const [showSearch, setShowSearch] = useState(Boolean(query));
  const selectedLabel = query ? "RESULTADOS DA BUSCA" : "CLIENTES RECENTES";
  function selectClient(clientId: string) { if (clientId) router.push(`${basePath}?${new URLSearchParams({ ...params, clientId })}`); }
  return <div className="quote-client-picker-simple"><label htmlFor="quote-client-select">{selectedLabel}<select id="quote-client-select" defaultValue="" onChange={(event) => selectClient(event.target.value)}><option value="" disabled>Selecione um cliente</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}{client.company ? ` — ${client.company}` : ""}</option>)}</select></label><p className="quote-picker-help">{help}</p><button className="quote-client-search-toggle" type="button" onClick={() => setShowSearch((visible) => !visible)}>{showSearch ? "FECHAR BUSCA" : "NÃO ENCONTROU? BUSCAR CLIENTE"}</button>{showSearch ? <form className="quote-client-search" action={basePath}>{Object.entries(params).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}<label htmlFor="client-search">NOME, EMPRESA OU E-MAIL</label><div><input id="client-search" name="clientQuery" defaultValue={query ?? ""} placeholder="Digite o nome, empresa ou e-mail" autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} /><button type="submit">BUSCAR</button></div></form> : null}</div>;
}
