import { prisma } from "@/lib/prisma";
import { BRAND_TITLE } from "@/features/professional-profile/types/brand";
import { parseSignatureSvg } from "@/features/professional-profile/services/signature";

/** Identificação usada nos documentos enquanto o perfil profissional não tiver esses dados preenchidos. */
export const DEFAULT_PROFESSIONAL = { name: "Vinicius Riudi", document: "54.565.291/0001-94" } as const;

/** Perfil para PDFs e pré-visualizações: nome e CNPJ nunca ficam em branco. */
/** Assinatura dos PDFs, já reduzida aos traços (null se não houver). Consulta separada: o SVG não vai para a barra lateral. */
export async function getProfessionalSignature() {
  const profile = await prisma.professionalProfile.findUnique({ where: { id: "default" }, select: { signatureSvg: true } });
  return profile?.signatureSvg ? parseSignatureSvg(profile.signatureSvg) : null;
}

export async function getProfessionalProfileForDocuments() {
  const [profile, signature] = await Promise.all([getProfessionalProfile(), getProfessionalSignature()]);
  const empty = { professionalTitle: null, email: null, phone: null, address: null, city: null, state: null, website: null, pixKey: null, paymentInstructions: null };
  return {
    ...empty,
    ...profile,
    name: profile?.name?.trim() || DEFAULT_PROFESSIONAL.name,
    document: profile?.document?.trim() || DEFAULT_PROFESSIONAL.document,
    // O título dos documentos é o mesmo da marca na barra lateral.
    professionalTitle: BRAND_TITLE,
    signature,
  };
}

export async function getProfessionalProfile() {
  return prisma.professionalProfile.findUnique({
    where: { id: "default" },
    select: {
      name: true,
      professionalTitle: true,
      email: true,
      phone: true,
      document: true,
      address: true,
      city: true,
      state: true,
      website: true,
      pixKey: true,
      paymentInstructions: true,
    },
  });
}
