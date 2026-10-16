import { prisma } from "@/lib/prisma";

/** Orçamento de onde o texto padrão foi aberto, para oferecer o retorno ao editor do PDF. */
export async function getQuoteTextTemplateReturn(quoteId?: string) {
  if (!quoteId || !/^[a-z0-9]{1,50}$/i.test(quoteId)) return null;
  return prisma.quote.findUnique({ where: { id: quoteId }, select: { id: true, code: true } });
}

/** Texto padrão de um tipo de documento ("default" é o da proposta comercial). */
export async function getDocumentTextTemplate(templateId: string) {
  return prisma.quoteTextTemplate.findUnique({
    where: { id: templateId },
    select: { content: true, updatedAt: true },
  });
}

export async function getQuoteTextTemplate() {
  return getDocumentTextTemplate("default");
}
