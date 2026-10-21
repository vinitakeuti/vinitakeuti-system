import Link from "next/link";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { DeleteDocumentButton } from "@/features/documents/components/delete-document-button";
import { DocumentProducer } from "@/features/documents/components/document-producer";
import { listClientDocuments, listQuotesForDocuments } from "@/features/documents/queries/document-queries";
import { createClientDocumentAction, deleteClientDocumentAction } from "@/features/documents/services/document-actions";
import { DOCUMENT_KINDS, documentKindFromSlug } from "@/features/documents/types/document-kinds";
import { getClientForQuote } from "@/features/quotes/queries/quote-queries";

export const dynamic = "force-dynamic";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Maceio" });
const listTitles: Record<string, string> = { proposal: "Propostas comerciais", contract: "Contratos", assignment: "Cessões", memorial: "Memoriais técnicos" };

type Row = { id: string; title: string; code: string; detail: string | null; client: { id: string; name: string; company: string | null }; done: boolean; updatedAt: Date; editHref: string; pdfHref: string; secondary?: { href: string; label: string }; signed: { id: string; createdAt: Date; signatureDetected: boolean } | null };

/**
 * Documentos: um seletor define o tipo (proposta, contrato, cessão ou memorial). O painel de produção e a lista
 * abaixo seguem o tipo escolhido.
 */
