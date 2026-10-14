import { prisma } from "@/lib/prisma";
import { QUOTE_IMAGE_ID_PATTERN } from "@/features/quotes/types/document-content";

export const MAX_QUOTE_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_QUOTE_IMAGES = 40;
/** Imagens fora do documento só são apagadas depois deste prazo, para não perder uma imagem recém-enviada em outra aba. */
const UNUSED_IMAGE_GRACE_MS = 24 * 60 * 60 * 1000;

type ImageInfo = { mimeType: "image/png" | "image/jpeg"; width: number; height: number };

/** Lê tipo e dimensões pelo conteúdo do arquivo (não pela extensão). Só PNG e JPEG, os formatos aceitos pelo PDF. */
export function readImageInfo(bytes: Uint8Array): ImageInfo | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length > 24 && view.getUint32(0) === 0x89504e47 && view.getUint32(4) === 0x0d0a1a0a && view.getUint32(12) === 0x49484452) {
    return { mimeType: "image/png", width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) return null;
      const marker = bytes[offset + 1];
      if (marker === 0xff) { offset += 1; continue; }
      const length = view.getUint16(offset + 2);
      // Marcadores SOF (exceto DHT, JPG e DAC) trazem altura e largura.
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { mimeType: "image/jpeg", width: view.getUint16(offset + 7), height: view.getUint16(offset + 5) };
      }
      offset += 2 + length;
    }
  }
  return null;
}

export type SaveQuoteImageResult = { ok: true; image: { id: string; width: number; height: number } } | { ok: false; status: number; error: string };

export async function saveQuoteImage(quoteId: string, bytes: Uint8Array): Promise<SaveQuoteImageResult> {
  if (!bytes.length || bytes.length > MAX_QUOTE_IMAGE_BYTES) return { ok: false, status: 413, error: "A imagem deve ter até 4 MB." };
  const info = readImageInfo(bytes);
  if (!info || info.width < 1 || info.height < 1 || info.width > 20_000 || info.height > 20_000) return { ok: false, status: 415, error: "Envie uma imagem PNG ou JPEG." };
  const quote = await prisma.quote.findUnique({ where: { id: quoteId }, select: { id: true, _count: { select: { images: true } } } });
  if (!quote) return { ok: false, status: 404, error: "Orçamento não encontrado." };
  if (quote._count.images >= MAX_QUOTE_IMAGES) return { ok: false, status: 409, error: `Limite de ${MAX_QUOTE_IMAGES} imagens por orçamento.` };
  const image = await prisma.quoteImage.create({ data: { quoteId, mimeType: info.mimeType, width: info.width, height: info.height, byteSize: bytes.length, data: Buffer.from(bytes) }, select: { id: true, width: true, height: true } });
  return { ok: true, image };
}

export async function getQuoteImageFile(quoteId: string, imageId: string) {
  if (!QUOTE_IMAGE_ID_PATTERN.test(imageId)) return null;
  return prisma.quoteImage.findFirst({ where: { id: imageId, quoteId }, select: { mimeType: true, data: true } });
}

/** Imagens usadas no documento, no formato que o gerador de PDF recebe. */
export async function getQuoteImagesForPdf(quoteId: string, imageIds: string[]) {
  const ids = Array.from(new Set(imageIds)).slice(0, MAX_QUOTE_IMAGES);
  if (!ids.length) return {};
  const images = await prisma.quoteImage.findMany({ where: { quoteId, id: { in: ids } }, take: MAX_QUOTE_IMAGES, select: { id: true, mimeType: true, data: true } });
  return Object.fromEntries(images.map((image) => [image.id, { data: Buffer.from(image.data), format: image.mimeType === "image/png" ? "png" as const : "jpg" as const }]));
}

/** Remove imagens que saíram do documento salvo há mais de um dia. */
export async function deleteUnusedQuoteImages(quoteId: string, usedImageIds: string[]) {
  await prisma.quoteImage.deleteMany({ where: { quoteId, id: { notIn: usedImageIds }, createdAt: { lt: new Date(Date.now() - UNUSED_IMAGE_GRACE_MS) } } });
}
