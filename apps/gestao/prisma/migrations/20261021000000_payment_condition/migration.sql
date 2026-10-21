-- AlterTable: condição especial de pagamento do lançamento
ALTER TABLE "FinancialEntry" ADD COLUMN "paymentCondition" TEXT;

-- CreateIndex
CREATE INDEX "FinancialEntry_paymentCondition_status_dueDate_idx" ON "FinancialEntry"("paymentCondition", "status", "dueDate");
