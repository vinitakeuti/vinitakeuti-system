import { prisma } from "@/lib/prisma";
import { BRAND_TITLE } from "@/features/professional-profile/types/brand";

/** Identificação usada nos documentos enquanto o perfil profissional não tiver esses dados preenchidos. */
export const DEFAULT_PROFESSIONAL = { name: "Vinicius Riudi", document: "54.565.291/0001-94" } as const;

/** Perfil para PDFs e pré-visualizações: nome e CNPJ nunca ficam em branco. */
export async function getProfessionalProfileForDocuments() {
  const profile = await getProfessionalProfile();
  const empty = { professionalTitle: null, email: null, phone: null, address: null, city: null, state: null, website: null };
  return {
    ...empty,
    ...profile,
    name: profile?.name?.trim() || DEFAULT_PROFESSIONAL.name,
    document: profile?.document?.trim() || DEFAULT_PROFESSIONAL.document,
    // O título dos documentos é o mesmo da marca na barra lateral.
    professionalTitle: BRAND_TITLE,
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
    },
  });
}
