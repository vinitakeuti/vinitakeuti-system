import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { hashToken } from "@/lib/crypto";
import { prisma } from "@/lib/prisma";

const MAX_BODY_LENGTH = 128_000;
const paidEvents = new Set(["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED", "PAYMENT_RECEIVED_IN_CASH"]);
const cancelledEvents = new Set(["PAYMENT_DELETED", "PAYMENT_REFUNDED", "PAYMENT_REFUND_IN_PROGRESS"]);

function constantTimeEqual(left: string, right: string) {
  const a = Buffer.from(left); const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const supplied = request.headers.get("asaas-access-token");
  const configured = process.env.ASAAS_WEBHOOK_TOKEN?.trim();
  if (!configured || !supplied || !constantTimeEqual(hashToken(supplied), hashToken(configured))) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_LENGTH) return NextResponse.json({ error: "Payload muito grande" }, { status: 413 });
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_LENGTH) return NextResponse.json({ error: "Payload muito grande" }, { status: 413 });
  let body: { id?: string; event?: string; payment?: { id?: string; value?: number } };
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }); }
  if (!body.id || !body.event) return NextResponse.json({ error: "Evento inválido" }, { status: 400 });
  const event = await prisma.gatewayEvent.upsert({
    where: { eventKey: `asaas:${body.id}` }, update: {},
    create: { provider: "ASAAS", eventKey: `asaas:${body.id}`, eventName: body.event, providerPaymentId: body.payment?.id, amountCents: body.payment?.value ? Math.round(body.payment.value * 100) : null },
  });
  if (body.payment?.id) {
    const status = paidEvents.has(body.event) ? "PAID" : cancelledEvents.has(body.event) ? "CANCELLED" : body.event === "PAYMENT_OVERDUE" ? "OVERDUE" : null;
    if (status) await prisma.charge.updateMany({ where: { asaasPaymentId: body.payment.id }, data: { status, ...(status === "PAID" ? { paidAt: new Date() } : {}) } });
  }
  await prisma.gatewayEvent.update({ where: { id: event.id }, data: { processedAt: new Date() } });
  return NextResponse.json({ received: true });
}
