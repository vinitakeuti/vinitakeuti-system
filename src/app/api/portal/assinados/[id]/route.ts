import { getClientUser } from "@/features/auth/services/auth-session";
import { getSignedDocumentFile, signedPdfResponse } from "@/features/documents/services/signed-documents";

/** Via assinada para o próprio cliente baixar. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getClientUser();
  if (!user) return Response.json({ error: "Não autorizado." }, { status: 403 });
  const { id } = await params;
  const file = await getSignedDocumentFile(id);
  if (!file || file.clientId !== user.clientId) return new Response("Documento não encontrado.", { status: 404 });
  return signedPdfResponse(file);
}
