import { PortalShell } from "@/features/client-portal/components/portal-shell";
import { day } from "@/features/client-portal/components/portal-format";
import { getPortalContext, getPortalDocuments } from "@/features/client-portal/queries/portal-queries";
import { GOV_BR_SIGNER_URL } from "@/features/documents/services/signed-documents";
import { documentKindFromEnum } from "@/features/documents/types/document-kinds";

export const dynamic = "force-dynamic";

const errors: Record<string, string> = {
  arquivo: "Escolha o arquivo PDF assinado antes de enviar.",
  formato: "O arquivo enviado não é um PDF. Envie o PDF baixado do assinador gov.br.",
  tamanho: "O arquivo deve ter até 8 MB.",
  limite: "Este documento já recebeu o limite de 5 envios. Fale com o responsável para substituir.",
  documento: "Documento não encontrado.",
};

type DocumentsPageProps = { searchParams: Promise<{ enviado?: string; "sem-assinatura"?: string; erro?: string }> };

export default async function PortalDocumentsPage({ searchParams }: DocumentsPageProps) {
  const params = await searchParams;
  const context = await getPortalContext();
  const documents = await getPortalDocuments(context.clientId);
  // Enviado sem assinatura digital ainda conta como pendente.
  const pending = documents.filter((document) => !document.signed?.signatureDetected).length;

  return <PortalShell context={context} current="documents" section="DOCUMENTOS" title="Documentos." description="Baixe, assine pelo gov.br e envie de volta a via assinada.">
    {params.enviado ? <p className={`portal-feedback ${params["sem-assinatura"] ? "is-error" : "is-ok"}`} role="status">{params["sem-assinatura"] ? `Recebemos o arquivo de ${params.enviado.slice(0, 30)}, mas ele não tem assinatura digital. Confira se enviou o PDF baixado do assinador gov.br depois de assinar.` : `Via assinada de ${params.enviado.slice(0, 30)} enviada. Obrigado!`}</p> : null}
    {params.erro && errors[params.erro] ? <p className="portal-feedback is-error" role="alert">{errors[params.erro]}</p> : null}

    {documents.length ? <section className="settings-panel" aria-labelledby="portal-sign-title">
      <div className="settings-panel-heading"><div><h2 id="portal-sign-title">Como assinar.</h2><p>A assinatura pelo gov.br é gratuita e tem validade jurídica. É preciso ter conta gov.br nível prata ou ouro.</p></div></div>
      <ol className="portal-sign-steps">
        <li><span>01</span><div><b>Baixe o PDF</b><small>Em BAIXAR PDF, no documento abaixo.</small></div></li>
        <li><span>02</span><div><b>Assine no gov.br</b><small>Em ASSINAR NO GOV.BR, entre com sua conta, escolha o arquivo, posicione a assinatura e baixe o PDF assinado.</small></div></li>
        <li><span>03</span><div><b>Envie a via assinada</b><small>Escolha o PDF assinado e use ENVIAR ASSINADO.</small></div></li>
      </ol>
    </section> : null}

    <section className="settings-panel" aria-labelledby="portal-documents-title">
      <div className="settings-panel-heading"><div><h2 id="portal-documents-title">Seus documentos.</h2><p>{documents.length ? (pending ? `${pending} aguardando sua assinatura.` : "Todos com a via assinada enviada. Obrigado!") : "Nenhum documento disponível ainda."}</p></div></div>
      {documents.length ? <ul className="portal-list">{documents.map((document) => <li className="portal-document" key={`${document.kind}-${document.id}`}>
        <div className="portal-row-main">
          <b>{document.title}</b>
          <small>{document.kind === "PROPOSAL" ? "Proposta comercial" : documentKindFromEnum(document.kind).name} · {document.code} · {day(document.completedAt)}</small>
          {document.signed ? <span className={`portal-tag ${document.signed.signatureDetected ? "is-ok" : "is-soon"}`}>{document.signed.signatureDetected ? `Assinado · enviado em ${day(document.signed.createdAt)}` : `Enviado em ${day(document.signed.createdAt)} · sem assinatura digital`}</span> : <span className="portal-tag is-soon">Aguardando sua assinatura</span>}
        </div>
        <div className="portal-document-actions">
          <a className="secondary-action" href={document.href} download>BAIXAR PDF</a>
          <a className="secondary-action" href={GOV_BR_SIGNER_URL} target="_blank" rel="noreferrer">ASSINAR NO GOV.BR</a>
          {document.signed ? <a className="text-link" href={`/api/portal/assinados/${document.signed.id}`} download>BAIXAR VIA ASSINADA</a> : null}
        </div>
        <form className="portal-upload" action="/api/portal/assinados" method="post" encType="multipart/form-data">
          <input type="hidden" name="kind" value={document.target} />
          <input type="hidden" name="id" value={document.id} />
          <label><span>{document.signed ? "ENVIAR OUTRA VIA ASSINADA" : "PDF ASSINADO"}</span><input name="file" type="file" accept="application/pdf,.pdf" required /></label>
          <button className="primary-action" type="submit">ENVIAR ASSINADO</button>
        </form>
      </li>)}</ul> : <p className="settings-empty">Quando uma proposta ou contrato for concluído, ele aparece aqui.</p>}
    </section>
  </PortalShell>;
}
