import type { PortalContext, getPortalDocuments, getPortalServices } from "@/features/client-portal/queries/portal-queries";

/**
 * Lembretes do Início do portal: curtos, sem valores, cada um com o lugar onde resolver. Atenção primeiro (atraso,
 * sistema fora do ar), depois o que está perto (vencimento, projeto aguardando o cliente), depois avisos.
 */
export type PortalReminder = { id: string; tone: "attention" | "soon" | "info"; category: string; title: string; detail: string; href: string; action: string };

const DAY_MS = 24 * 60 * 60 * 1000;
const date = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Maceio" });
const order = { attention: 0, soon: 1, info: 2 } as const;

function inDays(target: Date, todayStart: Date) {
  return Math.round((target.getTime() - todayStart.getTime()) / DAY_MS);
}

const kindName: Record<string, string> = { PROPOSAL: "proposta comercial", CONTRACT: "contrato", IP_ASSIGNMENT: "cessão de direitos", TECHNICAL_MEMORIAL: "memorial técnico" };

/** "Proposta comercial e contrato": os tipos dos documentos, sem repetir títulos iguais. */
function documentKinds(documents: Array<{ kind: string }>) {
  const names = [...new Set(documents.map((document) => kindName[document.kind] ?? "documento"))];
  const text = names.length > 1 ? `${names.slice(0, -1).join(", ")} e ${names.at(-1)}` : names[0];
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}

function when(days: number) {
  return days <= 0 ? "hoje" : days === 1 ? "amanhã" : `em ${days} dias`;
}

type ReminderInput = {
  context: PortalContext;
  documents: Awaited<ReturnType<typeof getPortalDocuments>>;
  services: Awaited<ReturnType<typeof getPortalServices>>;
  online: boolean;
  contactName: string;
  todayStart: Date;
};

export function buildPortalReminders({ context, documents, services, online, contactName, todayStart }: ReminderInput) {
  const reminders: PortalReminder[] = [];
  const { receivables, client } = context;
  const next = receivables.open[0] ?? null;

  if (receivables.overdue.count) {
    reminders.push({ id: "overdue", tone: "attention", category: "PAGAMENTO", title: receivables.overdue.count === 1 ? "Uma parcela está em atraso" : `${receivables.overdue.count} parcelas estão em atraso`, detail: receivables.overdue.oldest ? `A mais antiga venceu em ${date.format(receivables.overdue.oldest)}.` : "Regularize para manter seus serviços em dia.", href: "/pagamentos", action: "VER PAGAMENTOS" });
  } else if (next && inDays(next.dueDate, todayStart) <= 7) {
    reminders.push({ id: "due", tone: "soon", category: "PAGAMENTO", title: `${next.number ? `A parcela ${next.number} de ${next.total}` : "Seu pagamento"} vence ${when(inDays(next.dueDate, todayStart))}`, detail: `${next.entryDescription} · vencimento em ${date.format(next.dueDate)}.`, href: "/pagamentos", action: "VER PAGAMENTOS" });
  }
  if (online && next && client && !client.cpf && !client.cnpj) {
    reminders.push({ id: "document", tone: "soon", category: "CADASTRO", title: "Complete seu cadastro", detail: `Para pagar online, seu cadastro precisa de CPF ou CNPJ. Fale com ${contactName}.`, href: "/configuracoes", action: "VER CONTATO" });
  }

  for (const system of services.systems.filter((item) => item.status === "DOWN" || item.status === "DEGRADED")) {
    reminders.push({ id: `system-${system.id}`, tone: system.status === "DOWN" ? "attention" : "soon", category: "SISTEMA", title: `${system.name} está ${system.status === "DOWN" ? "fora do ar" : "instável"}`, detail: "Já fomos avisados e estamos acompanhando.", href: "/servicos", action: "VER SERVIÇOS" });
  }
  for (const project of services.projects.filter((item) => item.status === "WAITING_CLIENT")) {
    reminders.push({ id: `waiting-${project.id}`, tone: "soon", category: "PROJETO", title: `${project.name} aguarda um retorno seu`, detail: "O projeto continua assim que você responder.", href: "/servicos", action: "VER SERVIÇOS" });
  }

  // Via em conferência já não depende do cliente; recusada volta a ser pendência dele. O documento livre não se assina.
  const unsigned = documents.filter((document) => document.kind !== "FREE" && (!document.signed || document.signed.reviewStatus === "REJECTED"));
  if (unsigned.length) {
    reminders.push({ id: "sign", tone: "info", category: "DOCUMENTO", title: unsigned.length === 1 ? "Um documento para assinar" : `${unsigned.length} documentos para assinar`, detail: documentKinds(unsigned), href: "/documentos", action: "ASSINAR" });
  }
  for (const project of services.projects.filter((item) => item.deliveryAt && item.status !== "DELIVERED" && item.status !== "WAITING_CLIENT")) {
    const days = inDays(project.deliveryAt!, todayStart);
    if (days >= 0 && days <= 14) reminders.push({ id: `delivery-${project.id}`, tone: "info", category: "ENTREGA", title: `Entrega de ${project.name} ${when(days)}`, detail: `Prevista para ${date.format(project.deliveryAt!)}.`, href: "/servicos", action: "VER SERVIÇOS" });
  }

  return reminders.sort((left, right) => order[left.tone] - order[right.tone]).slice(0, 6);
}
