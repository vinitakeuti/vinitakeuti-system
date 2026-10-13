-- AlterTable
ALTER TABLE "Quote" ADD COLUMN "completedAt" TIMESTAMP(3),
ADD COLUMN "paymentNotes" TEXT;

-- Orçamentos já existentes: são considerados concluídos quando saíram de rascunho,
-- viraram venda ou foram alterados depois da criação (editor salvo ou edição).
-- Rascunhos nunca alterados após a criação permanecem pendentes de conclusão.
UPDATE "Quote" AS q
SET "completedAt" = q."updatedAt"
WHERE q."status" <> 'DRAFT'
   OR q."updatedAt" > q."createdAt" + INTERVAL '5 seconds'
   OR EXISTS (SELECT 1 FROM "Sale" AS s WHERE s."quoteId" = q."id");

-- CreateTable
CREATE TABLE "QuotePayment" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuotePayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuotePayment_quoteId_paidAt_id_idx" ON "QuotePayment"("quoteId", "paidAt", "id");

-- CreateIndex
CREATE INDEX "Quote_completedAt_updatedAt_id_idx" ON "Quote"("completedAt", "updatedAt", "id");

-- AddForeignKey
ALTER TABLE "QuotePayment" ADD CONSTRAINT "QuotePayment_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
