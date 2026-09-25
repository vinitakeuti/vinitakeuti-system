import { BudgetCalculator } from "@/components/budget-calculator";
import { Logo } from "@/components/logo";

const alerts = [
  ["Sistema do cliente", "API respondeu normalmente há 2 min", "ok"],
  ["Site institucional", "Monitoramento ainda não configurado", "neutral"],
  ["Financeiro", "3 recebimentos previstos nesta semana", "info"],
];

export default function Home() {
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <Logo />
        <nav aria-label="Navegação principal">
          <a className="nav-item active" href="#visao-geral"><span>◈</span>Visão geral</a>
          <a className="nav-item" href="#financeiro"><span>◫</span>Financeiro</a>
          <a className="nav-item" href="#calculadora"><span>⌁</span>Orçamentos</a>
          <a className="nav-item" href="#monitoramento"><span>◉</span>Monitoramento</a>
          <a className="nav-item" href="#sistemas"><span>▣</span>Sistemas</a>
          <a className="nav-item" href="#integracoes"><span>⟐</span>Integrações</a>
        </nav>
        <div className="sidebar-footer"><span className="status-dot" /> Operação privada</div>
      </aside>

      <div className="workspace">
        <header className="topbar"><div><p className="eyebrow">VINICIUS RIUDI</p><h1>Boa tarde, Vinicius.</h1></div><button className="profile" aria-label="Perfil de Vinicius Riudi">VR</button></header>
        <section id="visao-geral" className="overview" aria-label="Visão geral">
          <article className="metric-card income"><span>Entradas previstas</span><strong>R$ 8.450,00</strong><small>Próximos 30 dias</small></article>
          <article className="metric-card"><span>Em aberto</span><strong>3</strong><small>cobranças aguardando</small></article>
          <article className="metric-card"><span>Sistemas ativos</span><strong>0</strong><small>conecte seu primeiro monitor</small></article>
          <article className="metric-card"><span>Projetos em andamento</span><strong>0</strong><small>comece pelo primeiro cliente</small></article>
        </section>
        <section className="main-grid">
          <div id="monitoramento" className="panel monitoring-panel">
            <div className="section-heading"><div><p className="eyebrow">MONITORAMENTO</p><h2>Central de sinais</h2></div><button className="text-button">Configurar</button></div>
            <div className="alerts">
              {alerts.map(([name, detail, state]) => <div className="alert-row" key={name}><span className={`signal ${state}`} /><div><b>{name}</b><small>{detail}</small></div><span className="chevron">›</span></div>)}
            </div>
          </div>
          <div id="financeiro" className="panel payments-panel">
            <div className="section-heading"><div><p className="eyebrow">FINANCEIRO</p><h2>Próximos pagamentos</h2></div><button className="text-button">Ver todos</button></div>
            <div className="empty-state"><span className="empty-icon">R$</span><p>Nenhuma cobrança cadastrada.</p><small>As cobranças criadas aqui poderão ser enviadas pelo Asaas.</small></div>
          </div>
        </section>
        <div id="calculadora"><BudgetCalculator /></div>
        <section id="sistemas" className="foundation-note"><span>PRÓXIMA ETAPA</span><p>Cadastre clientes, conecte os sistemas e defina os endpoints de saúde e logs para iniciar a vigilância.</p></section>
        <section id="integracoes" className="integration-strip"><div><span className="integration-dot" /> <b>Asaas preparado</b><small>Configure as credenciais do ambiente no EasyPanel.</small></div><code>POST /api/webhooks/asaas</code></section>
      </div>
    </main>
  );
}
