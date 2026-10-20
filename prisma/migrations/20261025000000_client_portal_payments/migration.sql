-- AlterTable: chave Pix e instruções de pagamento mostradas no portal do cliente
ALTER TABLE "ProfessionalProfile" ADD COLUMN "pixKey" TEXT;
ALTER TABLE "ProfessionalProfile" ADD COLUMN "paymentInstructions" TEXT;

-- AlterTable: cobrança online ligada ao lançamento e à parcela do Financeiro
ALTER TABLE "Charge" ADD COLUMN "financialEntryId" TEXT;
ALTER TABLE "Charge" ADD COLUMN "installmentNumber" INTEGER;

-- AlterTable: pagamento registrado a partir de uma cobrança online (sem duplicar)
ALTER TABLE "FinancialPayment" ADD COLUMN "chargeId" TEXT;

-- CreateTable: avisos de pagamento feitos pelo cliente no portal
CREATE TABLE "PaymentNotice" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "financialEntryId" TEXT NOT NULL,
    "installmentNumber" INTEGER,
    "amountCents" INTEGER NOT NULL,
    "paidOn" TIMESTAMP(3) NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentNotice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FinancialPayment_chargeId_key" ON "FinancialPayment"("chargeId");
CREATE INDEX "Charge_financialEntryId_installmentNumber_idx" ON "Charge"("financialEntryId", "installmentNumber");
CREATE INDEX "PaymentNotice_financialEntryId_status_idx" ON "PaymentNotice"("financialEntryId", "status");
CREATE INDEX "PaymentNotice_clientId_createdAt_idx" ON "PaymentNotice"("clientId", "createdAt");
CREATE INDEX "PaymentNotice_status_createdAt_idx" ON "PaymentNotice"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "PaymentNotice" ADD CONSTRAINT "PaymentNotice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
