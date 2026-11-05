"use client";

import { useState } from "react";
import { deleteClientAction } from "@/features/clients/services/client-actions";

type Impact = {
  id: string;
  name: string;
  removed: Record<"quotes" | "documents" | "sales" | "subscriptions" | "projects" | "contracts" | "portalUsers" | "signedDocuments" | "charges", number>;
  unlinked: Record<"monitoredApps" | "conversations" | "events", number>;
  kept: { financialEntries: number };
  openOnlineCharges: number;
};

const REMOVED: Array<[keyof Impact["removed"], string, string]> = [["quotes", "proposta", "propostas"], ["documents", "documento", "documentos"], ["sales", "venda", "vendas"], ["subscriptions", "assinatura de serviço", "assinaturas de serviço"], ["projects", "projeto", "projetos"], ["contracts", "contrato", "contratos"], ["charges", "cobrança", "cobranças"], ["signedDocuments", "via assinada", "vias assinadas"], ["portalUsers", "acesso à área do cliente", "acessos à área do cliente"]];
const UNLINKED: Array<[keyof Impact["unlinked"], string, string]> = [["monitoredApps", "sistema monitorado", "sistemas monitorados"], ["conversations", "conversa da IA", "conversas da IA"], ["events", "evento da agenda", "eventos da agenda"]];

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
const sameName = (left: string, right: string) => left.normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase() === right.normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase();

/** Área de exclusão do cliente: o que vai junto, o que fica, e a confirmação digitando o nome. */
export function DeleteClientPanel({ impact, error }: { impact: Impact; error?: string }) {
  const [typed, setTyped] = useState("");
  const removed = REMOVED.filter(([key]) => impact.removed[key] > 0);
  const unlinked = UNLINKED.filter(([key]) => impact.unlinked[key] > 0);
  const blocked = impact.openOnlineCharges > 0;
  const matches = sameName(typed, impact.name);
  return <section className="client-delete" id="excluir" aria-labelledby="client-delete-title">
    <div className="client-delete-head"><h2 id="client-delete-title">Excluir cliente</h2><p>Remove o cadastro de vez. Não dá para desfazer.</p></div>
    <div className="client-delete-body">
      <dl className="client-delete-impact">
        <div><dt>Apagado junto</dt><dd>{removed.length ? removed.map(([key, one, many]) => plural(impact.removed[key], one, many)).join(" · ") : "Nada além do cadastro."}</dd></div>
        {unlinked.length ? <div><dt>Continua, sem o vínculo</dt><dd>{unlinked.map(([key, one, many]) => plural(impact.unlinked[key], one, many)).join(" · ")}</dd></div> : null}
        {impact.kept.financialEntries ? <div><dt>Fica no financeiro</dt><dd>{plural(impact.kept.financialEntries, "lançamento", "lançamentos")} com o nome do cliente, como histórico. Se algum ainda estiver a receber e não for mais receber, cancele no Financeiro.</dd></div> : null}
      </dl>
      {blocked ? <p className="client-delete-blocked" role="alert">Há {plural(impact.openOnlineCharges, "cobrança em aberto", "cobranças em aberto")} no Asaas para este cliente. Cancele no lançamento do Financeiro antes de excluir, para ele não pagar algo que deixou de existir aqui.</p> : null}
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <form className="client-delete-form" action={deleteClientAction}>
        <input type="hidden" name="id" value={impact.id} />
        <label>Para confirmar, digite <b>{impact.name}</b><input name="confirmName" value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" spellCheck={false} disabled={blocked} /></label>
        <button className="danger-action" type="submit" disabled={blocked || !matches}>Excluir cliente</button>
      </form>
    </div>
  </section>;
}
