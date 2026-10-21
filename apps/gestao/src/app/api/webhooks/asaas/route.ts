import { timingSafeEqual } from "node:crypto";
import { after, NextResponse } from "next/server";
import { hashToken } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";
import { processAsaasEvent, recordAsaasEvent } from "@/features/integrations/services/asaas-events";

const MAX_BODY_LENGTH = 128_000;

function constantTimeEqual(left: string, right: string) {
  const a = Buffer.from(left); const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Webhook do Asaas. O token (cabeçalho asaas-access-token) é o criado em Integrações; aqui só existe o hash dele.
 * O evento é gravado e a resposta sai na hora; o processamento roda em seguida, e o agendador tenta de novo se falhar.
 */
export async function POST(request: Request) {
  const supplied = request.headers.get("asaas-access-token");
  const integration = await prisma.paymentIntegration.findUnique({ where: { provider: "ASAAS" }, select: { isActive: true, webhookTokenHash: true } });
  if (!integration?.isActive || !integration.webhookTokenHash || !supplied || !constantTimeEqual(hashToken(supplied), integration.webhookTokenHash)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_LENGTH) return NextResponse.json({ error: "Payload muito grande" }, { status: 413 });
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_LENGTH) return NextResponse.json({ error: "Payload muito grande" }, { status: 413 });
  let body: { id?: unknown; event?: unknown; payment?: unknown };
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }); }
  if (typeof body.id !== "string" || typeof body.event !== "string") return NextResponse.json({ error: "Evento inválido" }, { status: 400 });
  const eventId = await recordAsaasEvent({ id: body.id, event: body.event, payment: body.payment });
  if (eventId) after(() => processAsaasEvent(eventId));
  return NextResponse.json({ received: true });
}
