"use client";

import { useState } from "react";
import type { SkillGroup } from "@/content/portfolio";

type Area = { area: string; groups: readonly SkillGroup[] };
type ProjectRef = { id: string; title: string };

/**
 * Habilidades, numa faixa de fundo próprio: uma grade de tecnologias por área, filtrável por tipo. Passar o mouse, focar
 * ou tocar numa tecnologia mostra onde ela foi usada, com link para o projeto; os quadrados de cada célula indicam em
 * quantos dos projetos ela aparece.
 */
export function PortfolioSkills({ skills, projects }: { skills: readonly Area[]; projects: readonly ProjectRef[] }) {
  const items = skills.flatMap((area) => area.groups.flatMap((group) => group.items));
  const places = [...new Set(items.flatMap((item) => item.used))];
  return <section className="pf-skills" id="habilidades" aria-labelledby="habilidades-title">
    <div className="pf-skills-inner">
      <div className="pf-gallery-head">
        <h2 id="habilidades-title">Habilidades</h2>
        <p>{items.length} tecnologias</p>
      </div>
      {skills.map((area, index) => <SkillArea key={area.area} area={area} index={index} places={places.length} projects={projects} />)}
    </div>
  </section>;
}

function SkillArea({ area, index, places, projects }: { area: Area; index: number; places: number; projects: readonly ProjectRef[] }) {
  const [filter, setFilter] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const items = area.groups.flatMap((group) => group.items.map((item) => ({ ...item, group: group.label })));
  const current = items.find((item) => item.name === active);
  const place = (used: string) => {
    const project = projects.find((entry) => entry.id === used);
    return project ? <a key={used} href={`#projeto-${project.id}`}>{project.title}</a> : <span key={used}>{used}</span>;
  };

  return <div className="pf-skill-area">
    <div className="pf-skill-side">
      <h3><span>{String(index + 1).padStart(2, "0")}</span>{area.area}</h3>
      <div className="pf-skill-filter" role="group" aria-label={`Filtrar ${area.area} por tipo`}>
        <button type="button" aria-pressed={filter === null} onClick={() => setFilter(null)}>Todas<span>{items.length}</span></button>
        {area.groups.map((group) => <button key={group.label} type="button" aria-pressed={filter === group.label} onClick={() => setFilter(filter === group.label ? null : group.label)}>{group.label}<span>{group.items.length}</span></button>)}
      </div>
    </div>
    <div className="pf-skill-board">
      <ul className="pf-skill-grid">
        {items.map((item) => <li key={item.name} className={filter && filter !== item.group ? "is-dim" : undefined}>
          <button type="button" aria-pressed={active === item.name} onMouseEnter={() => setActive(item.name)} onFocus={() => setActive(item.name)} onClick={() => setActive(item.name)}>
            <strong>{item.name}</strong>
            <small>{item.group}</small>
            {item.used.length > 0 && <>
              <span className="pf-skill-dots" aria-hidden="true">{Array.from({ length: places }, (_, index) => <i key={index} className={index < item.used.length ? "is-on" : undefined} />)}</span>
              <span className="sr-only">, usada em {item.used.length} de {places} projetos</span>
            </>}
          </button>
        </li>)}
      </ul>
      <div className="pf-skill-detail" aria-live="polite">
        {current
          ? <><p><small>{current.group}</small><strong>{current.name}</strong></p>{current.used.length > 0 && <p><small>Usada em</small><span>{current.used.map(place)}</span></p>}</>
          : <p className="pf-skill-hint">Passe o mouse ou toque numa tecnologia para ver onde ela foi usada.<span><span className="pf-skill-dots" aria-hidden="true"><i className="is-on" /><i className="is-on" /><i /></span>em quantos projetos aparece</span></p>}
      </div>
    </div>
  </div>;
}
