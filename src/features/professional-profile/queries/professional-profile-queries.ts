import { prisma } from "@/lib/prisma";

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
