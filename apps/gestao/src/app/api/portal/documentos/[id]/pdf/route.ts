import { buildClientDocumentPdf, pdfResponse } from "@/features/quotes/services/document-pdfs";
import { getClientUser } from "@/features/auth/services/auth-session";

/** PDF para o cliente: só documentos concluídos e do próprio cliente (os demais respondem como inexistentes). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getClientUser();
  if (!user) return Response.json({ error: "Não autorizado." }, { status: 403 });
  const { id } = await params;
  const document = await buildClientDocumentPdf(id);
  if (!document || document.clientId !== user.clientId || !document.completedAt) return new Response("Documento não encontrado.", { status: 404 });
  return pdfResponse(document);
}
