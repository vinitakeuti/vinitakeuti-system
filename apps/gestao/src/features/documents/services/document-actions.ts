"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createDefaultQuoteDocument, QUOTE_DOCUMENT_MAX_JSON_LENGTH } from "@/features/quotes/types/document-content";
import { documentKindEnum, documentKindFromEnum, documentKindFromSlug } from "@/features/documents/types/document-kinds";
import { saveClientDocument } from "@/features/documents/services/client-document-service";
import { discardSignedCopies, reviewSignedDocument } from "@/features/documents/services/signed-documents";
import { requireManagementUser } from "@/features/auth/services/auth-session";

function text(formData: FormData, name: string, max: number) { const value = formData.get(name); return typeof value === "string" ? value.trim().slice(0, max) : ""; }
function errorHref(href: string, message: string) { return `${href}${href.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}`; }

function revalidateDocuments(clientId: string) {
  revalidatePath("/documentos");
  revalidatePath(`/clientes/${clientId}`);
}

/** Cria um contrato, uma cessão ou um memorial para o cliente e abre o editor do documento. */
export async function createClientDocumentAction(formData: FormData) {
  await requireManagementUser();
  const info = documentKindFromSlug(text(formData, "tipo", 20));
  const clientId = text(formData, "clientId", 50);
  if (!info || info.kind === "proposal" || !clientId) redirect("/documentos");
  const backHref = `/documentos?tipo=${info.slug}&clientId=${encodeURIComponent(clientId)}`;
  const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true, name: true } });
  if (!client) redirect(errorHref("/documentos?tipo=" + info.slug, "Cliente não encontrado."));
  const quoteId = text(formData, "quoteId", 50);
  const quote = quoteId ? await prisma.quote.findFirst({ where: { id: quoteId, clientId: client.id }, select: { id: true, title: true } }) : null;
  if (quoteId && !quote) redirect(errorHref(backHref, "A proposta selecionada não pertence a este cliente."));
  const title = text(formData, "title", 180) || quote?.title || "";
  if (!title) redirect(errorHref(backHref, "Dê um título ao documento."));
  const code = `${info.codePrefix}-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
  const document = await prisma.clientDocument.create({
    data: { clientId: client.id, quoteId: quote?.id ?? null, kind: documentKindEnum(info.kind), code, title, documentContent: createDefaultQuoteDocument({ title, clientName: client.name }) },
    select: { id: true },
  });
  revalidateDocuments(client.id);
  redirect(`/documentos/${document.id}/editor`);
}

export async function updateClientDocumentAction(formData: FormData) {
  await requireManagementUser();
  const documentId = text(formData, "documentId", 50);
  // O documento é lido inteiro: cortar o JSON no meio o tornaria inválido e o conteúdo seria perdido.
  const rawField = formData.get("documentContent");
  const serialized = typeof rawField === "string" ? rawField : "";
  if (!documentId || !serialized) redirect("/documentos");
  if (serialized.length > QUOTE_DOCUMENT_MAX_JSON_LENGTH) redirect(errorHref(`/documentos/${documentId}/editor`, "O documento ficou grande demais para salvar."));
  let rawDocument: unknown;
  try {
    rawDocument = JSON.parse(serialized);
  } catch {
    redirect(errorHref(`/documentos/${documentId}/editor`, "O conteúdo do documento não é válido."));
  }
  const intent = text(formData, "intent", 20);
  const complete = intent === "complete";
  const result = await saveClientDocument(documentId, rawDocument, { complete, cleanImages: true });
  if (!result.ok) redirect("/documentos");
  revalidateDocuments(result.document.clientId);
  revalidatePath(`/documentos/${documentId}/editor`);
  if (intent === "template") {
    const record = await prisma.clientDocument.findUnique({ where: { id: documentId }, select: { kind: true } });
    redirect(`/documentos/texto-padrao?tipo=${record ? documentKindFromEnum(record.kind).slug : "contrato"}&documento=${documentId}`);
  }
  redirect(complete ? `/documentos?concluido=${encodeURIComponent(result.document.code)}` : `/documentos/${documentId}/editor?salvo=1`);
}

export async function deleteClientDocumentAction(formData: FormData) {
  await requireManagementUser();
  const documentId = text(formData, "documentId", 50);
  if (!documentId) redirect("/documentos");
  const document = await prisma.clientDocument.findUnique({ where: { id: documentId }, select: { id: true, clientId: true } });
  if (!document) redirect("/documentos");
  await prisma.clientDocument.delete({ where: { id: document.id } });
  revalidateDocuments(document.clientId);
  redirect("/documentos?excluido=1");
}

/** Aprova ou recusa a via assinada enviada pelo cliente e volta para os documentos do perfil. */
export async function reviewSignedDocumentAction(formData: FormData) {
  const user = await requireManagementUser();
  const decision = text(formData, "decision", 10);
  if (decision !== "approve" && decision !== "reject") redirect("/clientes");
  const result = await reviewSignedDocument({ id: text(formData, "id", 50), decision, reason: text(formData, "reason", 300), reviewer: user.email });
  if (!result) redirect("/clientes");
  revalidateDocuments(result.clientId);
  redirect(`/clientes/${result.clientId}?section=documents&conferido=${decision === "approve" ? "aprovado" : "recusado"}`);
}

/** Exclui a via aprovada (e as anteriores) para o cliente enviar uma nova pelo portal. */
export async function discardSignedDocumentAction(formData: FormData) {
  const user = await requireManagementUser();
  const result = await discardSignedCopies({ id: text(formData, "id", 50), reviewer: user.email });
  if (!result) redirect("/clientes");
  revalidateDocuments(result.clientId);
  redirect(`/clientes/${result.clientId}?section=documents&conferido=excluido`);
}
