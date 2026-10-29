import { getClientUser } from "@/features/auth/services/auth-session";
import { MAX_SIGNED_PDF_BYTES, saveSignedDocument } from "@/features/documents/services/signed-documents";

/** Volta para Documentos com o resultado (endereço relativo: funciona atrás do proxy do Easypanel). */
function back(query: string) {
  return new Response(null, { status: 303, headers: { Location: `/documentos?${query}` } });
}

/** Via assinada enviada pelo formulário de Documentos do portal (multipart: kind, id e file). */
export async function POST(request: Request) {
  const user = await getClientUser();
  if (!user) return Response.json({ error: "Não autorizado." }, { status: 403 });
  if (Number(request.headers.get("content-length") ?? 0) > MAX_SIGNED_PDF_BYTES + 64 * 1024) return back("erro=tamanho");
  const form = await request.formData().catch(() => null);
  const kind = form?.get("kind");
  const id = form?.get("id");
  const file = form?.get("file");
  if ((kind !== "proposal" && kind !== "document") || typeof id !== "string" || !id) return back("erro=documento");
  if (!(file instanceof File) || !file.size) return back("erro=arquivo");
  const result = await saveSignedDocument({ clientId: user.clientId!, uploadedBy: user.email, target: { kind, id }, fileName: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
  if (!result.ok) return back(`erro=${result.error}`);
  return back(`enviado=${encodeURIComponent(result.code)}`);
}
