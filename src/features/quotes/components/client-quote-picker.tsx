"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ClientOption = { id: string; name: string; company: string | null; email: string | null };

export function ClientQuotePicker({ clients, query, basePath = "/orcamentos/novo" }: { clients: ClientOption[]; query?: string; basePath?: string }) {
  const router = useRouter();
  const [showSearch, setShowSearch] = useState(Boolean(query));
  const selectedLabel = query ? "RESULTADOS DA BUSCA" : "CLIENTES RECENTES";
  function selectClient(clientId: string) { if (clientId) router.push(`${basePath}?clientId=${encodeURIComponent(clientId)}`); }
  return <div className="quote-client-picker-simple"><label htmlFor="quote-client-select">{selectedLabel}<select id="quote-client-select" defaultValue="" onChange={(event) => selectClient(event.target.value)}><option value="" disabled>Selecione um cliente</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}{client.company ? ` — ${client.company}` : ""}</option>)}</select></label><p className="quote-picker-help">Selecione um perfil para avançar para os serviços do orçamento.</p><button className="quote-client-search-toggle" type="button" onClick={() => setShowSearch((visible) => !visible)}>{showSearch ? "FECHAR BUSCA" : "NÃO ENCONTROU? BUSCAR CLIENTE"}</button>{showSearch ? <form className="quote-client-search" action={basePath}><label htmlFor="client-search">NOME, EMPRESA OU E-MAIL</label><div><input id="client-search" name="clientQuery" defaultValue={query ?? ""} placeholder="Digite o nome, empresa ou e-mail" autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} /><button type="submit">BUSCAR</button></div></form> : null}</div>;
}
