import { prisma } from "@/lib/prisma";

export async function getQuoteTextTemplate() {
  return prisma.quoteTextTemplate.findUnique({
    where: { id: "default" },
    select: { content: true, updatedAt: true },
  });
}
