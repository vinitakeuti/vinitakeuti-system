/** Barra de progresso fina com o percentual. */
export function ProgressBar({ percent, label, size = "default" }: { percent: number; label?: string; size?: "default" | "small" }) {
  return <span className={`project-progress is-${size}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={label ?? "Concluído"}>
    <span className="project-progress-track"><i style={{ width: `${percent}%` }} /></span>
    <b>{percent}%</b>
  </span>;
}
