import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { defineTool, day } from "@/features/ai/tools/tool";
import { object, s } from "@/features/ai/tools/schema";
import { documentContentToMarkdown, markdownToDocumentContent } from "@/features/ai/services/document-markdown";
import { documentKindEnum, documentKindFromEnum, documentKindFromSlug } from "@/features/documents/types/document-kinds";
import { createDefaultQuoteDocument, defaultFreeCover, parseQuoteDocumentContent } from "@/features/quotes/types/document-content";
import { saveClientDocument } from "@/features/documents/services/client-document-service";

/**
 * Documentos de texto (contrato, cessão, memorial e livre) escritos pela IA. Ela só cria e revisa RASCUNHOS:
 * concluir (o que publica o documento para o cliente e dispara o e-mail) continua sendo uma decisão sua, no editor.
 */

const KIND_SLUGS = ["contrato", "cessao", "memorial", "livre"] as const;
const MARKDOWN_HELP = "Texto em Markdown: # título, ## subtítulo, ### rótulo de seção, listas com - ou 1., **negrito** e *itálico*. Parágrafos separados por linha em branco. Não repita o cabeçalho com seus dados nem a folha de assinaturas: o documento já tem.";

function refreshDocuments(clientId: string | null, documentId?: string) {
  try {
    revalidatePath("/documentos");
    if (clientId) revalidatePath(`/clientes/${clientId}`);
    if (documentId) revalidatePath(`/documentos/${documentId}/editor`);
  } catch { /* fora de uma requisição */ }
}

