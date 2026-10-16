-- AlterTable: soma do que já foi recebido ou pago em cada lançamento
ALTER TABLE "FinancialEntry" ADD COLUMN "paidCents" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "FinancialPayment" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "fromSale" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinancialPayment_entryId_paidAt_id_idx" ON "FinancialPayment"("entryId", "paidAt", "id");
CREATE INDEX "FinancialPayment_paidAt_idx" ON "FinancialPayment"("paidAt");

-- AddForeignKey
ALTER TABLE "FinancialPayment" ADD CONSTRAINT "FinancialPayment_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "FinancialEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Lançamentos já realizados passam a ter um recebimento do valor cheio, na data em que foram marcados como realizados.
INSERT INTO "FinancialPayment" ("id", "entryId", "amountCents", "paidAt")
SELECT 'mig' || "id", "id", "amountCents", COALESCE("settledAt", "dueDate") FROM "FinancialEntry" WHERE "status" = 'SETTLED';
UPDATE "FinancialEntry" SET "paidCents" = "amountCents" WHERE "status" = 'SETTLED';
