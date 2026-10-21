import { PortalShell } from "@/features/client-portal/components/portal-shell";
import { day } from "@/features/client-portal/components/portal-format";
import { getPortalContext, getPortalDocuments } from "@/features/client-portal/queries/portal-queries";
import { GOV_BR_SIGNER_URL } from "@/features/documents/services/signed-documents";

export const dynamic = "force-dynamic";

const errors: Record<string, string> = {
  arquivo: "Escolha o arquivo PDF assinado antes de enviar.",
  formato: "O arquivo enviado não é um PDF. Envie o PDF baixado do assinador gov.br.",
  tamanho: "O arquivo deve ter até 8 MB.",
  limite: "Este documento já recebeu o limite de 5 envios. Fale com o responsável para substituir.",
  documento: "Documento não encontrado.",
};

/** Tipos na ordem em que aparecem, com o nome do grupo e o rótulo de cada documento. */
const KINDS = [
  { kind: "PROPOSAL", group: "Propostas comerciais", label: "PROPOSTA" },
  { kind: "CONTRACT", group: "Contratos", label: "CONTRATO" },
  { kind: "IP_ASSIGNMENT", group: "Cessões de direitos", label: "CESSÃO" },
  { kind: "TECHNICAL_MEMORIAL", group: "Memoriais técnicos", label: "MEMORIAL" },
] as const;

type PortalDocument = Awaited<ReturnType<typeof getPortalDocuments>>[number];
type DocumentsPageProps = { searchParams: Promise<{ enviado?: string; "sem-assinatura"?: string; erro?: string }> };

function byKind(documents: PortalDocument[]) {
  return KINDS.map((info) => ({ ...info, documents: documents.filter((document) => document.kind === info.kind) })).filter((group) => group.documents.length);
}

function UploadForm({ document, label }: { document: PortalDocument; label: string }) {
  return <form className="portal-sign-upload" action="/api/portal/assinados" method="post" encType="multipart/form-data">
    <input type="hidden" name="kind" value={document.target} />
    <input type="hidden" name="id" value={document.id} />
    <label><span>{label}</span><input name="file" type="file" accept="application/pdf,.pdf" required /></label>
    <button className="primary-action" type="submit">ENVIAR</button>
  </form>;
}

/**
 * Documentos: separados por situação (para assinar e assinados) e, dentro de cada uma, por tipo. Os documentos para
 * assinar trazem os três passos na própria linha: baixar, assinar no gov.br e enviar a via assinada.
 */
export default async function PortalDocumentsPage({ searchParams }: DocumentsPageProps) {
  const params = await searchParams;
  const context = await getPortalContext();
  const documents = await getPortalDocuments(context.clientId);
  // Enviado sem assinatura digital ainda conta como pendente.
  const pending = documents.filter((document) => !document.signed?.signatureDetected);
  const signed = documents.filter((document) => document.signed?.signatureDetected);

  return <PortalShell context={context} current="documents" section="DOCUMENTOS" title="Documentos." description="Propostas, contratos e demais documentos do seu projeto, separados entre o que falta assinar e o que já está assinado.">
    {params.enviado ? <p className={`portal-feedback ${params["sem-assinatura"] ? "is-error" : "is-ok"}`} role="status">{params["sem-assinatura"] ? `Recebemos o arquivo de ${params.enviado.slice(0, 30)}, mas ele não tem assinatura digital. Confira se enviou o PDF baixado do assinador gov.br depois de assinar.` : `Via assinada de ${params.enviado.slice(0, 30)} enviada. Obrigado!`}</p> : null}
    {params.erro && errors[params.erro] ? <p className="portal-feedback is-error" role="alert">{errors[params.erro]}</p> : null}

    {!documents.length ? <section className="settings-panel"><p className="settings-empty">Nenhum documento disponível ainda. Quando uma proposta ou contrato for concluído, ele aparece aqui.</p></section> : null}

    {pending.length ? <section className="settings-panel portal-docs" aria-labelledby="portal-pending-title">
      <div className="settings-panel-heading"><div><h2 id="portal-pending-title">Para assinar <span className="portal-docs-count">{pending.length}</span></h2><p>Assinatura gratuita e com validade jurídica pelo gov.br (conta nível prata ou ouro). Siga os três passos em cada documento.</p></div></div>
      {byKind(pending).map((group) => <div className="portal-docs-group" key={group.kind}>
        <p className="portal-docs-group-title">{group.group}</p>
        <ul>{group.documents.map((document) => <li key={`${document.kind}-${document.id}`} className="portal-doc is-pending">
          <div className="portal-doc-head">
            <span className="portal-doc-kind">{group.label}</span>
            <div><b>{document.title}</b><small>{document.code} · concluído em {day(document.completedAt)}</small></div>
            {document.signed ? <span className="portal-tag is-late">Enviado sem assinatura digital</span> : <span className="portal-tag is-soon">Aguardando assinatura</span>}
          </div>
          <ol className="portal-doc-steps">
            <li><a href={document.href} download><span>1</span>BAIXAR PDF</a></li>
            <li><a href={GOV_BR_SIGNER_URL} target="_blank" rel="noreferrer"><span>2</span>ASSINAR NO GOV.BR</a></li>
            <li className="portal-doc-step-upload"><span>3</span><UploadForm document={document} label="ENVIE O PDF ASSINADO" /></li>
          </ol>
        </li>)}</ul>
      </div>)}
    </section> : null}

    {signed.length ? <section className="settings-panel portal-docs" aria-labelledby="portal-signed-title">
      <div className="settings-panel-heading"><div><h2 id="portal-signed-title">Assinados <span className="portal-docs-count">{signed.length}</span></h2><p>Documentos com a via assinada já enviada.</p></div></div>
      {byKind(signed).map((group) => <div className="portal-docs-group" key={group.kind}>
        <p className="portal-docs-group-title">{group.group}</p>
        <ul>{group.documents.map((document) => <li key={`${document.kind}-${document.id}`} className="portal-doc is-signed">
          <div className="portal-doc-head">
            <span className="portal-doc-kind">{group.label}</span>
            <div><b>{document.title}</b><small>{document.code} · assinado e enviado em {day(document.signed!.createdAt)}</small></div>
            <span className="portal-tag is-ok">Assinado</span>
          </div>
          <div className="portal-doc-links">
            <a href={`/api/portal/assinados/${document.signed!.id}`} download>BAIXAR VIA ASSINADA</a>
            <a href={document.href} download>BAIXAR ORIGINAL</a>
            <details><summary>ENVIAR OUTRA VIA</summary><UploadForm document={document} label="NOVA VIA ASSINADA" /></details>
          </div>
        </li>)}</ul>
      </div>)}
    </section> : null}
  </PortalShell>;
}
