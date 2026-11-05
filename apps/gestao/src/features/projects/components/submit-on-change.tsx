"use client";

/** Lista de opções que envia o formulário ao mudar (situação e peso das subatividades). */
export function SubmitOnChangeSelect({ name, defaultValue, label, options, className }: { name: string; defaultValue: string; label: string; options: readonly { value: string; label: string }[]; className?: string }) {
  return <select className={className} name={name} defaultValue={defaultValue} aria-label={label} onChange={(event) => event.currentTarget.form?.requestSubmit()}>
    {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
  </select>;
}
