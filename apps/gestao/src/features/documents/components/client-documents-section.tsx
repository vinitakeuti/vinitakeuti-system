import Link from "next/link";
import { ConfirmSubmitButton } from "@/features/finance/components/confirm-submit-button";
import { discardSignedDocumentAction, reviewSignedDocumentAction } from "@/features/documents/services/document-actions";
import { DOCUMENT_KINDS, documentKindFromEnum, type ClientDocumentKindValue, type DocumentKind } from "@/features/documents/types/document-kinds";
import { signatureState, type SignatureState, type SignedCopy } from "@/features/documents/types/signed-review";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Maceio" });
const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Maceio" });

const stateLabels: Record<SignatureState, string> = { draft: "Rascunho", waiting: "Aguardando assinatura", review: "Para conferir", signed: "Assinado", rejected: "Via recusada" };

type ProfileQuote = { id: string; code: string; title: string; amountCents: number; createdAt: Date; completedAt: Date | null; signedCopies: SignedCopy[] };
type ProfileDocument = { id: string; code: string; title: string; kind: ClientDocumentKindValue; completedAt: Date | null; updatedAt: Date; signedCopies: SignedCopy[] };
type Row = { id: string; kind: DocumentKind; kindLabel: string; code: string; title: string; detail: string | null; date: Date; completedAt: Date | null; state: SignatureState; signed: SignedCopy | null; href: string; pdf: string };

function fileSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Data que acompanha a situação: quando foi concluído, enviado, aprovado ou recusado. */
function stateDetail(row: Row) {
  if (row.state === "waiting" && row.completedAt) return `concluído em ${date.format(row.completedAt)}`;
  if (row.state === "review" && row.signed) return `enviada em ${date.format(row.signed.createdAt)}`;
  if ((row.state === "signed" || row.state === "rejected") && row.signed?.reviewedAt) return `${row.state === "signed" ? "aprovada" : "recusada"} em ${date.format(row.signed.reviewedAt)}`;
  return null;
}

const feedback: Record<string, string> = {
  aprovado: "Via aprovada. O documento passa a constar como assinado na área do cliente.",
  recusado: "Via recusada. O cliente vê o motivo na área do cliente e pode enviar outra.",
  excluido: "Via excluída. O documento volta para Para assinar na área do cliente, e o cliente pode enviar uma nova via.",
};

/**
 * Documentos no perfil do cliente. No topo, as vias assinadas enviadas pelo portal que aguardam conferência; abaixo,
 * um grupo por tipo com uma única situação por documento (rascunho, aguardando assinatura, para conferir, assinado
 * ou recusado). Tipos sem documento ficam resumidos no rodapé.
 */
