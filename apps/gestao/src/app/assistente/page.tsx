import { AppSidebar } from "@/components/app-sidebar";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { requireManagementUser } from "@/features/auth/services/auth-session";
import { AssistantChat } from "@/features/ai/components/assistant-chat";
import { getAssistantStatus, listAssistantConversations } from "@/features/ai/queries/ai-queries";
import { conversationView, findConversation } from "@/features/ai/services/conversations";

export const dynamic = "force-dynamic";

type AssistantPageProps = { searchParams: Promise<{ c?: string }> };

/** Saudação pela hora de Maceió, calculada no servidor (evita diferença entre servidor e navegador). */
function greeting(name: string | null) {
  const hour = Number(new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hourCycle: "h23", timeZone: "America/Maceio" }).format(new Date()));
  const period = hour >= 5 && hour < 12 ? "Bom dia" : hour >= 12 && hour < 18 ? "Boa tarde" : "Boa noite";
  const first = name?.trim().split(/\s+/)[0];
  return first ? `${period}, ${first}.` : `${period}.`;
}

/** Assistente em tela cheia: histórico à esquerda e a conversa ocupando o resto da área de trabalho. */
export default async function AssistantPage({ searchParams }: AssistantPageProps) {
  const user = await requireManagementUser();
  const params = await searchParams;
  const [status, conversations, active] = await Promise.all([
    getAssistantStatus(),
    listAssistantConversations(),
    params.c ? findConversation({ channel: "GESTAO", userId: user.id }, params.c) : null,
  ]);
  const initial = active ? await conversationView(active.id) : null;

  return <main className="app-shell"><AppSidebar current="assistant" /><div className="workspace assistant-workspace">
    <AssistantChat key={initial?.conversationId ?? "nova"} status={status} conversations={conversations} initial={initial} greeting={greeting(user.name)} menu={<SidebarToggle location="header" />} />
  </div></main>;
}
