import { prisma } from "@/lib/prisma";

/** Orçamento de onde o texto padrão foi aberto, para oferecer o retorno ao editor do PDF. */
export async function getQuoteTextTemplateReturn(quoteId?: string) {
  if (!quoteId || !/^[a-z0-9]{1,50}$/i.test(quoteId)) return null;
  return prisma.quote.findUnique({ where: { id: quoteId }, select: { id: true, code: true } });
}

export async function getQuoteTextTemplate() {
  return prisma.quoteTextTemplate.findUnique({
    where: { id: "default" },
    select: { content: true, updatedAt: true },
  });
}
