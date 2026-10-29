import type { getPortalDocuments, getPortalServices } from "@/features/client-portal/queries/portal-queries";

/**
 * Jornada do projeto no Início do portal: da proposta aprovada à entrega, para a contratação mais recente.
 * Cada etapa fica concluída, em andamento ou próxima, conforme a venda, o contrato assinado e o projeto.
 */
export type JourneyStep = { label: string; state: "done" | "current" | "next"; detail: string };

const date = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Maceio" });
const projectLabel: Record<string, string> = { PROPOSAL: "Proposta", PLANNING: "Em planejamento", IN_PROGRESS: "Em execução", WAITING_CLIENT: "Aguardando seu retorno", DELIVERED: "Entregue", PAUSED: "Pausado" };

type Services = Awaited<ReturnType<typeof getPortalServices>>;
type Documents = Awaited<ReturnType<typeof getPortalDocuments>>;

export function buildProjectJourney(services: Services, documents: Documents) {
  const sale = services.sales[0];
  if (!sale) return null;
  const quoteId = sale.quote?.id ?? null;
  const contract = documents.find((document) => document.kind === "CONTRACT" && document.quoteId === quoteId) ?? documents.find((document) => document.kind === "CONTRACT") ?? null;
  const project = services.projects.find((item) => item.id === sale.quote?.projectId) ?? services.projects[0] ?? null;
  const contractSigned = contract?.signed?.reviewStatus === "APPROVED";
  const contractInReview = contract?.signed?.reviewStatus === "IN_REVIEW";
  const delivered = project?.status === "DELIVERED";
  const building = Boolean(project && ["PLANNING", "IN_PROGRESS", "WAITING_CLIENT", "PAUSED"].includes(project.status));

  const steps: JourneyStep[] = [
    { label: "Proposta aprovada", state: "done", detail: sale.confirmedAt ? date.format(sale.confirmedAt) : "Aprovada" },
    { label: "Contrato assinado", state: contractSigned ? "done" : "current", detail: contractSigned ? date.format(contract!.signed!.createdAt) : contractInReview ? "Via assinada em conferência" : contract ? "Aguardando sua assinatura" : "Em preparação" },
    { label: "Desenvolvimento", state: delivered ? "done" : building ? "current" : "next", detail: project ? projectLabel[project.status] ?? "Em andamento" : contractSigned ? "Em andamento" : "Começa após o contrato" },
    { label: "Entrega", state: delivered ? "done" : "next", detail: delivered ? (project?.deliveryAt ? date.format(project.deliveryAt) : "Entregue") : project?.deliveryAt ? `Prevista para ${date.format(project.deliveryAt)}` : "Data a definir" },
  ];
  // O contrato pendente e o desenvolvimento em andamento podem estar ativos juntos; sem nenhuma ativa, a primeira em aberto é a atual.
  const firstOpen = steps.findIndex((step) => step.state !== "done");
  if (firstOpen >= 0 && !steps.some((step) => step.state === "current")) steps[firstOpen].state = "current";

  return { title: sale.title, code: sale.quote?.code ?? sale.code, steps, done: steps.filter((step) => step.state === "done").length, more: services.sales.length - 1 };
}
