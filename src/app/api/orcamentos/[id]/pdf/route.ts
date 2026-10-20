import { buildQuotePdf, pdfResponse } from "@/features/quotes/services/document-pdfs";
import { getManagementUser } from "@/features/auth/services/auth-session";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getManagementUser())) return Response.json({ error: "Não autorizado." }, { status: 403 });
  const { id } = await params;
  const document = await buildQuotePdf(id);
  if (!document) return new Response("Orçamento não encontrado.", { status: 404 });
  return pdfResponse(document);
}
