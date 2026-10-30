"use client";

import { useState } from "react";
import type { SkillGroup } from "@/content/portfolio";

type Area = { area: string; groups: readonly SkillGroup[] };

/**
 * Habilidades, numa faixa de fundo próprio: uma aba por área e, abaixo, as tecnologias em colunas por tipo.
 * Trocar de aba faz as colunas entrarem em sequência; passar o mouse num nome destaca só ele.
 */
export function PortfolioSkills({ skills }: { skills: readonly Area[] }) {
  const [selected, setSelected] = useState(0);
  const area = skills[selected];

  function keys(event: React.KeyboardEvent) {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    const next = (selected + step + skills.length) % skills.length;
    setSelected(next);
    document.getElementById(`habilidades-aba-${next}`)?.focus();
  }

  return <section className="pf-skills" id="habilidades" aria-labelledby="habilidades-title">
    <div className="pf-skills-inner">
      <div className="pf-skills-head">
        <h2 id="habilidades-title">Habilidades</h2>
        <div className="pf-skills-tabs" role="tablist" aria-label="Áreas" onKeyDown={keys}>
          {skills.map((entry, index) => <button key={entry.area} id={`habilidades-aba-${index}`} type="button" role="tab" aria-selected={index === selected} aria-controls="habilidades-painel" tabIndex={index === selected ? 0 : -1} onClick={() => setSelected(index)}>
            {entry.area}<span>{entry.groups.reduce((count, group) => count + group.items.length, 0)}</span>
          </button>)}
        </div>
      </div>
      <dl key={area.area} className="pf-skills-board" id="habilidades-painel" role="tabpanel" aria-labelledby={`habilidades-aba-${selected}`}>
        {area.groups.map((group, index) => <div key={group.label} style={{ "--i": index } as React.CSSProperties}>
          <dt>{group.label}</dt>
          {group.items.map((item) => <dd key={item}>{item}</dd>)}
        </div>)}
      </dl>
    </div>
  </section>;
}