export const documentTools = [
  defineTool({
    name: "documentos_listar",
    description: "Lista contratos, cessões, memoriais técnicos e documentos livres (mais recentes primeiro), com situação rascunho ou concluído. Filtra por cliente, tipo ou texto do título.",
    scopes: ["owner"],
    mutates: false,
    input: object({ cliente_id: s.optional(s.id()), tipo: s.optional(s.enum(KIND_SLUGS)), busca: s.optional(s.string({ max: 120 })) }),
    async run(input) {
      const info = input.tipo ? documentKindFromSlug(input.tipo) : null;
      const documents = await prisma.clientDocument.findMany({
        where: { ...(input.cliente_id ? { clientId: input.cliente_id } : {}), ...(info && info.kind !== "proposal" ? { kind: documentKindEnum(info.kind) } : {}), ...(input.busca ? { title: { contains: input.busca, mode: "insensitive" as const } } : {}) },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: 25,
        select: { id: true, code: true, title: true, kind: true, completedAt: true, updatedAt: true, client: { select: { id: true, name: true } } },
      });
      return { documentos: documents.map((document) => ({ id: document.id, codigo: document.code, titulo: document.title, tipo: documentKindFromEnum(document.kind).shortName, cliente: document.client?.name ?? null, situacao: document.completedAt ? "concluido" : "rascunho", atualizado_em: day(document.updatedAt), editor: `/documentos/${document.id}/editor` })) };
    },
  }),

  defineTool({
    name: "documentos_ler",
    description: "Lê o texto de um documento (em Markdown), para revisar ou responder sobre ele.",
    scopes: ["owner"],
    mutates: false,
    input: object({ documento_id: s.id() }),
    async run(input) {
      const document = await prisma.clientDocument.findUnique({ where: { id: input.documento_id }, select: { id: true, code: true, title: true, kind: true, completedAt: true, documentContent: true, client: { select: { name: true } } } });
      if (!document) return { erro: "Documento não encontrado." };
      const content = parseQuoteDocumentContent(document.documentContent, { title: document.title, clientName: document.client?.name ?? "" });
      return { id: document.id, codigo: document.code, titulo: document.title, tipo: documentKindFromEnum(document.kind).shortName, cliente: document.client?.name ?? null, situacao: document.completedAt ? "concluido" : "rascunho", texto: documentContentToMarkdown(content) };
    },
  }),

  defineTool({
    name: "documentos_criar",
    description: `Cria um documento como RASCUNHO no editor de documentos, já com o texto. Contrato, cessão e memorial exigem cliente; o livre pode ser sem cliente. Depois de criar, informe o link do editor para revisar e concluir. ${MARKDOWN_HELP}`,
    scopes: ["owner"],
    mutates: true,
    confirm: false,
    input: object({
      tipo: s.enum(KIND_SLUGS),
      titulo: s.string({ min: 2, max: 180 }),
      cliente_id: s.optional(s.id({ description: "Use clientes_buscar para achar o id" })),
      proposta_id: s.optional(s.id({ description: "Proposta do cliente a que o documento se refere" })),
      conteudo: s.longText({ max: 60_000, description: MARKDOWN_HELP }),
    }),
    async run(input) {
      const info = documentKindFromSlug(input.tipo);
      if (!info || info.kind === "proposal") return { erro: "Tipo de documento inválido." };
      if (info.requiresClient && !input.cliente_id) return { erro: `${info.shortName} precisa de um cliente. Use clientes_buscar para achar o id.` };
      const client = input.cliente_id ? await prisma.client.findUnique({ where: { id: input.cliente_id }, select: { id: true, name: true } }) : null;
      if (input.cliente_id && !client) return { erro: "Cliente não encontrado." };
      const quote = client && input.proposta_id ? await prisma.quote.findFirst({ where: { id: input.proposta_id, clientId: client.id }, select: { id: true } }) : null;
      if (input.proposta_id && !quote) return { erro: "A proposta não pertence a este cliente." };
      const code = `${info.codePrefix}-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
      const cover = info.kind === "free" ? defaultFreeCover(input.titulo) : undefined;
      const document = await prisma.clientDocument.create({
        data: { clientId: client?.id ?? null, quoteId: quote?.id ?? null, kind: documentKindEnum(info.kind), code, title: input.titulo, documentContent: { ...createDefaultQuoteDocument({ title: input.titulo, clientName: client?.name ?? "" }), ...(cover ? { cover } : {}) } },
        select: { id: true },
      });
      // Grava o texto pelo mesmo caminho do editor (validação e limites iguais).
      const saved = await saveClientDocument(document.id, markdownToDocumentContent(input.conteudo, { cover }));
      if (!saved.ok) return { erro: saved.error, id: document.id };
      refreshDocuments(client?.id ?? null, document.id);
      return { feito: true, id: document.id, codigo: code, situacao: "rascunho", editor: `/documentos/${document.id}/editor` };
    },
  }),

  defineTool({
    name: "documentos_reescrever",
    description: `Substitui o texto de um documento em RASCUNHO (documentos concluídos não são alterados). Leia antes com documentos_ler para preservar o que não deve mudar. ${MARKDOWN_HELP}`,
    scopes: ["owner"],
    mutates: true,
    confirm: false,
    input: object({ documento_id: s.id(), conteudo: s.longText({ max: 60_000, description: MARKDOWN_HELP }) }),
    async run(input) {
      const document = await prisma.clientDocument.findUnique({ where: { id: input.documento_id }, select: { id: true, clientId: true, title: true, completedAt: true, documentContent: true, client: { select: { name: true } } } });
      if (!document) return { erro: "Documento não encontrado." };
      if (document.completedAt) return { erro: "O documento já foi concluído e está com o cliente. Crie um novo documento em vez de alterar este." };
      const current = parseQuoteDocumentContent(document.documentContent, { title: document.title, clientName: document.client?.name ?? "" });
      const saved = await saveClientDocument(document.id, markdownToDocumentContent(input.conteudo, { cover: current.cover }));
      if (!saved.ok) return { erro: saved.error };
      refreshDocuments(document.clientId, document.id);
      return { feito: true, id: document.id, editor: `/documentos/${document.id}/editor` };
    },
  }),
];
