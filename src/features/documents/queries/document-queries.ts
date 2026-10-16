import { prisma } from "@/lib/prisma";
import { documentKindEnum, type DocumentKind } from "@/features/documents/types/document-kinds";

const PAGE_SIZE = 50;

/** Documentos produzidos (contrato, cessão e memorial), do mais recente para o mais antigo, com paginação por cursor. */
export async function listClientDocuments(input: { cursor?: string; kind?: Exclude<DocumentKind, "proposal"> | null; pending?: boolean }) {
  const cursor = input.cursor?.slice(0, 50);
  const records = await prisma.clientDocument.findMany({
    where: { ...(input.kind ? { kind: documentKindEnum(input.kind) } : {}), ...(input.pending ? { completedAt: null } : {}) },
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    select: { id: true, code: true, title: true, kind: true, completedAt: true, createdAt: true, updatedAt: true, client: { select: { id: true, name: true, company: true } } },
  });
  const hasMore = records.length > PAGE_SIZE;
  const data = hasMore ? records.slice(0, PAGE_SIZE) : records;
  return { data, nextCursor: hasMore ? data.at(-1)?.id ?? null : null };
}

export async function getClientDocumentForEditor(id: string) {
  return prisma.clientDocument.findUnique({
    where: { id: id.slice(0, 50) },
    select: {
      id: true, code: true, title: true, kind: true, documentContent: true, createdAt: true, updatedAt: true, completedAt: true,
      client: { select: { id: true, name: true, company: true, document: true, email: true } },
      quote: { select: { id: true, code: true, title: true, items: { orderBy: { createdAt: "asc" }, take: 50, select: { id: true, name: true, categoryName: true, proposalText: true } } } },
    },
  });
}

/** Propostas do cliente que podem servir de referência para um documento (trazem os serviços). */
export async function listClientQuotesForDocument(clientId: string) {
  return prisma.quote.findMany({ where: { clientId }, take: 20, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true, code: true, title: true, createdAt: true } });
}

/** Documentos de um cliente para o perfil: propostas e demais documentos, os mais recentes primeiro. */
export async function getClientDocumentsForProfile(clientId: string) {
  return prisma.clientDocument.findMany({ where: { clientId }, take: 100, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], select: { id: true, code: true, title: true, kind: true, completedAt: true, updatedAt: true } });
}

export async function getClientDocumentReturn(documentId?: string) {
  if (!documentId || !/^[a-z0-9]{1,50}$/i.test(documentId)) return null;
  return prisma.clientDocument.findUnique({ where: { id: documentId }, select: { id: true, code: true, kind: true } });
}

/** Propostas comerciais na área de Documentos, das mais recentes para as mais antigas, com paginação por cursor. */
export async function listQuotesForDocuments(input: { cursor?: string; pending?: boolean }) {
  const cursor = input.cursor?.slice(0, 50);
  const records = await prisma.quote.findMany({
    where: input.pending ? { completedAt: null } : {},
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    select: { id: true, code: true, title: true, amountCents: true, completedAt: true, createdAt: true, updatedAt: true, client: { select: { id: true, name: true, company: true } } },
  });
  const hasMore = records.length > PAGE_SIZE;
  const data = hasMore ? records.slice(0, PAGE_SIZE) : records;
  return { data, nextCursor: hasMore ? data.at(-1)?.id ?? null : null };
}
