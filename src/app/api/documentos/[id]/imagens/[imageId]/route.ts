import { getDocumentImageFile } from "@/features/quotes/services/quote-images";

export async function GET(_: Request, { params }: { params: Promise<{ id: string; imageId: string }> }) {
  const { id, imageId } = await params;
  const image = await getDocumentImageFile({ documentId: id.slice(0, 50) }, imageId);
  if (!image) return new Response("Imagem não encontrada.", { status: 404 });
  // O arquivo de um id nunca muda: pode ficar em cache no navegador.
  return new Response(new Uint8Array(image.data), { headers: { "Content-Type": image.mimeType, "Cache-Control": "private, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" } });
}
