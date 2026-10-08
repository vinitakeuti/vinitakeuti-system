import { AppSidebar } from "@/components/app-sidebar";
import { NotificationList, type DashboardNotification } from "@/components/notification-list";
import { SidebarToggle } from "@/components/sidebar-toggle";

export const dynamic = "force-dynamic";

const relevantNotifications: DashboardNotification[] = [
  { id: "payment-due", title: "Cobrança vence amanhã", detail: "Studio Aurum · R$ 2.800,00", state: "attention" },
  { id: "monitor-pending", title: "Monitoramento pendente", detail: "Defina o endpoint do Site institucional", state: "neutral" },
  { id: "contract-draft", title: "Contrato aguarda envio", detail: "Portal de vendas · rascunho salvo", state: "info" },
  { id: "security-update", title: "Atualização de segurança", detail: "Dependência com correção disponível", state: "attention" },
  { id: "deploy-complete", title: "Publicação concluída", detail: "Sistema de agenda · produção", state: "info" },
  { id: "certificate", title: "Certificado vence em breve", detail: "Site institucional · 14 dias restantes", state: "attention" },
];

const alerts = [
  ["Sistema do cliente", "API respondeu normalmente há 2 min", "ok"],
  ["Site institucional", "Monitoramento ainda não configurado", "neutral"],
  ["Financeiro", "3 recebimentos previstos nesta semana", "info"],
  ["Portal de vendas", "Resposta média de 184 ms", "ok"],
  ["Sistema de agenda", "Implantação concluída há 1 h", "info"],
  ["Painel administrativo", "Logs ainda não conectados", "neutral"],
];

const payments = [
  ["Studio Aurum", "R$ 2.800,00 · vence 26 set"],
  ["Alto Mar Engenharia", "R$ 1.450,00 · vence 28 set"],
  ["Portal de vendas", "R$ 950,00 · vence 30 set"],
  ["Sistema de agenda", "R$ 1.200,00 · vence 02 out"],
  ["Consultoria técnica", "R$ 2.050,00 · vence 05 out"],
];

export default function Home() {
  return (
    <main className="app-shell">
      <AppSidebar current="overview" />

      <div className="workspace">
        <header className="topbar"><div><p className="eyebrow">GESTÃO / OPERAÇÃO / 01</p><h1>Visão geral.</h1></div><div className="topbar-actions"><SidebarToggle location="header" /></div></header>
        <section id="visao-geral" className="overview" aria-label="Visão geral">
          <article className="revenue-summary">
            <div className="section-heading"><div><p className="eyebrow">FATURAMENTO / MENSAL</p><h2>Resultado financeiro</h2></div><span className="period-label">SETEMBRO / 2026</span></div>
            <div className="revenue-main"><div><span>Recebido no mês</span><strong>R$ 4.200,00</strong><small>49,7% do previsto</small></div><div className="revenue-progress" aria-label="49,7% do faturamento previsto realizado"><span /></div></div>
            <div className="revenue-breakdown">
              <div><span>Previsto</span><b>R$ 8.450,00</b></div>
              <div><span>Em aberto</span><b>R$ 4.250,00</b></div>
              <div><span>Atrasado</span><b className="attention-text">R$ 0,00</b></div>
            </div>
          </article>
          <article className="notification-panel" aria-labelledby="notifications-title">
            <div className="section-heading"><div><p className="eyebrow">ATENÇÃO / SISTEMA</p><h2 id="notifications-title">Notificações relevantes</h2></div><button className="text-button">VER HISTÓRICO</button></div>
            <NotificationList notifications={relevantNotifications} />
          </article>
        </section>
        <section className="main-grid">
          <div id="monitoramento" className="panel monitoring-panel">
            <div className="section-heading"><div><p className="eyebrow">MONITORAMENTO / LIVE</p><h2>Central de sinais</h2></div><button className="text-button">CONFIGURAR</button></div>
            <div className="alerts scroll-region">
              {alerts.map(([name, detail, state]) => <div className="alert-row" key={name}><span className={`signal ${state}`} /><div><b>{name}</b><small>{detail}</small></div><span className="chevron">›</span></div>)}
            </div>
          </div>
          <div id="financeiro" className="panel payments-panel">
            <div className="section-heading"><div><p className="eyebrow">FINANCEIRO / A RECEBER</p><h2>Próximos pagamentos</h2></div><button className="text-button">VER TODOS</button></div>
            <div className="payment-list scroll-region" aria-label="Lista de próximos pagamentos">
              {payments.map(([client, detail]) => <div className="payment-row" key={client}><span className="signal info" /><div><b>{client}</b><small>{detail}</small></div><span className="chevron">›</span></div>)}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
