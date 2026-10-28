/**
 * Fundo da abertura: linhas finas na inclinação das hastes do logo, com pulsos de luz descendo por algumas delas.
 * Gerado no servidor com uma semente fixa, então o desenho é sempre o mesmo e não pesa no navegador.
 */
import { seeded } from "@/lib/seeded";

const W = 1200;
const H = 720;
const RUN = (H * 501) / 445; // deslocamento horizontal de cada linha, na mesma inclinação do logo

const round = (value: number) => Math.round(value * 10) / 10;

function buildLines() {
  const next = seeded(7);
  const lines: { d: string; strong: boolean; pulse: null | { duration: number; delay: number; muted: boolean } }[] = [];
  for (let x = -RUN; x < W; x += 18 + next() * 46) {
    const start = next() < 0.35 ? next() * 0.4 : 0;
    const end = next() < 0.35 ? 0.6 + next() * 0.4 : 1;
    const d = `M${round(x + start * RUN)} ${round(start * H)}L${round(x + end * RUN)} ${round(end * H)}`;
    const pulse = next() < 0.2 ? { duration: round(6 + next() * 8), delay: round(-next() * 14), muted: next() < 0.4 } : null;
    lines.push({ d, strong: next() < 0.2, pulse });
  }
  return lines;
}

const LINES = buildLines();

export function HeroGraphic() {
  return <div className="site-hero-graphic" aria-hidden="true">
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMin slice">
      {LINES.map((line) => <path key={line.d} d={line.d} className={line.strong ? "is-strong" : undefined} />)}
      {LINES.filter((line) => line.pulse).map((line) => <path key={`pulse-${line.d}`} d={line.d} pathLength={1000} className={line.pulse!.muted ? "site-pulse is-muted" : "site-pulse"} style={{ animationDuration: `${line.pulse!.duration}s`, animationDelay: `${line.pulse!.delay}s` }} />)}
    </svg>
  </div>;
}
