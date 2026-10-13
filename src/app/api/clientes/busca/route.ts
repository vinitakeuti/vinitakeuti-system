import { NextResponse } from "next/server";
import { searchClientOptions } from "@/features/clients/queries/client-queries";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.slice(0, 100);
  const data = await searchClientOptions(query);
  return NextResponse.json({ data });
}
