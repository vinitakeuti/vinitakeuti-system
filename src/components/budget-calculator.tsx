"use client";

import { useMemo, useState } from "react";

const formatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function BudgetCalculator() {
  const [hours, setHours] = useState(48);
  const [rate, setRate] = useState(110);
  const [complexity, setComplexity] = useState(20);
  const [costs, setCosts] = useState(450);
  const result = useMemo(() => {
    const productionCost = hours * rate + costs;
    const price = productionCost * (1 + complexity / 100);
    return { productionCost, price, days: Math.max(1, Math.ceil(hours / 6)) };
  }, [hours, rate, complexity, costs]);

  return (
    <section className="calculator" aria-labelledby="calculator-title">
      <div className="section-heading">
        <div><p className="eyebrow">ORÇAMENTO</p><h2 id="calculator-title">Estimativa rápida</h2></div>
        <span className="ai-label">IA em breve</span>
      </div>
      <p className="muted">Use como ponto de partida; a análise de escopo por IA entrará nesta mesma tela.</p>
      <div className="calculator-grid">
        <label>Horas de produção<input type="number" min="1" value={hours} onChange={(event) => setHours(Math.max(1, Number(event.target.value)))} /></label>
        <label>Valor/hora<input type="number" min="1" value={rate} onChange={(event) => setRate(Math.max(1, Number(event.target.value)))} /></label>
        <label>Margem de complexidade<input type="number" min="0" max="100" value={complexity} onChange={(event) => setComplexity(Math.min(100, Math.max(0, Number(event.target.value))))} /></label>
        <label>Custos externos<input type="number" min="0" value={costs} onChange={(event) => setCosts(Math.max(0, Number(event.target.value)))} /></label>
      </div>
      <div className="estimate-result">
        <div><span>Preço sugerido</span><strong>{formatter.format(result.price)}</strong></div>
        <div><span>Custo de produção</span><b>{formatter.format(result.productionCost)}</b></div>
        <div><span>Prazo estimado</span><b>{result.days} dias úteis</b></div>
      </div>
    </section>
  );
}
