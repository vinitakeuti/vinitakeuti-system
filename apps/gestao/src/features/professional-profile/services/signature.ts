/**
 * Assinatura do profissional em SVG, para as folhas de assinatura dos PDFs. Do arquivo enviado só ficam os traços
 * (elementos path com cor e espessura); metadados, textos, imagens e scripts são descartados. O resultado é guardado
 * como um SVG mínimo e redesenhado nos PDFs e na pré-visualização a partir desses dados, nunca como HTML bruto.
 */
export const MAX_SIGNATURE_FILE_BYTES = 300 * 1024;
const MAX_PATHS = 200;
const MAX_PATH_DATA = 400_000;

export type SignaturePath = { d: string; fill: string; stroke: string | null; strokeWidth: number | null; strokeLinecap: "butt" | "round" | "square" | null; strokeLinejoin: "miter" | "round" | "bevel" | null };
export type ParsedSignature = { viewBox: [number, number, number, number]; paths: SignaturePath[] };

const PATH_DATA = /^[MmLlHhVvCcSsQqTtAaZz0-9eE.,\s+-]+$/;
const COLOR = /^(#[0-9a-fA-F]{3,8}|none|black|currentColor)$/;

function attribute(tag: string, name: string) {
  const match = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`));
  return match ? (match[2] ?? match[3] ?? "").trim() : null;
}

function color(value: string | null, fallback: string) {
  if (!value) return fallback;
  return COLOR.test(value) ? (value === "currentColor" ? "#000000" : value) : fallback;
}

function numbers(value: string | null) {
  return value ? value.split(/[\s,]+/).filter(Boolean).map(Number) : [];
}

/** Lê o SVG e devolve só os traços, ou null se não houver um desenho válido. */
export function parseSignatureSvg(source: string): ParsedSignature | null {
  const text = source.replace(/<!--[\s\S]*?-->/g, "").replace(/<metadata[\s\S]*?<\/metadata>/gi, "").replace(/<(script|style|title|desc)[\s\S]*?<\/\1>/gi, "");
  const svgTag = text.match(/<svg\b[^>]*>/i)?.[0];
  if (!svgTag) return null;
  let viewBox = numbers(attribute(svgTag, "viewBox"));
  if (viewBox.length !== 4) {
    const width = Number.parseFloat(attribute(svgTag, "width") ?? "");
    const height = Number.parseFloat(attribute(svgTag, "height") ?? "");
    viewBox = Number.isFinite(width) && Number.isFinite(height) ? [0, 0, width, height] : [];
  }
  if (viewBox.length !== 4 || viewBox.some((value) => !Number.isFinite(value)) || viewBox[2] <= 0 || viewBox[3] <= 0) return null;

  const paths: SignaturePath[] = [];
  let total = 0;
  for (const tag of text.match(/<path\b[^>]*\/?>/gi) ?? []) {
    const d = attribute(tag, "d");
    if (!d || !PATH_DATA.test(d)) continue;
    total += d.length;
    if (paths.length >= MAX_PATHS || total > MAX_PATH_DATA) return null;
    const strokeWidth = Number.parseFloat(attribute(tag, "stroke-width") ?? "");
    const linecap = attribute(tag, "stroke-linecap");
    const linejoin = attribute(tag, "stroke-linejoin");
    paths.push({
      d: d.replace(/\s+/g, " "),
      fill: color(attribute(tag, "fill"), "#000000"),
      stroke: attribute(tag, "stroke") ? color(attribute(tag, "stroke"), "none") : null,
      strokeWidth: Number.isFinite(strokeWidth) && strokeWidth > 0 && strokeWidth < 100 ? strokeWidth : null,
      strokeLinecap: linecap === "butt" || linecap === "round" || linecap === "square" ? linecap : null,
      strokeLinejoin: linejoin === "miter" || linejoin === "round" || linejoin === "bevel" ? linejoin : null,
    });
  }
  return paths.length ? { viewBox: viewBox as ParsedSignature["viewBox"], paths } : null;
}

/** SVG mínimo guardado no banco: só o viewBox e os traços já validados. */
export function serializeSignature(signature: ParsedSignature) {
  const escape = (value: string) => value.replace(/[<>&"]/g, "");
  const paths = signature.paths.map((path) => `<path d="${escape(path.d)}" fill="${escape(path.fill)}"${path.stroke ? ` stroke="${escape(path.stroke)}"` : ""}${path.strokeWidth ? ` stroke-width="${path.strokeWidth}"` : ""}${path.strokeLinecap ? ` stroke-linecap="${path.strokeLinecap}"` : ""}${path.strokeLinejoin ? ` stroke-linejoin="${path.strokeLinejoin}"` : ""}/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${signature.viewBox.join(" ")}">${paths}</svg>`;
}