export function ClientDocumentsSection({ clientId, quotes, documents, reviewed }: { clientId: string; quotes: ProfileQuote[]; documents: ProfileDocument[]; reviewed?: string }) {
  const rows: Row[] = [
    ...quotes.map((quote) => ({ id: quote.id, kind: "proposal" as const, kindLabel: "Proposta", code: quote.code, title: quote.title, detail: money.format(quote.amountCents / 100), date: quote.createdAt, completedAt: quote.completedAt, state: signatureState(Boolean(quote.completedAt), quote.signedCopies[0] ?? null), signed: quote.signedCopies[0] ?? null, href: `/orcamentos/${quote.id}/editor`, pdf: `/api/orcamentos/${quote.id}/pdf` })),
    ...documents.map((document) => {
      const info = documentKindFromEnum(document.kind);
      return { id: document.id, kind: info.kind, kindLabel: info.shortName, code: document.code, title: document.title, detail: null, date: document.updatedAt, completedAt: document.completedAt, state: signatureState(Boolean(document.completedAt), document.signedCopies[0] ?? null), signed: document.signedCopies[0] ?? null, href: `/documentos/${document.id}/editor`, pdf: `/api/documentos/${document.id}/pdf` };
    }),
  ];
  const toReview = rows.filter((row) => row.state === "review");
  const groups = DOCUMENT_KINDS.map((info) => ({ info, rows: rows.filter((row) => row.kind === info.kind) }));
  const filled = groups.filter((group) => group.rows.length);
  const missing = groups.filter((group) => !group.rows.length);

  return <section className="client-panel client-docs">
    <div className="client-panel-heading"><div><h2>Documentos</h2><p>Propostas, contratos, cessões e memoriais deste cliente, com a situação da assinatura de cada um.</p></div></div>
    {reviewed && feedback[reviewed] ? <p className="client-docs-feedback" role="status">{feedback[reviewed]}</p> : null}

    {toReview.length ? <div className="client-docs-review" aria-labelledby="client-docs-review-title">
      <div className="client-docs-review-heading"><h3 id="client-docs-review-title">Vias assinadas para conferir <span>{toReview.length}</span></h3><p>O cliente enviou pelo portal. Baixe o arquivo, confira a assinatura e aprove ou recuse.</p></div>
      <ul>{toReview.map((row) => <li key={row.signed!.id}>
        <div className="client-docs-review-main"><span className="client-docs-kind">{row.kindLabel}</span><div><b>{row.title}</b><small>{row.code} · enviada em {dateTime.format(row.signed!.createdAt)} · {row.signed!.fileName} · {fileSize(row.signed!.byteSize)}</small></div></div>
        <div className="client-docs-review-actions">
          <a className="secondary-action" href={`/api/documentos/assinados/${row.signed!.id}`}>BAIXAR VIA</a>
          <form action={reviewSignedDocumentAction}><input type="hidden" name="id" value={row.signed!.id} /><input type="hidden" name="decision" value="approve" /><button className="primary-action" type="submit">APROVAR</button></form>
          <details className="client-docs-reject">
            <summary className="secondary-action">RECUSAR</summary>
            <form action={reviewSignedDocumentAction}><input type="hidden" name="id" value={row.signed!.id} /><input type="hidden" name="decision" value="reject" /><label>Motivo, visível para o cliente<input name="reason" maxLength={300} placeholder="Ex.: falta a assinatura na última página." /></label><button className="danger-action" type="submit">CONFIRMAR RECUSA</button></form>
          </details>
        </div>
      </li>)}</ul>
    </div> : null}

    {filled.length ? <div className="client-docs-table">
      <div className="client-docs-columns" aria-hidden="true"><span>DOCUMENTO</span><span>SITUAÇÃO</span><span>ATUALIZADO</span><span /></div>
      {filled.map(({ info, rows: groupRows }) => <section className="client-docs-group" key={info.kind} aria-label={info.name}>
        <div className="client-docs-group-head"><h3>{info.name}<span>{groupRows.length}</span></h3><Link className="text-link" href={`/documentos?tipo=${info.slug}&clientId=${clientId}`}>PRODUZIR</Link></div>
        <ul>{groupRows.map((row) => {
          const detail = stateDetail(row);
          return <li key={row.id}>
            <div className="client-docs-title"><Link href={row.href}>{row.title}</Link><small>{[row.code, row.detail].filter(Boolean).join(" · ")}</small>{row.state === "rejected" && row.signed?.rejectionReason ? <small className="client-docs-reason">Motivo da recusa: {row.signed.rejectionReason}</small> : null}</div>
            <div className="client-docs-state"><span className={`doc-pill is-${row.state}`}><i aria-hidden="true" />{stateLabels[row.state]}</span>{detail ? <small>{detail}</small> : null}</div>
            <span className="client-docs-date">{date.format(row.date)}</span>
            <div className="client-docs-actions"><Link className="table-link" href={row.href}>EDITAR</Link><a className="table-link" href={row.pdf}>PDF</a>{row.signed ? <a className="table-link" href={`/api/documentos/assinados/${row.signed.id}`}>VIA ASSINADA</a> : null}{row.state === "signed" ? <form><input type="hidden" name="id" value={row.signed!.id} /><ConfirmSubmitButton formAction={discardSignedDocumentAction} className="table-link client-docs-discard" message={`Excluir a via assinada de ${row.code} e pedir um novo envio? O documento volta para "Para assinar" na área do cliente.`}>EXCLUIR VIA</ConfirmSubmitButton></form> : null}</div>
          </li>;
        })}</ul>
      </section>)}
    </div> : <div className="client-panel-empty"><p>Nenhum documento produzido para este cliente.</p></div>}

    {missing.length ? <div className="client-docs-missing"><p>{filled.length ? "AINDA SEM DOCUMENTO" : "PRODUZIR"}</p><ul>{missing.map(({ info }) => <li key={info.kind}><span>{info.name}</span><Link className="text-link" href={`/documentos?tipo=${info.slug}&clientId=${clientId}`}>PRODUZIR</Link></li>)}</ul></div> : null}
  </section>;
}
