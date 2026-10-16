import { generateQuotePdf } from "@/features/quotes/services/quote-pdf";
import { getClientDocumentForEditor } from "@/features/documents/queries/document-queries";
import { documentKindFromEnum } from "@/features/documents/types/document-kinds";
import { parseQuoteDocumentContent, quoteDocumentImageIds } from "@/features/quotes/types/document-content";
import { getDocumentImagesForPdf } from "@/features/quotes/services/quote-images";
import { getProfessionalProfileForDocuments } from "@/features/professional-profile/queries/professional-profile-queries";

/** PDF do contrato, da cessão ou do memorial técnico: capa do tipo, páginas do editor e folha de assinaturas. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const document = await getClientDocumentForEditor(id);
  if (!document) return new Response("Documento não encontrado.", { status: 404 });
  const info = documentKindFromEnum(document.kind);
  const professional = await getProfessionalProfileForDocuments();
  const documentContent = parseQuoteDocumentContent(document.documentContent, { title: document.title, clientName: document.client.name });
  const images = await getDocumentImagesForPdf({ documentId: document.id }, quoteDocumentImageIds(documentContent));
  const pdf = await generateQuotePdf({ kind: info.kind, code: document.code, issuedAt: document.createdAt, title: document.title, scope: "", documentContent, images, client: document.client, items: [], completedAt: document.completedAt, professional });
  return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${document.code}.pdf"` } });
}
