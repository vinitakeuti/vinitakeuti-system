import { after } from "next/server";
import { Prisma, ProjectAiJobKind, ProjectTaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AiProviderError, type AiCompletion, type AiToolSpec, type JsonSchema } from "@/lib/integrations/ai/types";
import { logEvent } from "@/features/system-logs/services/system-log";
import { loadAiRuntime } from "@/features/ai/services/ai-settings";
import { costOf } from "@/features/ai/services/agent";
import type { PlanDraft } from "@/features/projects/services/project-service";
import { PROJECT_LIMITS, percentOf, projectStatusLabel, taskStatusLabel, todayKey, weightOfSize } from "@/features/projects/types/project";

/**
 * A Eliza nos projetos, sempre fora da requisição (fila própria, com novas tentativas pelo agendador):
 * - PLAN: destrincha a descrição do projeto em funcionalidades e subatividades com peso;
 * - DAY: lê o resumo do dia e indica quais subatividades foram concluídas ou avançaram;
 * - UPDATE: redige a atualização ao cliente a partir do diário.
 * O resultado nunca altera o projeto sozinho: vira um rascunho (READY) para revisar, e a atualização vira rascunho
 * em Atualizações. Usa o modelo principal da gestão e soma o custo no painel da IA.
 */

const MAX_ATTEMPTS = 3;
const STUCK_AFTER_MS = 10 * 60_000;
const BATCH = 2;
const WEEK = 7 * 24 * 60 * 60 * 1000;

export class ProjectAiError extends Error {}

function startOfToday() {
  return new Date(`${todayKey()}T00:00:00.000-03:00`);
}

