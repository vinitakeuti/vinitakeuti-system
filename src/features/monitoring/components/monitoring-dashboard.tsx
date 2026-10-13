type Summary = { total: number; operational: number; degraded: number; down: number; unknown: number };

const segments = [
  { key: "operational", label: "Operacionais", attention: false },
  { key: "degraded", label: "Degradados", attention: true },
  { key: "down", label: "Indisponíveis", attention: true },
  { key: "unknown", label: "Não verificados", attention: false },
] as const;

function percent(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0;
}

/** Painel de status. Cor de fundo só aparece quando há sistemas pedindo atenção. */
export function MonitoringDashboard({ summary }: { summary: Summary }) {
  const attention = summary.degraded + summary.down;

  return <section className="monitor-dashboard" aria-label="Resumo do monitoramento">
    <div className="monitor-dashboard-total">
      <span>SISTEMAS</span>
      <strong>{summary.total}</strong>
      <small>{!summary.total ? "Nenhum sistema cadastrado" : attention ? `${attention} ${attention === 1 ? "pede" : "pedem"} atenção` : "Nenhum alerta no momento"}</small>
    </div>
    <dl className="monitor-dashboard-tiles">
      {segments.map((segment) => {
        const value = summary[segment.key];
        return <div key={segment.key} className={`monitor-tile monitor-tile-${segment.key}${value ? "" : " is-zero"}${segment.attention && value ? " needs-attention" : ""}`}>
          <dt><i aria-hidden="true" />{segment.label}</dt>
          <dd>{value}</dd>
          <small>{summary.total ? `${percent(value, summary.total)}% do total` : "—"}</small>
        </div>;
      })}
    </dl>
  </section>;
}
