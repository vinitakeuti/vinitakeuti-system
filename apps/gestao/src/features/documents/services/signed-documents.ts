import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sendOwnerEmail } from "@/features/notifications/services/owner-email";
import { logEvent } from "@/features/system-logs/services/system-log";
import { documentKindFromEnum } from "@/features/documents/types/document-kinds";

/**
 * Vias assinadas enviadas pelo cliente no portal: o PDF baixado do portal, assinado no assinador gov.br e enviado de
 * volta. Ficam no banco com limite de tamanho e de envios por documento; o conteúdo só é lido no download. Cada via
 * entra "em conferência" e só conta como assinada depois de aprovada na gestão, no perfil do cliente. Depois de
 * aprovada, o documento não recebe outra via até a gestão excluir a aprovada e pedir um novo envio.
 */
export const MAX_SIGNED_PDF_BYTES = 8 * 1024 * 1024;
const MAX_COPIES_PER_DOCUMENT = 5;

/** Assinador oficial do gov.br (ITI): o cliente entra com a conta gov.br e assina o PDF. */
export const GOV_BR_SIGNER_URL = "https://assinador.iti.br/";

export type SignedTarget = { kind: "proposal"; id: string } | { kind: "document"; id: string };

/** Proposta ou documento concluído do próprio cliente; null quando não existe, é de outro cliente ou é rascunho. */
async function findTarget(clientId: string, target: SignedTarget) {
  const id = target.id.slice(0, 50);
  if (target.kind === "proposal") {
    const quote = await prisma.quote.findFirst({ where: { id, clientId, completedAt: { not: null } }, select: { id: true, code: true, title: true, client: { select: { name: true } } } });
    return quote ? { code: quote.code, title: quote.title, clientName: quote.client.name, where: { quoteId: quote.id }, listPath: "/documentos" } : null;
  }
  // O documento livre é só para leitura no portal: não recebe via assinada.
  const document = await prisma.clientDocument.findFirst({ where: { id, clientId, completedAt: { not: null }, kind: { not: "FREE" } }, select: { id: true, code: true, title: true, kind: true, client: { select: { name: true } } } });
  return document ? { code: document.code, title: document.title, clientName: document.client?.name ?? "", where: { documentId: document.id }, listPath: `/documentos?tipo=${documentKindFromEnum(document.kind).slug}` } : null;
}

type SaveResult = { ok: true; code: string; duplicate: boolean } | { ok: false; error: "documento" | "aprovado" | "tamanho" | "formato" | "limite" };

export async function saveSignedDocument({ clientId, uploadedBy, target, fileName, bytes }: { clientId: string; uploadedBy: string; target: SignedTarget; fileName: string; bytes: Uint8Array }): Promise<SaveResult> {
  const found = await findTarget(clientId, target);
  if (!found) return { ok: false, error: "documento" };
  const latest = await prisma.signedDocument.findFirst({ where: found.where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { reviewStatus: true } });
  if (latest?.reviewStatus === "APPROVED") return { ok: false, error: "aprovado" };
  if (!bytes.length || bytes.length > MAX_SIGNED_PDF_BYTES) return { ok: false, error: "tamanho" };
  if (Buffer.from(bytes.subarray(0, 5)).toString("latin1") !== "%PDF-") return { ok: false, error: "formato" };

  const sha256 = createHash("sha256").update(bytes).digest("hex");
  // O mesmo arquivo enviado de novo não ocupa outro espaço.
  const existing = await prisma.signedDocument.findFirst({ where: { ...found.where, sha256 }, select: { id: true } });
  if (existing) return { ok: true, code: found.code, duplicate: true };
  if ((await prisma.signedDocument.count({ where: found.where })) >= MAX_COPIES_PER_DOCUMENT) return { ok: false, error: "limite" };

  const safeName = fileName.replace(/[^\p{L}\p{N}._ -]+/gu, "").trim().slice(0, 120) || `${found.code}-assinado.pdf`;
  await prisma.signedDocument.create({ data: { clientId, ...found.where, fileName: safeName, byteSize: bytes.length, sha256, data: Buffer.from(bytes), uploadedBy } });
  await logEvent({ event: "portal.document.signed_uploaded", message: `${found.clientName} enviou a via assinada de ${found.code}.`, actorEmail: uploadedBy, metadata: { code: found.code, byteSize: bytes.length } });
  await sendOwnerEmail({ kind: "portal", footer: "Portal do cliente", subject: `Via assinada para conferir: ${found.code} · ${found.clientName}`, title: "Um cliente enviou um documento assinado.", lines: [`Cliente: ${found.clientName}`, `Documento: ${found.code} · ${found.title}`, "Confira o arquivo e aprove ou recuse no perfil do cliente."], path: `/clientes/${clientId}?section=documents` });
  return { ok: true, code: found.code, duplicate: false };
}

export type SignedReviewDecision = "approve" | "reject";

/** Conferência da via na gestão: aprovada conta como assinada; recusada volta para o cliente, com o motivo. */
export async function reviewSignedDocument({ id, decision, reason, reviewer }: { id: string; decision: SignedReviewDecision; reason: string; reviewer: string }) {
  const copy = await prisma.signedDocument.findUnique({ where: { id: id.slice(0, 50) }, select: { id: true, clientId: true, client: { select: { name: true } }, quote: { select: { code: true } }, document: { select: { code: true } } } });
  if (!copy) return null;
  const approved = decision === "approve";
  await prisma.signedDocument.update({ where: { id: copy.id }, data: { reviewStatus: approved ? "APPROVED" : "REJECTED", reviewedAt: new Date(), reviewedBy: reviewer, rejectionReason: approved ? null : reason.slice(0, 300) || null } });
  const code = copy.quote?.code ?? copy.document?.code ?? "documento";
  await logEvent({ source: "gestao", event: approved ? "document.signed_approved" : "document.signed_rejected", message: `Via assinada de ${code} (${copy.client.name}) ${approved ? "aprovada" : "recusada"}.`, actorEmail: reviewer });
  return { clientId: copy.clientId };
}

/**
 * Exclui as vias enviadas para o documento da via informada (a aprovada e as anteriores), para o cliente enviar uma
 * nova: o documento volta a "Para assinar" no portal e o limite de envios recomeça.
 */
export async function discardSignedCopies({ id, reviewer }: { id: string; reviewer: string }) {
  const copy = await prisma.signedDocument.findUnique({ where: { id: id.slice(0, 50) }, select: { clientId: true, quoteId: true, documentId: true, client: { select: { name: true } }, quote: { select: { code: true } }, document: { select: { code: true } } } });
  if (!copy) return null;
  const where = copy.quoteId ? { quoteId: copy.quoteId } : { documentId: copy.documentId };
  const { count } = await prisma.signedDocument.deleteMany({ where: { clientId: copy.clientId, ...where } });
  const code = copy.quote?.code ?? copy.document?.code ?? "documento";
  await logEvent({ source: "gestao", level: "warning", event: "document.signed_discarded", message: `Vias assinadas de ${code} (${copy.client.name}) excluídas para novo envio.`, actorEmail: reviewer, metadata: { code, count } });
  return { clientId: copy.clientId };
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
