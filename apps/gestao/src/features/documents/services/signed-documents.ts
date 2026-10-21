import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sendOwnerEmail } from "@/features/notifications/services/owner-email";
import { logEvent } from "@/features/system-logs/services/system-log";
import { documentKindFromEnum } from "@/features/documents/types/document-kinds";

/**
 * Vias assinadas enviadas pelo cliente no portal: o PDF baixado do portal, assinado no assinador gov.br e enviado de
 * volta. Ficam no banco com limite de tamanho e de envios por documento; o conteúdo só é lido no download.
 */
export const MAX_SIGNED_PDF_BYTES = 8 * 1024 * 1024;
const MAX_COPIES_PER_DOCUMENT = 5;

/** Assinador oficial do gov.br (ITI): o cliente entra com a conta gov.br e assina o PDF. */
export const GOV_BR_SIGNER_URL = "https://assinador.iti.br/";

export type SignedTarget = { kind: "proposal"; id: string } | { kind: "document"; id: string };

/** Assinaturas digitais em PDF (PAdES, como a do gov.br) gravam um dicionário de assinatura com /ByteRange. */
export function hasDigitalSignature(bytes: Uint8Array) {
  const content = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString("latin1");
  return content.includes("/ByteRange") && (content.includes("/Sig") || content.includes("adbe.pkcs7") || content.includes("ETSI.CAdES"));
}

/** Proposta ou documento concluído do próprio cliente; null quando não existe, é de outro cliente ou é rascunho. */
async function findTarget(clientId: string, target: SignedTarget) {
  const id = target.id.slice(0, 50);
  if (target.kind === "proposal") {
    const quote = await prisma.quote.findFirst({ where: { id, clientId, completedAt: { not: null } }, select: { id: true, code: true, title: true, client: { select: { name: true } } } });
    return quote ? { code: quote.code, title: quote.title, clientName: quote.client.name, where: { quoteId: quote.id }, listPath: "/documentos" } : null;
  }
  const document = await prisma.clientDocument.findFirst({ where: { id, clientId, completedAt: { not: null } }, select: { id: true, code: true, title: true, kind: true, client: { select: { name: true } } } });
  return document ? { code: document.code, title: document.title, clientName: document.client.name, where: { documentId: document.id }, listPath: `/documentos?tipo=${documentKindFromEnum(document.kind).slug}` } : null;
}

type SaveResult = { ok: true; code: string; signatureDetected: boolean; duplicate: boolean } | { ok: false; error: "documento" | "tamanho" | "formato" | "limite" };

export async function saveSignedDocument({ clientId, uploadedBy, target, fileName, bytes }: { clientId: string; uploadedBy: string; target: SignedTarget; fileName: string; bytes: Uint8Array }): Promise<SaveResult> {
  const found = await findTarget(clientId, target);
  if (!found) return { ok: false, error: "documento" };
  if (!bytes.length || bytes.length > MAX_SIGNED_PDF_BYTES) return { ok: false, error: "tamanho" };
  if (Buffer.from(bytes.subarray(0, 5)).toString("latin1") !== "%PDF-") return { ok: false, error: "formato" };

  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const signatureDetected = hasDigitalSignature(bytes);
  // O mesmo arquivo enviado de novo não ocupa outro espaço.
  const existing = await prisma.signedDocument.findFirst({ where: { ...found.where, sha256 }, select: { id: true } });
  if (existing) return { ok: true, code: found.code, signatureDetected, duplicate: true };
  if ((await prisma.signedDocument.count({ where: found.where })) >= MAX_COPIES_PER_DOCUMENT) return { ok: false, error: "limite" };

  const safeName = fileName.replace(/[^\p{L}\p{N}._ -]+/gu, "").trim().slice(0, 120) || `${found.code}-assinado.pdf`;
  await prisma.signedDocument.create({ data: { clientId, ...found.where, fileName: safeName, byteSize: bytes.length, sha256, signatureDetected, data: Buffer.from(bytes), uploadedBy } });
  await logEvent({ event: "portal.document.signed_uploaded", message: `${found.clientName} enviou a via assinada de ${found.code}.`, actorEmail: uploadedBy, metadata: { code: found.code, byteSize: bytes.length, signatureDetected } });
  await sendOwnerEmail({ kind: "portal", footer: "Portal do cliente", subject: `Documento assinado: ${found.code} · ${found.clientName}`, title: "Um cliente enviou um documento assinado.", lines: [`Cliente: ${found.clientName}`, `Documento: ${found.code} · ${found.title}`, signatureDetected ? "O PDF tem assinatura digital." : "Atenção: não encontramos assinatura digital no PDF. Confira o arquivo."], path: found.listPath });
  return { ok: true, code: found.code, signatureDetected, duplicate: false };
}

/** Arquivo da via assinada para download; quem chama confere o acesso (cliente dono ou gestão). */
export async function getSignedDocumentFile(id: string) {
  const copy = await prisma.signedDocument.findUnique({ where: { id: id.slice(0, 50) }, select: { clientId: true, data: true, quote: { select: { code: true } }, document: { select: { code: true } } } });
  if (!copy) return null;
  const code = copy.quote?.code ?? copy.document?.code ?? "documento";
  return { clientId: copy.clientId, data: new Uint8Array(copy.data), filename: `${code}-assinado.pdf` };
}

export function signedPdfResponse(file: { data: Uint8Array; filename: string }) {
  return new Response(file.data, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${file.filename}"`, "Cache-Control": "private, no-store" } });
}
