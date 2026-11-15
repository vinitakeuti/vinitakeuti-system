"use client";

import styles from "@/app/financeiro/financeiro.module.css";

/** Escolha entre poucas opções (tipo, empresa ou pessoal, repetição): botões de rádio lado a lado, enviados pelo `name`. */
export function Segmented<T extends string>({ legend, name, value, options, onChange }: { legend: string; name: string; value: T; options: Array<{ value: T; label: string }>; onChange: (value: T) => void }) {
  return <fieldset className={styles.segmented}>
    <legend>{legend}</legend>
    <div className={styles.segmentedOptions}>
      {options.map((option) => <label key={option.value}>
        <input type="radio" name={name} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} />
        <span>{option.label}</span>
      </label>)}
    </div>
  </fieldset>;
}
