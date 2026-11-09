import { after } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AiProviderError, type AiToolSpec, type JsonSchema } from "@/lib/integrations/ai/types";
import { logEvent } from "@/features/system-logs/services/system-log";
import { getAiSettingsView, loadAiRuntime } from "@/features/ai/services/ai-settings";
import { aiUsageToday, completeWithTool } from "@/features/ai/services/ai-structured";
import { editorMarkdownGuide, markdownToEditorParts, richTextToMarkdown, type EditorPart } from "@/features/ai/services/document-markdown";
import { documentKindFromEnum, documentKindInfo, type DocumentKind } from "@/features/documents/types/document-kinds";
import { getProfessionalProfile } from "@/features/professional-profile/queries/professional-profile-queries";
import { getDocumentTextTemplate } from "@/features/quotes/queries/quote-text-template-queries";

/**
 * A Eliza no editor de PDF (propostas e documentos), sempre fora da requisição, com novas tentativas pelo agendador:
 * - WRITE: escreve o documento a partir de um pedido;
 * - IMPROVE: analisa os textos atuais e devolve as observações e a versão aperfeiçoada dos trechos que mudam.
 * A IA escreve no Markdown do editor (document-markdown.ts), com molduras, listas, cores e componentes, e o resultado
 * volta em pedaços (textos e componentes). Nada entra no documento sozinho: o editor mostra a prévia e você aplica.
 */

export const DOCUMENT_AI_LIMITS = { prompt: 20_000, items: 400, blocks: 80, sourceCharacters: 60_000 } as const;
const MAX_ATTEMPTS = 3;
const STUCK_AFTER_MS = 10 * 60_000;
const BATCH = 2;
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export class DocumentAiError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

export type DocumentAiTarget = { quoteId: string } | { documentId: string };
export type DocumentAiWriteResult = { parts: EditorPart[]; notes: string[] };
export type DocumentAiImproveResult = { notes: string[]; summary: string; blocks: { id: string; parts: EditorPart[] }[] };
/** Blocos do documento na ordem do editor: textos editáveis e, entre eles, componentes que a IA só lê. */
export type DocumentAiSourceInput = { id: string; kind: "text" | "line" | "accent" | "page-break" | "image" | "fixed"; text: string };
type SourceItem = { id: string; markdown: string } | { marker: string };

/** Como cada componente aparece para a IA na revisão (ela não os altera). */
function sourceMarker(item: DocumentAiSourceInput) {
  if (item.kind === "line") return "[componente: linha divisória]";
  if (item.kind === "accent") return "[componente: linha de destaque]";
  if (item.kind === "page-break") return "[componente: quebra de página]";
  if (item.kind === "image") return "[imagem]";
  if (item.id === "services-label") return "[componente: serviços incluídos]";
  if (item.id.startsWith("service-category-")) return null;
  const text = item.text.replace(/\s+/g, " ").trim().slice(0, 200);
  if (!text) return null;
  return item.id.startsWith("service-title-") ? `[serviço: ${text}]` : `[texto fixo: ${text}]`;
}

/** Modelo que trabalha nos documentos (o de Documentos em Integrações ou, sem ele, o da Gestão). */
export async function documentAiModel() {
  const settings = await getAiSettingsView();
  const connected = Boolean(settings?.isActive && settings.keyHint && settings.model);
  return { connected, model: connected ? settings!.documentModel || settings!.model : null, own: Boolean(connected && settings!.documentModel) };
}

