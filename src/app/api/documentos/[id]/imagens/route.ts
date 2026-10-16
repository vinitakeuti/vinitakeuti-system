import { MAX_QUOTE_IMAGE_BYTES, saveDocumentImage } from "@/features/quotes/services/quote-images";

/** Recebe uma imagem para o PDF do documento (multipart, campo "file"). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (Number(request.headers.get("content-length") ?? 0) > MAX_QUOTE_IMAGE_BYTES + 64 * 1024) return Response.json({ error: "A imagem deve ter até 4 MB." }, { status: 413 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Nenhuma imagem enviada." }, { status: 400 });
  const result = await saveDocumentImage({ documentId: id.slice(0, 50) }, new Uint8Array(await file.arrayBuffer()));
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  return Response.json(result.image, { status: 201 });
}
