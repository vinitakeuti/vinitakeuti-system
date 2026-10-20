import { buildClientDocumentPdf, pdfResponse } from "@/features/quotes/services/document-pdfs";
import { getManagementUser } from "@/features/auth/services/auth-session";

/** PDF do contrato, da cessão ou do memorial técnico: capa do tipo, páginas do editor e folha de assinaturas. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getManagementUser())) return Response.json({ error: "Não autorizado." }, { status: 403 });
  const { id } = await params;
  const document = await buildClientDocumentPdf(id);
  if (!document) return new Response("Documento não encontrado.", { status: 404 });
  return pdfResponse(document);
}
