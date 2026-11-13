/** Ícones da página de tráfego, em traço, na cor do texto (mesmos desenhos da referência). */
type IconProps = { size?: number; width?: number; className?: string };

const line = { fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round" } as const;

export function IconArrowRight({ size = 18, width = 2.2, className }: IconProps) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" {...line} strokeWidth={width} aria-hidden="true"><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></svg>;
}

export function IconChevron({ direction, size = 18 }: { direction: "left" | "right"; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" {...line} strokeWidth={2.2} aria-hidden="true"><path d={direction === "left" ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} /></svg>;
}

export function IconCheck({ size = 18, width = 2.6, className }: IconProps) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" {...line} strokeWidth={width} aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>;
}

export function IconClock({ size = 14 }: IconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" {...line} strokeWidth={2.4} aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
}

export function IconCode({ size = 20 }: IconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" {...line} strokeWidth={2} aria-hidden="true"><path d="M8 8l-4 4 4 4" /><path d="M16 8l4 4-4 4" /><path d="M13.5 5l-3 14" /></svg>;
}

export function IconArrowUpRight({ size = 16 }: IconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" {...line} strokeWidth={2} aria-hidden="true"><path d="M7 17L17 7" /><path d="M8 7h9v9" /></svg>;
}

/** Estrela de quatro pontas que separa os itens da faixa. */
export function IconSpark({ size = 12 }: IconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0c.8 6.4 5.6 11.2 12 12-6.4.8-11.2 5.6-12 12-.8-6.4-5.6-11.2-12-12C6.4 11.2 11.2 6.4 12 0z" /></svg>;
}

/** Símbolo do WhatsApp em uma cor só (a do texto), para os botões de conversa. */
export function IconWhatsApp({ size = 22, className }: IconProps) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>;
}
