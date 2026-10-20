import { NextResponse } from "next/server";
import { listClientQuotesForDocument } from "@/features/documents/queries/document-queries";
import { getManagementUser } from "@/features/auth/services/auth-session";

/** Propostas do cliente que podem servir de referência para um contrato, cessão ou memorial. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getManagementUser())) return Response.json({ error: "Não autorizado." }, { status: 403 });
  const { id } = await params;
  const quotes = await listClientQuotesForDocument(id.slice(0, 50));
  return NextResponse.json({ data: quotes.map((quote) => ({ id: quote.id, code: quote.code, title: quote.title, createdAt: quote.createdAt.toISOString() })) }, { headers: { "Cache-Control": "no-store" } });
}
