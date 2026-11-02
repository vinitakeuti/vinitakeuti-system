import { AppSidebar } from "@/components/app-sidebar";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { requireManagementUser } from "@/features/auth/services/auth-session";
import { AssistantChat } from "@/features/ai/components/assistant-chat";
import { getAssistantStatus, listAssistantConversations } from "@/features/ai/queries/ai-queries";
import { conversationView, findConversation } from "@/features/ai/services/conversations";

export const dynamic = "force-dynamic";

type AssistantPageProps = { searchParams: Promise<{ c?: string }> };

export default async function AssistantPage({ searchParams }: AssistantPageProps) {
  const user = await requireManagementUser();
  const params = await searchParams;
  const [status, conversations, active] = await Promise.all([
    getAssistantStatus(),
    listAssistantConversations(),
    params.c ? findConversation({ channel: "GESTAO", userId: user.id }, params.c) : null,
  ]);
  const initial = active ? await conversationView(active.id) : null;

  return <main className="app-shell"><AppSidebar current="assistant" /><div className="workspace assistant-workspace"><section className="assistant-page">
    <header className="assistant-header"><div><p className="eyebrow">GESTÃO / ASSISTENTE IA</p><h1>Assistente.</h1></div><div className="header-actions"><SidebarToggle location="header" /></div></header>
    <AssistantChat key={initial?.conversationId ?? "nova"} status={status} conversations={conversations} initial={initial} />
  </section></div></main>;
}