/** Põe o pedido na fila. Recusa com a IA desligada, no limite diário ou com outro pedido do mesmo documento em andamento. */
export async function enqueueDocumentAiJob(input: { target: DocumentAiTarget; mode: "WRITE" | "IMPROVE"; prompt: string; blocks: DocumentAiSourceInput[] }) {
  const loaded = await loadAiRuntime();
  if (!loaded.ok) throw new DocumentAiError(loaded.error, 503);
  if (loaded.runtime.dailyRunLimit !== null && await aiUsageToday() >= loaded.runtime.dailyRunLimit) throw new DocumentAiError("O limite diário de uso da IA foi atingido. Tente amanhã.", 429);

  const exists = "quoteId" in input.target ? await prisma.quote.count({ where: { id: input.target.quoteId } }) : await prisma.clientDocument.count({ where: { id: input.target.documentId } });
  if (!exists) throw new DocumentAiError("Documento não encontrado.", 404);

  const prompt = input.prompt.trim().slice(0, DOCUMENT_AI_LIMITS.prompt);
  let source: SourceItem[] | null = null;
  if (input.mode === "WRITE") {
    if (prompt.length < 10) throw new DocumentAiError("Descreva o documento que a Eliza deve escrever.");
  } else {
    source = input.blocks.slice(0, DOCUMENT_AI_LIMITS.items).flatMap((item): SourceItem[] => {
      if (item.kind !== "text") {
        const marker = sourceMarker(item);
        return marker ? [{ marker }] : [];
      }
      const markdown = richTextToMarkdown(item.text);
      return markdown.trim() ? [{ id: item.id, markdown }] : [];
    });
    const editable = source.filter((item) => "id" in item);
    if (!editable.length) throw new DocumentAiError("O documento ainda não tem texto para a Eliza analisar. Use Escrever.");
    if (editable.length > DOCUMENT_AI_LIMITS.blocks) throw new DocumentAiError("O documento tem trechos demais para a Eliza revisar de uma vez.");
    if (editable.reduce((sum, item) => sum + item.markdown.length, 0) > DOCUMENT_AI_LIMITS.sourceCharacters) throw new DocumentAiError("O texto passa do tamanho que a Eliza consegue revisar de uma vez (60 mil caracteres).");
  }

  const key = "quoteId" in input.target ? `quote:${input.target.quoteId}` : `document:${input.target.documentId}`;
  const job = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`document-ai:${key}`}))`;
    const busy = await tx.documentAiJob.findFirst({ where: { ...("quoteId" in input.target ? { quoteId: input.target.quoteId } : { documentId: input.target.documentId }), status: { in: ["PENDING", "RUNNING"] } }, select: { id: true } });
    if (busy) throw new DocumentAiError("A Eliza já está trabalhando neste documento. Aguarde a resposta.", 409);
    return tx.documentAiJob.create({ data: { ...input.target, mode: input.mode, prompt, source: source ? (source as unknown as Prisma.InputJsonValue) : undefined }, select: { id: true } });
  });
  try { after(() => processDocumentAiJobs()); } catch { /* fora de uma requisição: o agendador processa */ }
  return job.id;
}

/** Situação do pedido para o editor: só o que ele precisa mostrar. */
export async function getDocumentAiJob(id: string) {
  return prisma.documentAiJob.findUnique({ where: { id: id.slice(0, 50) }, select: { id: true, mode: true, status: true, result: true, error: true } });
}

/** Processa a fila. Chamado depois das requisições e pelo agendador (a cada minuto). */
export async function processDocumentAiJobs() {
  await prisma.documentAiJob.updateMany({ where: { status: "RUNNING", startedAt: { lt: new Date(Date.now() - STUCK_AFTER_MS) } }, data: { status: "PENDING" } });
  const due = await prisma.documentAiJob.findMany({ where: { status: "PENDING" }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: BATCH, select: { id: true } });
  for (const { id } of due) {
    const claimed = await prisma.documentAiJob.updateMany({ where: { id, status: "PENDING" }, data: { status: "RUNNING", startedAt: new Date(), attempts: { increment: 1 } } });
    if (!claimed.count) continue;
    try {
      await runJob(id);
    } catch (error) {
      const job = await prisma.documentAiJob.findUnique({ where: { id }, select: { attempts: true } });
      const retry = error instanceof AiProviderError && error.retryable && (job?.attempts ?? MAX_ATTEMPTS) < MAX_ATTEMPTS;
      const message = (error instanceof Error ? error.message : String(error)).slice(0, 500);
      await prisma.documentAiJob.update({ where: { id }, data: retry ? { status: "PENDING", error: message } : { status: "FAILED", error: message, finishedAt: new Date() } });
      if (!retry) await logEvent({ source: "sistema", level: "error", event: "document.ai.failed", message: `A Eliza não concluiu um pedido no editor de documentos: ${message}` });
    }
  }
}

/** Retenção: pedidos com mais de 30 dias saem do banco (o texto aplicado já está no documento). */
export async function pruneDocumentAiJobs(now = new Date()) {
  return (await prisma.documentAiJob.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - RETENTION_MS) } } })).count;
}

/* Contexto ------------------------------------------------------------------------------------------------------ */

type Context = { kind: DocumentKind; title: string; client: string | null; services: string[]; professional: string; template: string | null };

const TEMPLATE_PREVIEW_CHARACTERS = 4_000;

async function loadContext(job: { quoteId: string | null; documentId: string | null }): Promise<Context> {
  const profile = await getProfessionalProfile();
  const professional = profile?.name?.trim() || "Vinicius Riudi";
  const templateOf = async (kind: DocumentKind) => {
    const template = await getDocumentTextTemplate(documentKindInfo(kind).templateId);
    const markdown = template?.content ? richTextToMarkdown(template.content).trim() : "";
    return markdown ? markdown.slice(0, TEMPLATE_PREVIEW_CHARACTERS) : null;
  };
  if (job.quoteId) {
    const quote = await prisma.quote.findUnique({ where: { id: job.quoteId }, select: { title: true, client: { select: { name: true, company: true } }, items: { take: 40, orderBy: { createdAt: "asc" }, select: { name: true, quantity: true } } } });
    if (!quote) throw new Error("Proposta não encontrada.");
    return { kind: "proposal", title: quote.title, client: quote.client.company ?? quote.client.name, services: quote.items.map((item) => `${item.name}${item.quantity > 1 ? ` (${item.quantity})` : ""}`), professional, template: await templateOf("proposal") };
  }
  const document = await prisma.clientDocument.findUnique({ where: { id: job.documentId ?? "" }, select: { title: true, kind: true, client: { select: { name: true, company: true } }, quote: { select: { title: true, items: { take: 40, orderBy: { createdAt: "asc" }, select: { name: true } } } } } });
  if (!document) throw new Error("Documento não encontrado.");
  const kind = documentKindFromEnum(document.kind).kind;
  return { kind, title: document.title, client: document.client ? document.client.company ?? document.client.name : null, services: document.quote?.items.map((item) => item.name) ?? [], professional, template: await templateOf(kind) };
}

const KIND_GUIDANCE: Record<DocumentKind, string> = {
  proposal: "É uma proposta comercial. Estrutura sugerida: apresentação curta, entendimento da necessidade do cliente, solução proposta, o que está incluído, etapas e prazos (bom lugar para a lista de etapas), próximos passos. Não escreva valores, formas de pagamento nem o aceite: a página final do PDF já traz investimento, condições e aceite gerados do orçamento.",
  contract: "É um contrato de prestação de serviço. Use cláusulas numeradas com título (### CLÁUSULA 1ª – DO OBJETO), em linguagem jurídica clara: objeto, obrigações das partes, prazos, pagamento (sem inventar valores: use [valor] e [condições] quando não informados), propriedade intelectual, confidencialidade, rescisão, foro. Não escreva a folha de assinaturas nem o cabeçalho com os dados das partes: o PDF já traz.",
  assignment: "É um termo de cessão de direitos de propriedade (código, layouts, marcas). Cláusulas numeradas: objeto da cessão, abrangência, momento da transferência, garantias, declarações, foro. Não escreva a folha de assinaturas: o PDF já traz.",
  memorial: "É um memorial técnico / documentação do projeto: visão geral, arquitetura, tecnologias, funcionalidades entregues, acessos e hospedagem, manutenção e próximos passos. Objetivo e organizado em seções.",
  free: "É um documento livre: siga o formato que o pedido indicar (declaração, relatório, comunicado, termo).",
};

function contextLines(context: Context) {
  return [
    `Tipo: ${documentKindInfo(context.kind).name}.`,
    `Título: ${context.title}.`,
    context.client ? `Cliente: ${context.client}.` : "Sem cliente vinculado.",
    `Quem assina e presta o serviço: ${context.professional}.`,
    context.services.length ? `Serviços contratados: ${context.services.join("; ")}.` : "",
  ].filter(Boolean).join("\n");
}

const COMMON_RULES = [
  "Escreva em português do Brasil, com tom profissional, claro e direto, sem emojis.",
  "Não invente dados (nomes, valores, datas, CNPJ, endereços, prazos). Quando faltar algo, use um marcador entre colchetes, como [prazo de entrega], e cite o ponto em observacoes.",
];

/* Execução ------------------------------------------------------------------------------------------------------ */

const str = (value: unknown, max: number) => typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
const notesOf = (value: unknown) => (Array.isArray(value) ? value : []).map((item) => str(item, 400)).filter(Boolean).slice(0, 12);
const markdownOf = (value: unknown) => typeof value === "string" ? value.replace(/\r\n?/g, "\n").trim() : "";
const hasText = (parts: EditorPart[]) => parts.some((part) => part.type === "text");

const WRITE_TOOL: AiToolSpec = {
  name: "escrever_documento",
  description: "Entrega o texto do documento.",
  parameters: { type: "object", properties: {
    texto: { type: "string", description: "Documento completo no Markdown do editor de PDF." },
    observacoes: { type: "array", items: { type: "string" }, description: "Pontos para Vinicius confirmar ou completar (dados que faltaram, premissas assumidas)." },
  }, required: ["texto"] } as JsonSchema,
};

const IMPROVE_TOOL: AiToolSpec = {
  name: "aperfeicoar_documento",
  description: "Entrega a análise do texto e a versão aperfeiçoada dos trechos que mudam.",
  parameters: { type: "object", properties: {
    analise: { type: "array", items: { type: "string" }, description: "O que você encontrou: erros, trechos confusos, lacunas, riscos, cláusulas ou informações que faltam. Frases curtas." },
    resumo: { type: "string", description: "Em uma ou duas frases, o que mudou na versão aperfeiçoada." },
    trechos: { type: "array", description: "Somente os trechos que mudaram, com o mesmo id recebido e o texto completo do trecho já aperfeiçoado.", items: { type: "object", properties: {
      id: { type: "string" },
      texto: { type: "string", description: "Texto completo do trecho, no Markdown do editor de PDF." },
    }, required: ["id", "texto"] } },
  }, required: ["analise", "trechos"] } as JsonSchema,
};

async function runJob(id: string) {
  const job = await prisma.documentAiJob.findUnique({ where: { id }, select: { id: true, mode: true, prompt: true, source: true, quoteId: true, documentId: true } });
  if (!job) return;
  const context = await loadContext(job);
  const record = (usage: { model: string; inputTokens: number; outputTokens: number; costMicros: number | null }) => prisma.documentAiJob.update({ where: { id: job.id }, data: { model: usage.model, inputTokens: { increment: usage.inputTokens }, outputTokens: { increment: usage.outputTokens }, ...(usage.costMicros !== null ? { costMicros: usage.costMicros } : {}) } });
  const call = async (input: Parameters<typeof completeWithTool>[0]) => {
    try {
      const result = await completeWithTool(input);
      await record(result);
      return result.input;
    } catch (error) {
      const usage = (error as { usage?: Parameters<typeof record>[0] }).usage;
      if (usage) await record(usage);
      throw error;
    }
  };

  if (job.mode === "WRITE") {
    const allowed = (part: EditorPart) => part.type === "services" ? context.services.length > 0 : part.type === "template" ? Boolean(context.template) : true;
    const system = [`Você é a Eliza, assistente de ${context.professional}, desenvolvedor de software, e escreve documentos para ele no editor de PDF do sistema.`, KIND_GUIDANCE[context.kind], ...COMMON_RULES, editorMarkdownGuide({ services: context.services.length > 0, template: context.template }), "Escreva o documento completo, pronto para revisão. Comece pelo conteúdo: o PDF já tem capa e cabeçalho com o título.", `Responda chamando a ferramenta ${WRITE_TOOL.name} uma única vez.`].join("\n");
    const raw = await call({ task: "document", system, user: `${contextLines(context)}\n\nPedido de ${context.professional}:\n${job.prompt}`, tool: WRITE_TOOL, maxTokens: 12_000, timeoutMs: 300_000, temperature: 0.4 });
    const parts = markdownToEditorParts(markdownOf(raw.texto)).filter(allowed);
    if (!hasText(parts)) throw new Error("A Eliza não escreveu o texto do documento.");
    const result: DocumentAiWriteResult = { parts, notes: notesOf(raw.observacoes) };
    await prisma.documentAiJob.update({ where: { id: job.id }, data: { status: "READY", result: result as unknown as Prisma.InputJsonValue, error: null, finishedAt: new Date() } });
    return;
  }

  const source = (Array.isArray(job.source) ? job.source : []) as SourceItem[];
  const editable = new Map(source.flatMap((item) => "id" in item ? [[item.id, item.markdown] as const] : []));
  // O componente de serviços só pode entrar se ainda não estiver no documento.
  const services = context.services.length > 0 && !source.some((item) => "marker" in item && item.marker === "[componente: serviços incluídos]");
  const system = [
    `Você é a Eliza, assistente de ${context.professional}, desenvolvedor de software, e revisa documentos no editor de PDF do sistema.`,
    KIND_GUIDANCE[context.kind],
    ...COMMON_RULES,
    editorMarkdownGuide({ services }),
    "Analise o texto: correção do português, clareza, organização, tom, coerência com o tipo de documento, lacunas e riscos (em contratos e cessões, cláusulas importantes que faltam ou estão ambíguas). Avalie também a apresentação: se títulos, listas, molduras e componentes ajudam a leitura.",
    "Depois aperfeiçoe: mantenha o sentido, os dados e os fatos do autor; corrija, reorganize e complete o que for necessário. Preserve os marcadores de dados entre colchetes, como [prazo]. Não acrescente compromissos, valores ou prazos que o autor não escreveu.",
    "Mantenha a formatação que o autor escolheu (molduras, aparência das listas, cores, alinhamento), a menos que a orientação peça outra coisa ou que mudar melhore claramente a leitura. Use os recursos do formato onde ajudarem.",
    "O documento vem na ordem, dividido em trechos com id. Entre eles aparecem, entre colchetes, imagens, componentes e textos fixos: você não os altera, eles servem para você entender a ordem do documento. Devolva somente os trechos que mudaram, cada um com o texto completo já aperfeiçoado e o mesmo id. Um trecho pode ganhar componentes (como {quebra de página}) entre os parágrafos.",
    `Responda chamando a ferramenta ${IMPROVE_TOOL.name} uma única vez.`,
  ].join("\n");
  const user = `${contextLines(context)}\n\n${job.prompt ? `Orientação de ${context.professional} para a revisão: ${job.prompt}\n\n` : ""}Documento atual, na ordem:\n${source.map((item) => "marker" in item ? item.marker : `<<<trecho id="${item.id}">>>\n${item.markdown}\n<<<fim>>>`).join("\n\n")}`;
  const sourceTokens = Math.ceil([...editable.values()].reduce((sum, markdown) => sum + markdown.length, 0) / 3);
  const raw = await call({ task: "document", system, user, tool: IMPROVE_TOOL, maxTokens: Math.min(16_000, Math.max(3_000, Math.round(sourceTokens * 1.4))), timeoutMs: 300_000 });
  const seen = new Set<string>();
  const blocks = (Array.isArray(raw.trechos) ? raw.trechos : []).flatMap((item) => {
    const entry = (item ?? {}) as Record<string, unknown>;
    const blockId = typeof entry.id === "string" ? entry.id : "";
    const markdown = markdownOf(entry.texto);
    // Só trechos que existem, uma vez cada, e que de fato mudaram.
    if (!editable.has(blockId) || seen.has(blockId) || !markdown || markdown === editable.get(blockId)!.trim()) return [];
    seen.add(blockId);
    const parts = markdownToEditorParts(markdown).filter((part) => part.type !== "template" && (part.type !== "services" || services));
    return hasText(parts) ? [{ id: blockId, parts }] : [];
  });
  const result: DocumentAiImproveResult = { notes: notesOf(raw.analise), summary: str(raw.resumo, 600), blocks };
  if (!result.notes.length && !blocks.length) throw new Error("A Eliza não devolveu a análise do texto.");
  await prisma.documentAiJob.update({ where: { id: job.id }, data: { status: "READY", result: result as unknown as Prisma.InputJsonValue, error: null, finishedAt: new Date() } });
}
