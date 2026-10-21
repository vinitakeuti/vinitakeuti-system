/** Vetores da logo VR (public/assets/images/logo-vr.svg), usados para desenhá-la em qualquer cor e tamanho. */
export const BRAND_MARK_VIEWBOX = "0 0 880 657";
export const BRAND_MARK_TRANSFORM = "translate(-296 -192)";
export const BRAND_MARK_PATHS = [
  "M316 233H451L817 678L659 829L316 415Z",
  "M595 212L1021 213L1151 357V617L928 361H716Z",
  "M804 428H899L1156 738V825H994L735 499Z",
] as const;

/** Paleta da capa escura da proposta, compartilhada entre o PDF e a pré-visualização do editor. */
export const COVER_COLORS = {
  background: "#1B1C1B",
  mark: "#3F5649",
  label: "#A9C2B4",
  text: "#FFFFFF",
  soft: "#C9CEC9",
  muted: "#8F948F",
  panel: "#242725",
} as const;

/**
 * Posição e tamanho do título na capa, em pontos do PDF.
 * Títulos curtos ficam ao lado da logo; títulos longos descem para baixo dela e usam toda a largura,
 * com fonte proporcional ao comprimento para não virar uma coluna de uma palavra por linha.
 */
export function coverTitleLayout(title: string) {
  const length = title.trim().length;
  if (length <= 20) return { top: 200, maxWidth: 230, fontSize: 36 };
  const fontSize = length <= 32 ? 34 : length <= 52 ? 30 : length <= 80 ? 25 : 21;
  return { top: 296, maxWidth: 491, fontSize };
}

/** Converte pontos do PDF (A4 com 595pt de largura) para unidades proporcionais à largura da capa no editor. */
export function pointsToCoverCqw(points: number) {
  return `${((points * 100) / 595).toFixed(2)}cqw`;
}

/** Paletas das capas de contrato, cessão e memorial técnico (PDF e pré-visualização usam as mesmas cores). */
export const CONTRACT_COVER_COLORS = { background: "#F4F3EF", band: "#1B1C1B", accent: "#4B6156", text: "#111111", muted: "#6B706C", line: "#1B1C1B", watermark: "#E6E4DE" } as const;
export const ASSIGNMENT_COVER_COLORS = { background: "#24332C", mark: "#2C3F35", panel: "#2E4238", accent: "#B9D3C4", text: "#FFFFFF", soft: "#C9D6CF", muted: "#8FA89A" } as const;
export const MEMORIAL_COVER_COLORS = { background: "#FFFFFF", grid: "#F1F5F2", gridLine: "#DCE5DF", accent: "#4B6156", text: "#111111", muted: "#6B706C", line: "#C9D3CD" } as const;

/** Área quadriculada da capa do memorial técnico, em pontos. */
export const MEMORIAL_GRID = { height: 460, step: 18 } as const;

/** Tamanho do título nas capas de contrato, cessão e memorial: diminui conforme o comprimento, para caber na largura. */
export function coverTitleSize(title: string) {
  const length = title.trim().length;
  return length <= 20 ? 34 : length <= 34 ? 30 : length <= 54 ? 26 : length <= 80 ? 22 : 19;
}
