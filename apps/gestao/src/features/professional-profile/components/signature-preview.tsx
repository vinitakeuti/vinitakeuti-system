import type { ParsedSignature } from "@/features/professional-profile/services/signature";

/** Pré-visualização da assinatura, redesenhada a partir dos traços validados (nunca como HTML bruto). */
export function SignaturePreview({ signature }: { signature: ParsedSignature }) {
  return <svg className="signature-preview" viewBox={signature.viewBox.join(" ")} role="img" aria-label="Sua assinatura">
    {signature.paths.map((path, index) => <path key={index} d={path.d} fill={path.fill} stroke={path.stroke ?? undefined} strokeWidth={path.strokeWidth ?? undefined} strokeLinecap={path.strokeLinecap ?? undefined} strokeLinejoin={path.strokeLinejoin ?? undefined} />)}
  </svg>;
}
