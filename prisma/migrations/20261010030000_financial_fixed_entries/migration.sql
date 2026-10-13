ALTER TABLE "FinancialEntry" ADD COLUMN "isFixed" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "FinancialEntry_isFixed_type_status_idx" ON "FinancialEntry"("isFixed", "type", "status");
