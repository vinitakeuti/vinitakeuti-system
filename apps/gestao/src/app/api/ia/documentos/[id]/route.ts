import { getManagementUser } from "@/features/auth/services/auth-session";
import { getDocumentAiJob } from "@/features/documents/services/document-ai";

/** Situação de um pedido à Eliza no editor: PENDING, RUNNING, READY (com o resultado) ou FAILED (com o erro). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getManagementUser();
  if (!user) return Response.json({ error: "Não autorizado." }, { status: 403 });
  const job = await getDocumentAiJob((await params).id);
  if (!job) return Response.json({ error: "Pedido não encontrado." }, { status: 404 });
  return Response.json({ status: job.status, mode: job.mode, result: job.status === "READY" ? job.result : null, error: job.status === "FAILED" ? job.error : null }, { headers: { "cache-control": "no-store" } });
}
