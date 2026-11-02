import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { defineTool } from "@/features/ai/tools/tool";
import { object, s } from "@/features/ai/tools/schema";
import { bookAttendanceMeeting, cancelAttendanceMeeting, createCalendarEvent, eventKindLabel, findFreeSlots, getAgendaSettings, saveConversationSummary, setEventStatus } from "@/features/agenda/services/agenda-service";
import { listEventsBetween } from "@/features/agenda/queries/agenda-queries";
import { addDays, dayKey, timeOf, todayKey, WEEKDAYS, weekdayOf } from "@/features/agenda/types/agenda";

/**
 * Agenda. Para você (owner): consultar, criar e cancelar eventos. Para o atendimento (public e client): só os
 * horários livres (nunca os seus compromissos), marcar uma reunião com o contato da conversa, cancelar a reunião da
 * própria conversa e registrar o resumo do atendimento.
 */

function refreshAgenda() {
  try { revalidatePath("/agenda"); } catch { /* fora de uma requisição */ }
}

const KINDS = { reuniao: "MEETING", compromisso: "APPOINTMENT", lembrete: "REMINDER" } as const;

export const agendaTools = [
  defineTool({
    name: "agenda_listar",
    description: "Eventos da agenda (reuniões, compromissos e lembretes) entre duas datas, com horário, cliente ou contato e situação. Sem datas: de hoje até daqui a 7 dias.",
    scopes: ["owner"],
    mutates: false,
    input: object({ de: s.optional(s.date()), ate: s.optional(s.date()), incluir_cancelados: s.optional(s.boolean()) }),
    async run(input) {
      const from = input.de ?? todayKey();
      const to = input.ate ?? addDays(from, 7);
      const events = await listEventsBetween(from, to, { includeCancelled: input.incluir_cancelados, take: 100 });
      return {
        periodo: { de: from, ate: to },
        eventos: events.map((event) => ({ id: event.id, titulo: event.title, tipo: eventKindLabel(event.kind), data: dayKey(event.startsAt), dia: WEEKDAYS[weekdayOf(dayKey(event.startsAt))], inicio: timeOf(event.startsAt), fim: timeOf(event.endsAt), situacao: event.status === "CANCELLED" ? "cancelado" : event.status === "DONE" ? "concluído" : "marcado", cliente: event.client?.name ?? event.contactName ?? null, local: event.location, origem: event.source === "ia-atendimento" ? "marcado pela assistente no atendimento" : undefined, link: `/agenda?evento=${event.id}` })),
      };
    },
  }),

  defineTool({
    name: "agenda_horarios_livres",
    description: "Horários livres para reunião, dentro dos dias e horários de atendimento configurados, sem conflito com a agenda. Use para sugerir horários.",
    scopes: ["owner", "public", "client"],
    mutates: false,
    input: object({ a_partir_de: s.optional(s.date({ description: "Primeiro dia a considerar" })) }),
    async run(input) {
      const [days, settings] = await Promise.all([findFreeSlots({ fromDay: input.a_partir_de, days: 4, perDay: 8 }), getAgendaSettings()]);
      return days.length ? { duracao_minutos: settings.meetingMinutes, formato: settings.meetingFormat, dias: days } : { erro: "Não há horários livres no período de agendamento. Oriente a pessoa a falar com Vinicius pelo WhatsApp." };
    },
  }),

  defineTool({
    name: "agenda_criar",
    description: "Cria um evento na agenda de Vinicius (reunião, compromisso ou lembrete). Conflitos de horário não impedem, mas voltam como aviso para você mencionar.",
    scopes: ["owner"],
    mutates: true,
    confirm: false,
    input: object({
      titulo: s.string({ min: 2, max: 160 }),
      tipo: s.optional(s.enum(["reuniao", "compromisso", "lembrete"] as const)),
      data: s.date(),
      inicio: s.string({ min: 5, max: 5, pattern: /^([01]\d|2[0-3]):[0-5]\d$/, description: "HH:MM" }),
      fim: s.optional(s.string({ min: 5, max: 5, pattern: /^([01]\d|2[0-3]):[0-5]\d$/, description: "HH:MM; sem fim, dura 30 minutos" })),
      cliente_id: s.optional(s.id({ description: "Use clientes_buscar para achar o id" })),
      descricao: s.optional(s.string({ max: 4_000 })),
      local: s.optional(s.string({ max: 300, description: "Endereço ou link da reunião" })),
    }),
    async run(input, context) {
      const result = await createCalendarEvent({ title: input.titulo, kind: KINDS[input.tipo ?? "reuniao"], day: input.data, start: input.inicio, end: input.fim, description: input.descricao, location: input.local, clientId: input.cliente_id, source: "ia-gestao", createdBy: context.actor });
      if (!result.ok) return { erro: result.error };
      refreshAgenda();
      return { feito: true, evento_id: result.event.id, inicio: timeOf(result.event.startsAt), fim: timeOf(result.event.endsAt), conflitos: result.conflicts.length ? result.conflicts : undefined, link: `/agenda?evento=${result.event.id}` };
    },
  }),

  defineTool({
    name: "agenda_remover",
    description: "Cancela um evento da agenda (ele sai da semana, mas continua no histórico). Use agenda_listar para achar o id.",
    scopes: ["owner"],
    mutates: true,
    input: object({ evento_id: s.id() }),
    summarize: (input) => `Cancelar o evento ${input.evento_id} da agenda`,
    async run(input) {
      const event = await prisma.calendarEvent.findUnique({ where: { id: input.evento_id }, select: { title: true, startsAt: true } });
      if (!event) return { erro: "Evento não encontrado." };
      await setEventStatus(input.evento_id, "CANCELLED");
      refreshAgenda();
      return { feito: true, cancelado: `${event.title} · ${dayKey(event.startsAt)} ${timeOf(event.startsAt)}` };
    },
  }),

  defineTool({
    name: "atendimento_registrar_resumo",
    description: "Registra (ou atualiza) o resumo CURTO do atendimento para Vinicius, em até 4 linhas: objetivo do cliente, situação atual, serviços de interesse e próximo passo. Chame assim que entender o que a pessoa precisa e atualize quando surgir algo importante. É o que aparece na lista de Atendimentos.",
    scopes: ["public", "client"],
    mutates: false,
    input: object({ resumo: s.longText({ max: 1_200, description: "Até 4 linhas curtas. Ex.: Objetivo: … · Situação atual: … · Interesse: … · Próximo passo: …" }) }),
    async run(input, context) {
      const saved = await saveConversationSummary(context.conversationId, input.resumo);
      return saved ? { feito: true } : { erro: "Resumo vazio." };
    },
  }),

  defineTool({
    name: "agenda_agendar_reuniao",
    description: "Marca uma reunião com Vinicius num horário livre, depois de a pessoa escolher o horário. O contato da conversa é usado automaticamente. Inclua o resumo do atendimento.",
    scopes: ["public", "client"],
    mutates: false,
    input: object({
      data: s.date({ description: "Dia escolhido, de agenda_horarios_livres" }),
      horario: s.string({ min: 5, max: 5, pattern: /^([01]\d|2[0-3]):[0-5]\d$/, description: "HH:MM escolhido, de agenda_horarios_livres" }),
      resumo: s.longText({ max: 2_000, description: "Resumo do atendimento: objetivo, situação atual, serviços de interesse, prazos e próximo passo" }),
      assunto: s.optional(s.string({ max: 160, description: "Assunto curto da reunião" })),
    }),
    async run(input, context) {
      const result = await bookAttendanceMeeting({ conversationId: context.conversationId, day: input.data, time: input.horario, summary: input.resumo, subject: input.assunto });
      if (!result.ok) return { erro: result.error };
      refreshAgenda();
      return { feito: true, quando: result.when, duracao_minutos: result.minutes, formato: result.format ?? "Vinicius confirma o formato (online ou presencial) pelo contato informado." };
    },
  }),

  defineTool({
    name: "agenda_cancelar_reuniao",
    description: "Cancela a reunião futura marcada nesta conversa, quando a pessoa pedir (para remarcar, cancele e marque de novo).",
    scopes: ["public", "client"],
    mutates: false,
    input: object({}),
    async run(_input, context) {
      const result = await cancelAttendanceMeeting(context.conversationId);
      if (!result.ok) return { erro: result.error };
      refreshAgenda();
      return { feito: true, cancelada: result.when };
    },
  }),
];
