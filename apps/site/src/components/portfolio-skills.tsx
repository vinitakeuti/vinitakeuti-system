"use client";

import { useState } from "react";
import type { SkillGroup } from "@/content/portfolio";

type Area = { area: string; groups: readonly SkillGroup[] };

/**
 * Habilidades, numa faixa de fundo próprio no fim da página. As tecnologias ficam fechadas: só aparecem quando uma área
 * é escolhida, em colunas por tipo; tocar de novo na área aberta fecha a lista.
 */
export function PortfolioSkills({ skills }: { skills: readonly Area[] }) {
  const [selected, setSelected] = useState<number | null>(null);
  const area = selected === null ? null : skills[selected];

  return <section className="pf-skills" id="habilidades" aria-labelledby="habilidades-title">
    <div className="pf-skills-inner">
      <div className="pf-skills-head">
        <h2 id="habilidades-title">Habilidades</h2>
        <div className="pf-skills-tabs" role="group" aria-label="Áreas">
          {skills.map((entry, index) => <button key={entry.area} id={`habilidades-area-${index}`} type="button" aria-expanded={index === selected} aria-controls="habilidades-painel" onClick={() => setSelected(index === selected ? null : index)}>
            {entry.area}<span>{entry.groups.reduce((count, group) => count + group.items.length, 0)}</span>
          </button>)}
        </div>
      </div>
      <div id="habilidades-painel" role="region" aria-label={area ? `Tecnologias de ${area.area}` : "Tecnologias"}>
        {area ? <dl key={area.area} className="pf-skills-board">
          {area.groups.map((group, index) => <div key={group.label} style={{ "--i": index } as React.CSSProperties}>
            <dt>{group.label}</dt>
            {group.items.map((item) => <dd key={item}>{item}</dd>)}
          </div>)}
        </dl> : <p className="pf-skills-hint">Escolha uma área para ver as tecnologias.</p>}
      </div>
    </div>
  </section>;
}
