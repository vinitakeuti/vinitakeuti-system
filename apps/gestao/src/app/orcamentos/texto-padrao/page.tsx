import { redirect } from "next/navigation";

/** O texto padrão agora fica em Documentos, com um modelo para cada tipo de documento. */
export default async function QuoteTextTemplateRedirect({ searchParams }: { searchParams: Promise<{ updated?: string; orcamento?: string }> }) {
  const { updated, orcamento } = await searchParams;
  const params = new URLSearchParams({ tipo: "proposta", ...(orcamento ? { orcamento } : {}), ...(updated ? { updated } : {}) });
  redirect(`/documentos/texto-padrao?${params}`);
}
