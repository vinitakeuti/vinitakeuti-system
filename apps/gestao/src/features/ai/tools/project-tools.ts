import { prisma } from "@/lib/prisma";
import { defineTool, day, todayIso } from "@/features/ai/tools/tool";
import { object, s } from "@/features/ai/tools/schema";
import { ACTIVE_PROJECT_STATUSES, PROJECT_LIMITS, percentOf, projectStatusLabel, taskStatusLabel } from "@/features/projects/types/project";
import { createProject, registerProjectDay } from "@/features/projects/services/project-service";
import { ProjectAiError, enqueueProjectAiJob } from "@/features/projects/services/project-ai";

/**
 * Projetos na conversa com a Eliza (só para você): consultar o andamento, criar um projeto, pedir o plano a partir
 * de uma descrição (vira rascunho para revisar na tela) e registrar o dia, marcando as subatividades concluídas.
 */

export const projectTools = [
  defineTool({
    name: "projetos_listar",
    description: "Lista os projetos (de clientes e pessoais) com situação, percentual concluído e entrega prevista. Por padrão, só os em andamento.",
    scopes: ["owner"],
    mutates: false,
    input: object({ busca: s.optional(s.string({ max: 100 })), incluir_encerrados: s.optional(s.boolean()) }),
    async run(input) {
      const projects = await prisma.project.findMany({
        where: { ...(input.incluir_encerrados ? {} : { status: { in: [...ACTIVE_PROJECT_STATUSES] } }), ...(input.busca ? { OR: [{ name: { contains: input.busca, mode: "insensitive" as const } }, { client: { name: { contains: input.busca, mode: "insensitive" as const } } }] } : {}) },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: 30,
        select: { id: true, name: true, status: true, totalWeight: true, doneWeight: true, deliveryAt: true, client: { select: { name: true } } },
      });
      return { projetos: projects.map((project) => ({ id: project.id, nome: project.name, cliente: project.client?.name ?? "pessoal", situacao: projectStatusLabel[project.status], concluido: `${percentOf(project.doneWeight, project.totalWeight)}%`, entrega_prevista: day(project.deliveryAt), link: `/projetos/${project.id}` })) };
    },
  }),

  defineTool({
    name: "projetos_detalhes",
    description: "Plano de um projeto: funcionalidades com o percentual e as subatividades em aberto (com id), para identificar o que foi feito num resumo do dia.",
    scopes: ["owner"],
    mutates: false,
    input: object({ projeto_id: s.id() }),
    async run(input) {
      const project = await prisma.project.findUnique({ where: { id: input.projeto_id }, select: { id: true, name: true, status: true, totalWeight: true, doneWeight: true, deliveryAt: true, client: { select: { name: true } }, features: { orderBy: { position: "asc" }, take: PROJECT_LIMITS.features, select: { title: true, tasks: { orderBy: { position: "asc" }, take: PROJECT_LIMITS.tasksPerFeature, select: { id: true, title: true, status: true, weight: true } } } } } });
      if (!project) return { erro: "Projeto não encontrado." };
      let open = 0;
      return {
        projeto: { id: project.id, nome: project.name, cliente: project.client?.name ?? "pessoal", situacao: projectStatusLabel[project.status], concluido: `${percentOf(project.doneWeight, project.totalWeight)}%`, entrega_prevista: day(project.deliveryAt), link: `/projetos/${project.id}` },
        funcionalidades: project.features.map((feature) => {
          const total = feature.tasks.reduce((sum, task) => sum + task.weight, 0);
          const done = feature.tasks.filter((task) => task.status === "DONE").reduce((sum, task) => sum + task.weight, 0);
          const pending = feature.tasks.filter((task) => task.status !== "DONE" && open++ < 250);
          return { nome: feature.title, concluido: `${percentOf(done, total)}%`, em_aberto: pending.map((task) => ({ id: task.id, subatividade: task.title, situacao: taskStatusLabel[task.status] })) };
        }),
      };
    },
  }),

  defineTool({
    name: "projetos_criar",
    description: "Cria um projeto. Sem cliente_id, o projeto é pessoal. Para um projeto de cliente, busque o id com clientes_buscar.",
    scopes: ["owner"],
    mutates: true,
    input: object({ nome: s.string({ min: 2, max: PROJECT_LIMITS.title }), cliente_id: s.optional(s.id()), resumo: s.optional(s.string({ max: 600 })), entrega_prevista: s.optional(s.date({ description: "Entrega prevista" })) }),
    summarize: (input) => `Criar o projeto "${input.nome}"${input.cliente_id ? "" : " (pessoal)"}`,
    async run(input) {
      const delivery = input.entrega_prevista ? new Date(`${input.entrega_prevista}T12:00:00.000-03:00`) : null;
      const result = await createProject({ name: input.nome, clientId: input.cliente_id ?? null, description: input.resumo ?? null, status: "PLANNING", startedAt: null, deliveryAt: delivery, quoteId: null });
      return result.ok ? { criado: true, projeto_id: result.projectId, link: `/projetos/${result.projectId}` } : { erro: result.error };
    },
  }),

  defineTool({
    name: "projetos_destrinchar",
    description: "Envia a descrição de um projeto para a Eliza destrinchar em funcionalidades e subatividades, em segundo plano. O resultado vira um rascunho que Vinicius revisa e aplica na tela do projeto; nada entra no plano direto.",
    scopes: ["owner"],
    mutates: true,
    confirm: false,
    input: object({ projeto_id: s.id(), descricao: s.longText({ max: PROJECT_LIMITS.prompt }) }),
    async run(input) {
      try {
        await enqueueProjectAiJob({ projectId: input.projeto_id, kind: "PLAN", input: input.descricao });
        return { enviado: true, revisar_em: `/projetos/${input.projeto_id}`, aviso: "O rascunho fica pronto em um ou dois minutos, na aba Plano do projeto." };
      } catch (error) {
        return { erro: error instanceof ProjectAiError ? error.message : "Não foi possível enviar agora." };
      }
    },
  }),

  defineTool({
    name: "projetos_registrar_dia",
    description: "Registra o dia de trabalho num projeto: grava o resumo no diário e marca as subatividades concluídas e em andamento (ids de projetos_detalhes). Use quando Vinicius contar o que fez no dia.",
    scopes: ["owner"],
    mutates: true,
    input: object({
      projeto_id: s.id(),
      resumo: s.longText({ max: PROJECT_LIMITS.summary, description: "O que foi feito, nas palavras de Vinicius." }),
      concluidas: s.optional(s.ids({ max: 100, description: "Ids das subatividades terminadas." })),
      em_andamento: s.optional(s.ids({ max: 100, description: "Ids das subatividades que avançaram sem terminar." })),
      horas: s.optional(s.decimal({ min: 0, max: 24, description: "Horas trabalhadas no projeto." })),
      dia: s.optional(s.date({ description: "Dia trabalhado (padrão: hoje)" })),
    }),
    summarize: (input) => `Registrar o dia no projeto: ${input.concluidas?.length ?? 0} subatividades concluídas, ${input.em_andamento?.length ?? 0} em andamento${input.horas ? `, ${input.horas} h` : ""}`,
    async run(input) {
      const result = await registerProjectDay({ projectId: input.projeto_id, day: input.dia ?? todayIso(), summary: input.resumo.trim(), minutes: input.horas ? Math.round(input.horas * 60) : null, done: input.concluidas ?? [], doing: input.em_andamento ?? [], source: "ELIZA" });
      return result.ok ? { registrado: true, concluido_agora: `${result.percent}%`, subatividades_concluidas_no_dia: result.completed, link: `/projetos/${input.projeto_id}?aba=diario` } : { erro: result.error };
    },
  }),
];
