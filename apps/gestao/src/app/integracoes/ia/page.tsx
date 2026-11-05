import Link from "next/link";
import { AppSidebar } from "@/components/app-sidebar";
import { IntegrationHeader } from "@/features/integrations/components/integration-header";
import { getAiSettingsView } from "@/features/ai/services/ai-settings";
import { AiAccessPanel, AiActivityPanel, AiConnectionPanel, AiContextPanel, AiRulesPanel, aiIsConnected, aiProviderLabel } from "@/features/ai/components/ai-settings-panel";

export const dynamic = "force-dynamic";

const TABS = [{ id: "conexao", label: "Conexão" }, { id: "contexto", label: "Contexto" }, { id: "regras", label: "Canais e regras" }, { id: "acesso", label: "Acesso externo" }, { id: "atividade", label: "Atividade" }] as const;
type Tab = (typeof TABS)[number]["id"];

const notices: Record<string, string> = {
  salva: "Conexão salva. Use “Testar conexão” para conferir a chave e o modelo.",
  desligada: "IA desligada. A chave foi apagada.",
  regras: "Canais e regras salvos.",
  contexto: "Contexto salvo. Vale a partir da próxima mensagem.",
  "token-revogado": "Token de acesso externo revogado.",
};

type AiPageProps = { searchParams: Promise<{ aba?: string; escopo?: string; aviso?: string; erro?: string; cursor?: string; resultado?: string }> };

/** Inteligência artificial: conexão com o provedor, canais e regras, acesso externo (site, WhatsApp, MCP) e atividade. */
export default async function AiIntegrationPage({ searchParams }: AiPageProps) {
  const params = await searchParams;
  const tab: Tab = TABS.some((item) => item.id === params.aba) ? params.aba as Tab : "conexao";
  const settings = await getAiSettingsView();
  const connected = aiIsConnected(settings);

  return <main className="app-shell"><AppSidebar current="integrations" /><div className="workspace"><section className="directory-page settings-page">
    <IntegrationHeader crumb="Inteligência artificial" title="Inteligência artificial." description="A IA que atende na Eliza, na área do cliente, no site e no WhatsApp, usando as mesmas regras do sistema." badge={{ label: connected ? `CONECTADA · ${aiProviderLabel(settings).toUpperCase()}` : "Não conectada", tone: connected ? "is-ok" : "is-warning" }} tabs={TABS} current={tab} basePath="/integracoes/ia" />
    {params.aviso && notices[params.aviso] ? <p className="form-success" role="status">{notices[params.aviso]}</p> : null}
    {params.aviso === "teste" ? <p className="form-success" role="status">Conexão funcionando: {params.resultado?.slice(0, 700)}. <Link className="text-link" href="/assistente">Abrir o assistente</Link></p> : null}
    {params.erro ? <p className="form-error" role="alert">{params.erro.slice(0, 300)}</p> : null}
    {tab === "conexao" ? <AiConnectionPanel settings={settings} /> : null}
    {tab === "contexto" ? <AiContextPanel settings={settings} /> : null}
    {tab === "regras" ? <AiRulesPanel settings={settings} /> : null}
    {tab === "acesso" ? <AiAccessPanel settings={settings} /> : null}
    {tab === "atividade" ? <AiActivityPanel settings={settings} scope={params.escopo === "atendimento" ? "atendimento" : "gestao"} cursor={params.cursor} /> : null}
  </section></div></main>;
}
