import Link from "next/link";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { countOpenAsaasCharges, getAsaasIntegration } from "@/features/integrations/queries/integration-queries";
import { getAiSettingsView } from "@/features/ai/services/ai-settings";
import { aiIsConnected, aiProviderLabel, channelLabel } from "@/features/ai/components/ai-settings-panel";
import { getAiUsage } from "@/features/ai/queries/ai-queries";
import { emailConfigStatus } from "@/lib/integrations/email";

export const dynamic = "force-dynamic";

const dateTime = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Maceio" });

type Row = { href: string; code: string; name: string; description: string; pending: string; status: { label: string; tone: "is-ok" | "is-warning" }; facts: Array<[string, string]>; alert?: string | null };

/** Integrações: uma linha por serviço externo, com a situação e o caminho para a página de cada um. */
export default async function IntegrationsPage() {
  const [asaas, openCharges, ai, usage] = await Promise.all([getAsaasIntegration(), countOpenAsaasCharges(), getAiSettingsView(), getAiUsage()]);
  const email = emailConfigStatus();
  const asaasConnected = Boolean(asaas?.isActive && asaas.keyHint);
  const asaasProduction = asaas?.environment === "production";
  const aiConnected = aiIsConnected(ai);
  const webhookProblem = asaasConnected && asaas?.webhookStatus && asaas.webhookStatus !== "ACTIVE";

  const rows: Row[] = [
    {
      href: "/integracoes/asaas", code: "01", name: "Asaas", description: "Pagamentos online pelo portal (Pix, boleto e cartão), com baixa automática no Financeiro.", pending: "Conecte com uma chave de API do Asaas.",
      status: { label: asaasConnected ? (asaasProduction ? "Conectado · produção" : "Conectado · sandbox") : "Não conectado", tone: asaasConnected && asaasProduction ? "is-ok" : "is-warning" },
      facts: asaasConnected ? [["Conta", asaas?.accountName ?? "—"], ["Cobranças em aberto", String(openCharges)], ["Última conferência", asaas?.lastSyncAt ? dateTime.format(asaas.lastSyncAt) : "—"]] : [],
      alert: webhookProblem ? "O webhook não está ativo: os pagamentos chegam com atraso." : asaas?.lastError ?? null,
    },
    {
      href: "/integracoes/ia", code: "02", name: "Inteligência artificial", description: "Assistente da gestão, atendimento na área do cliente e no site, WhatsApp e MCP.", pending: "Escolha o provedor, cole a chave e selecione o modelo.",
      status: { label: aiConnected ? `Conectada · ${aiProviderLabel(ai)}` : "Não conectada", tone: aiConnected ? "is-ok" : "is-warning" },
      facts: aiConnected && ai ? [["Modelo", ai.model ?? "—"], ["Canais", ai.channels.length ? ai.channels.map((channel) => channelLabel[channel] ?? channel).join(", ") : "Nenhum"], ["Respostas hoje", `${usage.today}${ai.dailyRunLimit ? ` de ${ai.dailyRunLimit}` : ""}`]] : [],
      alert: ai?.lastError ?? null,
    },
    {
      href: "/configuracoes?secao=email", code: "03", name: "E-mail (SMTP)", description: "Envio dos e-mails para clientes e dos seus avisos. Configurado no servidor; testes e modelos ficam em Configurações.", pending: "Defina as variáveis SMTP do serviço no Easypanel.",
      status: { label: email.configured ? "Configurado" : "Não configurado", tone: email.configured ? "is-ok" : "is-warning" },
      facts: email.configured ? [["Servidor", `${email.host ?? "—"}${email.port ? `:${email.port}` : ""}`], ["Remetente", email.from ?? "—"]] : [],
      alert: email.configured ? null : `Faltam as variáveis ${email.missing.join(", ")}.`,
    },
  ];

  return <main className="app-shell"><AppSidebar current="integrations" /><div className="workspace"><section className="directory-page settings-page">
    <header className="directory-header"><div><h1>Integrações</h1><p>Serviços externos conectados à gestão e ao portal do cliente. Cada um tem a própria página; as chaves ficam criptografadas e nunca voltam para a tela.</p></div><div className="header-actions"><SidebarToggle location="header" /></div></header>
    <ul className="integration-list">
      {rows.map((row) => <li key={row.href}>
        <Link href={row.href}>
          <span className="integration-code">{row.code}</span>
          <span className="integration-main"><b>{row.name}</b><small>{row.description}</small>{row.alert ? <em>{row.alert}</em> : null}</span>
          {row.facts.length ? <dl>{row.facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl> : <span className="integration-pending">{row.pending}</span>}
          <span className="integration-side"><span className={`settings-badge ${row.status.tone}`}>{row.status.label}</span><span className="text-link">Abrir</span></span>
        </Link>
      </li>)}
    </ul>
  </section></div></main>;
}
