import { NextResponse } from "next/server";
import { AsaasError, createAsaasCharge, ensureAsaasCustomer } from "@/lib/asaas";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { chargeId?: string; billingType?: "PIX" | "CREDIT_CARD" | "BOLETO" };
    if (!body.chargeId || !body.billingType) return NextResponse.json({ error: "Cobrança e método são obrigatórios." }, { status: 422 });
    const charge = await prisma.charge.findUnique({ where: { id: body.chargeId }, include: { client: true } });
    if (!charge) return NextResponse.json({ error: "Cobrança não encontrada." }, { status: 404 });
    const customer = await ensureAsaasCustomer({ clientId: charge.client.id, name: charge.client.name, email: charge.client.email, document: charge.client.document, phone: charge.client.phone });
    const remote = await createAsaasCharge({ customerId: customer.id, amountCents: charge.amountCents, description: charge.description, dueDate: charge.dueDate, billingType: body.billingType, externalReference: charge.id });
    await prisma.charge.update({ where: { id: charge.id }, data: { asaasPaymentId: remote.id, paymentMethod: body.billingType, status: "PENDING", invoiceUrl: remote.invoiceUrl } });
    return NextResponse.json({ paymentId: remote.id, invoiceUrl: remote.invoiceUrl });
  } catch (error) {
    const message = error instanceof AsaasError ? error.providerMessage ?? error.message : "Não foi possível gerar a cobrança.";
    const status = error instanceof AsaasError ? error.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
