import { getManagementUser } from "@/features/auth/services/auth-session";
import { getSignedDocumentFile, signedPdfResponse } from "@/features/documents/services/signed-documents";

/** Via assinada enviada pelo cliente, para baixar na gestão. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getManagementUser())) return Response.json({ error: "Não autorizado." }, { status: 403 });
  const { id } = await params;
  const file = await getSignedDocumentFile(id);
  if (!file) return new Response("Documento não encontrado.", { status: 404 });
  return signedPdfResponse(file);
}
