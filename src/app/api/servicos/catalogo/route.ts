import { NextResponse } from "next/server";
import { findCatalogServicesForQuote, listCatalogCategoriesForQuote } from "@/features/quotes/queries/quote-queries";
import { getManagementUser } from "@/features/auth/services/auth-session";

/** Catálogo para o seletor de serviços da proposta: texto, categoria e página; categorias quando `facets=1`. */
export async function GET(request: Request) {
  if (!(await getManagementUser())) return Response.json({ error: "Não autorizado." }, { status: 403 });
  const params = new URL(request.url).searchParams;
  const [result, categories] = await Promise.all([
    findCatalogServicesForQuote({ query: params.get("q")?.slice(0, 100), categoryId: params.get("categoria") ?? undefined, offset: Number(params.get("offset") ?? 0) || 0 }),
    params.get("facets") === "1" ? listCatalogCategoriesForQuote() : Promise.resolve(undefined),
  ]);
  return NextResponse.json({ ...result, ...(categories ? { categories } : {}) });
}
