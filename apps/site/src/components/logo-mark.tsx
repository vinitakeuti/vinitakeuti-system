/** Traços do logo VR (mesmos de public/logo-vr.svg), desenhados na cor do texto para funcionar no fundo escuro. */
const MARK = ["M316 233H451L817 678L659 829L316 415Z", "M595 212L1021 213L1151 357V617L928 361H716Z", "M804 428H899L1156 738V825H994L735 499Z"];

export function LogoMark({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 880 657" aria-hidden="true"><g fill="currentColor" transform="translate(-296 -192)">{MARK.map((d) => <path key={d} d={d} />)}</g></svg>;
}

/** O logo só em contorno, com um pulso de luz percorrendo cada traço. Usado como fundo decorativo. */
export function LogoOutline({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 880 657" aria-hidden="true">
    <g fill="none" transform="translate(-296 -192)">
      {MARK.map((d) => <path key={d} d={d} stroke="currentColor" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />)}
      {MARK.map((d, index) => <path key={`pulse-${d}`} className="site-pulse" d={d} pathLength={1000} style={{ animationDuration: `${7 + index * 2}s`, animationDelay: `${-index * 2.4}s` }} />)}
    </g>
  </svg>;
}
