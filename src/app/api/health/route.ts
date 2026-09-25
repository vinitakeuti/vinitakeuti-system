import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({ status: "ok", service: "vr-gestao", timestamp: new Date().toISOString() });
}
