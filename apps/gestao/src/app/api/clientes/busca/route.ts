import { NextResponse } from "next/server";
import { searchClientOptions } from "@/features/clients/queries/client-queries";
import { getManagementUser } from "@/features/auth/services/auth-session";

export async function GET(request: Request) {
  if (!(await getManagementUser())) return Response.json({ error: "Não autorizado." }, { status: 403 });
  const query = new URL(request.url).searchParams.get("q")?.slice(0, 100);
  const data = await searchClientOptions(query);
  return NextResponse.json({ data });
}
