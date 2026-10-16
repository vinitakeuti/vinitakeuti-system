import { redirect } from "next/navigation";

/** A produção agora acontece direto em Documentos: tipo no seletor, cliente e detalhes no mesmo painel. */
export default async function NewDocumentRedirect({ searchParams }: { searchParams: Promise<{ tipo?: string; clientId?: string }> }) {
  const { tipo, clientId } = await searchParams;
  const params = new URLSearchParams({ ...(tipo ? { tipo } : {}), ...(clientId ? { clientId } : {}) });
  redirect(`/documentos${params.size ? `?${params}` : ""}`);
}