export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ tipo?: string; status?: string; cursor?: string; clientId?: string; concluido?: string; excluido?: string; error?: string }> }) {
  const { tipo, status, cursor, clientId, concluido, excluido, error } = await searchParams;
  const info = documentKindFromSlug(tipo) ?? DOCUMENT_KINDS[0];
  const pending = status === "pendentes";
  const initialClient = clientId ? await getClientForQuote(clientId.slice(0, 50)) : null;
  let rows: Row[];
  let nextCursor: string | null;
  if (info.kind === "proposal") {
    const result = await listQuotesForDocuments({ cursor, pending });
    nextCursor = result.nextCursor;
    rows = result.data.map((quote) => ({ id: quote.id, title: quote.title, code: quote.code, detail: money.format(quote.amountCents / 100), client: quote.client, done: Boolean(quote.completedAt), updatedAt: quote.updatedAt, editHref: `/orcamentos/${quote.id}/editor`, pdfHref: `/api/orcamentos/${quote.id}/pdf`, secondary: { href: `/orcamentos/${quote.id}/editar`, label: "VALORES" }, signed: quote.signedCopies[0] ?? null }));
  } else {
    const result = await listClientDocuments({ cursor, kind: info.kind, pending });
    nextCursor = result.nextCursor;
    rows = result.data.map((document) => ({ id: document.id, title: document.title, code: document.code, detail: null, client: document.client, done: Boolean(document.completedAt), updatedAt: document.updatedAt, editHref: `/documentos/${document.id}/editor`, pdfHref: `/api/documentos/${document.id}/pdf`, signed: document.signedCopies[0] ?? null }));
  }
  const href = (params: Record<string, string | null>) => {
    const query = new URLSearchParams();
    const merged = { tipo: info.slug, status: pending ? "pendentes" : null, clientId: initialClient?.id ?? null, ...params };
    Object.entries(merged).forEach(([key, value]) => { if (value) query.set(key, value); });
    return `/documentos?${query}`;
  };

  return <main className="app-shell"><AppSidebar current="quotes" /><div className="workspace"><section className="directory-page documents-page">
    <header className="directory-header"><div><p className="eyebrow">DOCUMENTOS</p><h1>Documentos.</h1><p>Escolha o documento e o cliente. Tudo fica vinculado ao perfil do cliente.</p></div><div className="header-actions"><SidebarToggle location="header" /><Link className="text-link" href={`/documentos/texto-padrao?tipo=${info.slug}`}>TEXTO PADRÃO</Link></div></header>
    {concluido ? <p className="form-success" role="status">Documento {concluido} concluído.</p> : null}
    {excluido ? <p className="form-success" role="status">Documento excluído.</p> : null}
    {error ? <p className="form-error" role="alert">{error.slice(0, 200)}</p> : null}
    <nav className="documents-switch" aria-label="Tipo de documento">
      {DOCUMENT_KINDS.map((item) => <Link key={item.kind} href={href({ tipo: item.slug, status: null, cursor: null })} className={item.kind === info.kind ? "active" : undefined} aria-current={item.kind === info.kind ? "page" : undefined} scroll={false}>{item.kind === "memorial" ? "Memorial" : item.shortName}</Link>)}
    </nav>
    <section className="directory-surface documents-surface">
      <div className="documents-produce">
        <div className="documents-produce-heading"><p className="eyebrow">NOVO DOCUMENTO</p><h2>{info.name}</h2><span>{info.description}</span></div>
        <DocumentProducer kind={{ slug: info.slug, shortName: info.shortName, description: info.description, isProposal: info.kind === "proposal" }} initialClient={initialClient ? { id: initialClient.id, name: initialClient.name, company: initialClient.company } : null} createAction={createClientDocumentAction} />
      </div>
      <div className="documents-list">
        <div className="documents-list-heading">
          <h2>{listTitles[info.kind]}</h2>
          <nav className="documents-filters" aria-label="Situação">
            <Link className={!pending ? "active" : undefined} href={href({ status: null, cursor: null })} scroll={false}>Todos</Link>
            <Link className={pending ? "active" : undefined} href={href({ status: "pendentes", cursor: null })} scroll={false}>Pendentes</Link>
          </nav>
        </div>
        {rows.length ? <div className="table-scroll"><table className="quote-pending-table documents-table"><thead><tr><th>DOCUMENTO</th><th>CLIENTE</th><th>SITUAÇÃO</th><th>ALTERADO</th><th aria-label="Ações" /></tr></thead><tbody>
          {rows.map((row) => <tr key={row.id}>
            <td className="quote-pending-title"><Link className="client-name" href={row.editHref}>{row.title}</Link><small>{row.code}{row.detail ? ` · ${row.detail}` : ""}</small></td>
            <td className="quote-pending-client"><Link className="table-link" href={`/clientes/${row.client.id}?section=documents`}>{row.client.name}</Link><small>{row.client.company ?? "Pessoa física"}</small></td>
            <td><span className={row.done ? "documents-status is-done" : "documents-status"}>{row.done ? "Concluído" : "Pendente"}</span>{row.signed ? <small className={row.signed.signatureDetected ? "documents-signed" : "documents-signed is-warning"}>{row.signed.signatureDetected ? "Assinado pelo cliente" : "Enviado sem assinatura digital"} · {dateTime.format(row.signed.createdAt)}</small> : null}</td>
            <td className="quote-pending-date"><span>{dateTime.format(row.updatedAt)}</span></td>
            <td className="quote-pending-actions"><div><Link className="primary-action" href={row.editHref}>{row.done ? "ABRIR" : "CONTINUAR"}</Link>{row.secondary ? <Link className="table-link" href={row.secondary.href}>{row.secondary.label}</Link> : null}<a className="table-link" href={row.pdfHref}>PDF</a>{row.signed ? <a className="table-link" href={`/api/documentos/assinados/${row.signed.id}`}>ASSINADO</a> : null}{info.kind === "proposal" ? null : <DeleteDocumentButton documentId={row.id} action={deleteClientDocumentAction} />}</div></td>
          </tr>)}
        </tbody></table></div> : <div className="documents-empty"><p>{pending ? `Nenhum documento pendente.` : `Nenhum documento produzido ainda.`}</p><span>{info.kind === "proposal" ? "As propostas que você criar aparecerão aqui." : `Use o painel acima para produzir ${info.kind === "contract" ? "o primeiro contrato" : info.kind === "assignment" ? "a primeira cessão" : "o primeiro memorial"}.`}</span></div>}
        {nextCursor ? <div className="table-footer"><Link className="text-link" href={href({ cursor: nextCursor })}>CARREGAR PRÓXIMOS 50</Link></div> : null}
      </div>
    </section>
  </section></div></main>;
}
