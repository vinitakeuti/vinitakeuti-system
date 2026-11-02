"use client";

import { useState } from "react";

/** Campo de texto com contador de caracteres (as instruções entram em toda resposta e contam no custo). */
export function CountedTextarea({ name, defaultValue, max, rows, placeholder, label }: { name: string; defaultValue: string; max: number; rows: number; placeholder: string; label: string }) {
  const [length, setLength] = useState(defaultValue.length);
  const near = length > max * 0.9;
  return <label className="settings-form-wide ai-instructions">
    <span className="ai-instructions-label"><span>{label}</span><small className={near ? "is-near" : undefined}>{length.toLocaleString("pt-BR")} de {max.toLocaleString("pt-BR")}</small></span>
    <textarea name={name} rows={rows} maxLength={max} defaultValue={defaultValue} placeholder={placeholder} onChange={(event) => setLength(event.target.value.length)} />
  </label>;
}
