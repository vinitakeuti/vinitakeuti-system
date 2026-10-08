import { NextResponse } from "next/server";
import { findCatalogServicesForQuote } from "@/features/quotes/queries/quote-queries";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.slice(0, 100);
  const data = await findCatalogServicesForQuote(query);
  return NextResponse.json({ data });
}