/** Põe um trabalho na fila. Recusa com a IA desligada, no limite diário ou com outro do mesmo tipo em andamento. */
export async function enqueueProjectAiJob(input: { projectId: string; kind: ProjectAiJobKind; input: string; day?: string; minutes?: number | null }) {
  const loaded = await loadAiRuntime();
  if (!loaded.ok) throw new ProjectAiError(loaded.error);
  if (loaded.runtime.dailyRunLimit !== null) {
    const since = startOfToday();
    const [runs, jobs] = await Promise.all([prisma.aiRun.count({ where: { createdAt: { gte: since } } }), prisma.projectAiJob.count({ where: { createdAt: { gte: since } } })]);
    if (runs + jobs >= loaded.runtime.dailyRunLimit) throw new ProjectAiError("O limite diário de uso da IA foi atingido. Tente amanhã.");
  }
  const job = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`project-ai:${input.projectId}`}))`;
    const busy = await tx.projectAiJob.findFirst({ where: { projectId: input.projectId, kind: input.kind, status: { in: ["PENDING", "RUNNING", "READY"] } }, select: { status: true } });
    if (busy) throw new ProjectAiError(busy.status === "READY" ? "Já existe um rascunho da Eliza esperando revisão. Aplique ou descarte antes de pedir outro." : "A Eliza já está trabalhando nisso. Aguarde um instante.");
    // Um pedido novo substitui o que falhou antes.
    await tx.projectAiJob.updateMany({ where: { projectId: input.projectId, kind: input.kind, status: "FAILED" }, data: { status: "DISCARDED" } });
    return tx.projectAiJob.create({ data: { projectId: input.projectId, kind: input.kind, input: input.input, day: input.day ? new Date(`${input.day}T00:00:00.000Z`) : null, minutes: input.minutes ?? null }, select: { id: true } });
  });
  try { after(() => processProjectAiJobs()); } catch { /* fora de uma requisição: o agendador processa */ }
  return job.id;
}

/** Processa a fila. Chamado depois das requisições e pelo agendador (a cada minuto). */
export async function processProjectAiJobs() {
  await prisma.projectAiJob.updateMany({ where: { status: "RUNNING", startedAt: { lt: new Date(Date.now() - STUCK_AFTER_MS) } }, data: { status: "PENDING" } });
  const due = await prisma.projectAiJob.findMany({ where: { status: "PENDING" }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: BATCH, select: { id: true } });
  for (const { id } of due) {
    const claimed = await prisma.projectAiJob.updateMany({ where: { id, status: "PENDING" }, data: { status: "RUNNING", startedAt: new Date(), attempts: { increment: 1 } } });
    if (!claimed.count) continue;
    try {
      await runJob(id);
    } catch (error) {
      const job = await prisma.projectAiJob.findUnique({ where: { id }, select: { attempts: true } });
      const retry = error instanceof AiProviderError && error.retryable && (job?.attempts ?? MAX_ATTEMPTS) < MAX_ATTEMPTS;
      const message = (error instanceof Error ? error.message : String(error)).slice(0, 500);
      await prisma.projectAiJob.update({ where: { id }, data: retry ? { status: "PENDING", error: message } : { status: "FAILED", error: message, finishedAt: new Date() } });
      if (!retry) await logEvent({ source: "sistema", level: "error", event: "project.ai.failed", message: `A Eliza não concluiu um trabalho de projeto: ${message}` });
    }
  }
}

type Call = { system: string; user: string; tool: AiToolSpec; maxTokens: number; timeoutMs: number };

/** Chama o modelo pedindo uma ferramenta e devolve a entrada dela (ou o JSON do texto, se o modelo responder em texto). */
async function callForTool(jobId: string, call: Call) {
  const loaded = await loadAiRuntime();
  if (!loaded.ok) throw new AiProviderError(loaded.error);
  const runtime = loaded.runtime;
  const model = runtime.models.gestao;
  const completion: AiCompletion = await runtime.providerFor(model).complete({ system: call.system, messages: [{ role: "user", content: call.user }], tools: [call.tool], maxTokens: call.maxTokens, temperature: 0.2, timeoutMs: call.timeoutMs });
  const cost = completion.usage.costUsd !== null ? Math.round(completion.usage.costUsd * 1_000_000) : costOf(completion.usage, runtime.priceFor(model), runtime.providerId === "anthropic");
  await prisma.projectAiJob.update({ where: { id: jobId }, data: { model: completion.model || model, inputTokens: { increment: completion.usage.inputTokens }, outputTokens: { increment: completion.usage.outputTokens }, ...(cost !== null ? { costMicros: cost } : {}) } });
  const fromTool = completion.toolCalls.find((item) => item.name === call.tool.name)?.input;
  if (fromTool && Object.keys(fromTool).length) return fromTool;
  const json = completion.text.match(/\{[\s\S]*\}/)?.[0];
  if (json) { try { return JSON.parse(json) as Record<string, unknown>; } catch { /* segue para o erro */ } }
  throw new Error(completion.stopReason === "length" ? "A resposta ficou longa demais e foi cortada. Divida a descrição em partes menores." : "A Eliza não devolveu o resultado no formato esperado.");
}

async function runJob(id: string) {
  const job = await prisma.projectAiJob.findUnique({ where: { id }, select: { id: true, projectId: true, kind: true, input: true, day: true, minutes: true } });
  if (!job) return;
  if (job.kind === "PLAN") await runPlan(job);
  else if (job.kind === "DAY") await runDay(job);
  else await runUpdate(job);
}

const str = (value: unknown, max: number) => typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
const list = (value: unknown) => Array.isArray(value) ? value : [];

/* PLAN ------------------------------------------------------------------------------------------------------------ */

const PLAN_TOOL: AiToolSpec = {
  name: "registrar_plano",
  description: "Registra o plano do projeto: funcionalidades e as subatividades de cada uma, com peso.",
  parameters: {
    type: "object",
    properties: {
      funcionalidades: { type: "array", description: "Blocos do projeto, na ordem em que fazem sentido ser construídos.", items: { type: "object", properties: {
        titulo: { type: "string", description: "Nome curto e claro, que o cliente entenda (ex.: Cadastro de clientes)." },
        descricao: { type: "string", description: "Uma frase sobre o que a funcionalidade entrega." },
        subatividades: { type: "array", items: { type: "object", properties: {
          titulo: { type: "string", description: "Tarefa concreta e verificável, começando com verbo no infinitivo." },
          peso: { type: "string", enum: ["P", "M", "G"], description: "P: até umas 2 horas; M: meio dia a um dia; G: mais de um dia." },
        }, required: ["titulo", "peso"] } },
      }, required: ["titulo", "subatividades"] } },
      observacoes: { type: "string", description: "Pontos em aberto ou premissas assumidas, para Vinicius confirmar." },
    },
    required: ["funcionalidades"],
  } as JsonSchema,
};

export function normalizePlan(raw: Record<string, unknown>): PlanDraft {
  const features = list(raw.funcionalidades).slice(0, 25).map((item) => {
    const feature = (item ?? {}) as Record<string, unknown>;
    const tasks = list(feature.subatividades).slice(0, 25).map((value) => {
      const task = (value ?? {}) as Record<string, unknown>;
      return { title: str(task.titulo, PROJECT_LIMITS.title), weight: weightOfSize(str(task.peso, 1).toUpperCase()) };
    }).filter((task) => task.title);
    return { title: str(feature.titulo, PROJECT_LIMITS.title), description: str(feature.descricao, 600) || null, tasks };
  }).filter((feature) => feature.title);
  if (!features.length) throw new Error("A Eliza não identificou funcionalidades na descrição. Detalhe um pouco mais o projeto.");
  return { features, notes: str(raw.observacoes, 2_000) || null };
}

async function runPlan(job: { id: string; projectId: string; input: string }) {
  const project = await prisma.project.findUnique({ where: { id: job.projectId }, select: { name: true, description: true, client: { select: { name: true, company: true } }, features: { orderBy: { position: "asc" }, take: PROJECT_LIMITS.features, select: { title: true, tasks: { take: 40, orderBy: { position: "asc" }, select: { title: true } } } } } });
  if (!project) throw new Error("Projeto não encontrado.");
  const existing = project.features.length ? `\n\nO plano já tem estas funcionalidades (não repita; para completar uma delas, use exatamente o mesmo nome e traga só subatividades novas):\n${project.features.map((feature) => `- ${feature.title}: ${feature.tasks.map((task) => task.title).join("; ")}`).join("\n").slice(0, 6_000)}` : "";
  const system = [
    "Você organiza os projetos de software de Vinicius Riudi, desenvolvedor (sites, sistemas web, aplicativos, integrações e automações).",
    "A partir da descrição, identifique as funcionalidades do projeto (blocos com valor para o cliente) e destrinche cada uma em subatividades técnicas concretas, verificáveis e do tamanho de um dia de trabalho ou menos.",
    "Subatividade começa com verbo no infinitivo (ex.: Criar tabela de pedidos, Integrar pagamento por Pix, Ajustar layout no celular). Peso: P até umas 2 horas, M meio dia a um dia, G mais de um dia (prefira quebrar G em partes menores quando possível).",
    "Inclua as etapas que costumam ser esquecidas, quando fizerem sentido: preparação do ambiente, banco de dados, autenticação, responsividade, testes, publicação (deploy), revisão com o cliente.",
    "Não invente requisitos. Se algo estiver ambíguo, crie a subatividade 'Definir com o cliente: …' e cite o ponto em observacoes.",
    `No máximo 25 funcionalidades e 25 subatividades por funcionalidade. Responda em português do Brasil, sem emojis, chamando a ferramenta ${PLAN_TOOL.name} uma única vez.`,
  ].join("\n");
  const user = `Projeto: ${project.name}${project.client ? ` (cliente: ${project.client.company ?? project.client.name})` : " (projeto pessoal)"}${project.description ? `\nResumo do projeto: ${project.description.slice(0, 2_000)}` : ""}${existing}\n\nDescrição para destrinchar:\n${job.input}`;
  const plan = normalizePlan(await callForTool(job.id, { system, user, tool: PLAN_TOOL, maxTokens: 12_000, timeoutMs: 300_000 }));
  await prisma.projectAiJob.update({ where: { id: job.id }, data: { status: "READY", result: plan as unknown as Prisma.InputJsonValue, error: null, finishedAt: new Date() } });
}

/* DAY ------------------------------------------------------------------------------------------------------------- */

const DAY_TOOL: AiToolSpec = {
  name: "registrar_dia",
  description: "Indica quais subatividades foram concluídas e quais avançaram, de acordo com o resumo do dia.",
  parameters: {
    type: "object",
    properties: {
      concluidas: { type: "array", items: { type: "string" }, description: "Ids das subatividades que o resumo dá como terminadas." },
      em_andamento: { type: "array", items: { type: "string" }, description: "Ids das subatividades que avançaram mas não terminaram." },
      nao_encontrado: { type: "array", items: { type: "string" }, description: "Trabalhos citados no resumo que não correspondem a nenhuma subatividade (frase curta cada)." },
    },
    required: ["concluidas", "em_andamento"],
  } as JsonSchema,
};

export type DayDraft = { done: string[]; doing: string[]; notFound: string[] };

async function runDay(job: { id: string; projectId: string; input: string }) {
  const tasks = await prisma.projectTask.findMany({ where: { projectId: job.projectId, status: { not: ProjectTaskStatus.DONE } }, orderBy: [{ feature: { position: "asc" } }, { position: "asc" }, { id: "asc" }], take: 400, select: { id: true, title: true, status: true, feature: { select: { title: true } } } });
  if (!tasks.length) throw new Error("Não há subatividades em aberto neste projeto para marcar.");
  const system = [
    "Você ajuda Vinicius Riudi a registrar o dia de trabalho num projeto de software.",
    "Compare o resumo do dia com a lista de subatividades em aberto e indique quais foram concluídas e quais avançaram sem terminar. Só marque como concluída quando o resumo deixar claro que terminou; na dúvida, use em andamento.",
    "Use apenas ids da lista. Trabalho citado que não corresponde a nenhuma subatividade vai em nao_encontrado.",
    `Responda chamando a ferramenta ${DAY_TOOL.name} uma única vez.`,
  ].join("\n");
  const user = `Subatividades em aberto (id | funcionalidade | subatividade | situação):\n${tasks.map((task) => `${task.id} | ${task.feature.title} | ${task.title} | ${taskStatusLabel[task.status]}`).join("\n")}\n\nResumo do dia:\n${job.input}`;
  const raw = await callForTool(job.id, { system, user, tool: DAY_TOOL, maxTokens: 2_000, timeoutMs: 120_000 });
  const open = new Set(tasks.map((task) => task.id));
  const ids = (value: unknown) => [...new Set(list(value).filter((id): id is string => typeof id === "string" && open.has(id)))];
  const done = ids(raw.concluidas);
  const draft: DayDraft = { done, doing: ids(raw.em_andamento).filter((id) => !done.includes(id)), notFound: list(raw.nao_encontrado).map((item) => str(item, 200)).filter(Boolean).slice(0, 10) };
  await prisma.projectAiJob.update({ where: { id: job.id }, data: { status: "READY", result: draft as unknown as Prisma.InputJsonValue, error: null, finishedAt: new Date() } });
}

/* UPDATE ---------------------------------------------------------------------------------------------------------- */

const UPDATE_TOOL: AiToolSpec = {
  name: "registrar_atualizacao",
  description: "Registra a atualização do projeto para o cliente.",
  parameters: {
    type: "object",
    properties: {
      titulo: { type: "string", description: "Título curto (ex.: Painel financeiro pronto para testes)." },
      texto: { type: "string", description: "Texto para o cliente, em parágrafos curtos ou lista com hífen." },
    },
    required: ["titulo", "texto"],
  } as JsonSchema,
};

const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });

async function runUpdate(job: { id: string; projectId: string; input: string }) {
  const project = await prisma.project.findUnique({ where: { id: job.projectId }, select: { name: true, status: true, deliveryAt: true, totalWeight: true, doneWeight: true, client: { select: { name: true } }, features: { orderBy: { position: "asc" }, take: PROJECT_LIMITS.features, select: { title: true, tasks: { take: PROJECT_LIMITS.tasksPerFeature, select: { weight: true, status: true, title: true } } } }, updates: { where: { status: "PUBLISHED" }, orderBy: { publishedAt: "desc" }, take: 1, select: { publishedAt: true, progressPercent: true, title: true } } } });
  if (!project?.client) throw new Error("A atualização ao cliente só vale para projetos de cliente.");
  const last = project.updates[0] ?? null;
  const since = last?.publishedAt ?? new Date(Date.now() - 2 * WEEK);
  const logs = await prisma.projectLog.findMany({ where: { projectId: job.projectId, createdAt: { gt: since } }, orderBy: [{ day: "asc" }, { id: "asc" }], take: 40, select: { day: true, summary: true, tasks: true } });
  const percent = percentOf(project.doneWeight, project.totalWeight);
  const features = project.features.map((feature) => {
    const total = feature.tasks.reduce((sum, task) => sum + task.weight, 0);
    const done = feature.tasks.filter((task) => task.status === "DONE").reduce((sum, task) => sum + task.weight, 0);
    return `- ${feature.title}: ${percentOf(done, total)}%`;
  });
  const waiting = project.features.flatMap((feature) => feature.tasks.filter((task) => task.status === "WAITING_CLIENT").map((task) => `- ${feature.title}: ${task.title}`));
  const system = [
    "Você escreve, em nome de Vinicius Riudi (desenvolvedor), a atualização de andamento de um projeto para o cliente dele.",
    "Primeira pessoa, português do Brasil, tom cordial, profissional e direto. Fale do que avançou em termos de funcionalidades e do que isso significa para o cliente, sem jargão técnico.",
    "Nunca cite subatividades internas, horas trabalhadas, valores, problemas internos ou outros clientes. Não prometa datas que não estejam nos dados.",
    "Se houver itens aguardando o cliente, peça de forma clara e gentil o que falta dele.",
    "De 3 a 6 frases curtas, ou uma lista curta com hífen. Sem emojis e sem Markdown além de listas com hífen.",
    `Responda chamando a ferramenta ${UPDATE_TOOL.name} uma única vez.`,
  ].join("\n");
  const user = [
    `Projeto: ${project.name}. Cliente: ${project.client.name}. Situação: ${projectStatusLabel[project.status]}. Concluído: ${percent}%${last?.progressPercent !== null && last?.progressPercent !== undefined ? ` (era ${last.progressPercent}% na última atualização)` : ""}.`,
    project.deliveryAt ? `Entrega prevista: ${shortDate.format(project.deliveryAt)}/${project.deliveryAt.getUTCFullYear()}.` : "",
    `Funcionalidades e andamento:\n${features.join("\n")}`,
    waiting.length ? `Aguardando o cliente:\n${waiting.join("\n")}` : "",
    logs.length ? `Diário desde a última atualização:\n${logs.map((log) => `${shortDate.format(log.day)}: ${log.summary.slice(0, 600)}${Array.isArray(log.tasks) && log.tasks.length ? ` (concluído: ${(log.tasks as { title?: string }[]).map((task) => task.title).filter(Boolean).join("; ")})` : ""}`).join("\n")}` : "Sem registros no diário desde a última atualização.",
    job.input ? `Orientação de Vinicius para esta atualização: ${job.input}` : "",
  ].filter(Boolean).join("\n\n");
  const raw = await callForTool(job.id, { system, user, tool: UPDATE_TOOL, maxTokens: 1_500, timeoutMs: 120_000 });
  const title = str(raw.titulo, 160) || `Andamento de ${project.name}`;
  const body = typeof raw.texto === "string" ? raw.texto.replace(/\r\n?/g, "\n").trim().slice(0, 4_000) : "";
  if (!body) throw new Error("A Eliza não escreveu o texto da atualização.");
  const update = await prisma.projectUpdate.create({ data: { projectId: job.projectId, title, body }, select: { id: true } });
  await prisma.projectAiJob.update({ where: { id: job.id }, data: { status: "APPLIED", result: { updateId: update.id }, error: null, finishedAt: new Date() } });
}

/**
 * Rascunho semanal (sexta-feira, pelo agendador): para cada projeto de cliente em andamento com registro no diário
 * desde a última atualização, a Eliza prepara a atualização para você revisar e publicar.
 */
export async function enqueueWeeklyProjectUpdates(now = new Date()) {
  const loaded = await loadAiRuntime();
  if (!loaded.ok) return 0;
  const projects = await prisma.project.findMany({
    where: { clientId: { not: null }, status: { in: ["PLANNING", "IN_PROGRESS", "WAITING_CLIENT"] }, logs: { some: { createdAt: { gt: new Date(now.getTime() - WEEK) } } }, updates: { none: { status: "DRAFT" } }, aiJobs: { none: { kind: "UPDATE", status: { in: ["PENDING", "RUNNING"] } } } },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: 20,
    select: { id: true, updates: { where: { status: "PUBLISHED" }, orderBy: { publishedAt: "desc" }, take: 1, select: { publishedAt: true } }, logs: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } } },
  });
  let queued = 0;
  for (const project of projects) {
    const lastPublished = project.updates[0]?.publishedAt;
    if (lastPublished && project.logs[0] && project.logs[0].createdAt <= lastPublished) continue;
    await prisma.projectAiJob.create({ data: { projectId: project.id, kind: "UPDATE", input: "" } });
    queued += 1;
  }
  return queued;
}
