CREATE TYPE "FinancialEntryType" AS ENUM ('INCOME', 'EXPENSE');
CREATE TYPE "FinancialEntryStatus" AS ENUM ('PENDING', 'SETTLED', 'CANCELLED');
CREATE TYPE "FinancialEntryOrigin" AS ENUM ('MANUAL', 'QUOTE');

CREATE TABLE "FinancialEntry" (
  "id" TEXT NOT NULL,
  "type" "FinancialEntryType" NOT NULL,
  "status" "FinancialEntryStatus" NOT NULL DEFAULT 'PENDING',
  "origin" "FinancialEntryOrigin" NOT NULL DEFAULT 'MANUAL',
  "sourceKey" TEXT,
  "description" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "counterparty" TEXT,
  "amountCents" INTEGER NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "settledAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FinancialEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FinancialEntry_sourceKey_key" ON "FinancialEntry"("sourceKey");
CREATE INDEX "FinancialEntry_status_dueDate_id_idx" ON "FinancialEntry"("status", "dueDate", "id");
CREATE INDEX "FinancialEntry_type_dueDate_id_idx" ON "FinancialEntry"("type", "dueDate", "id");
CREATE INDEX "FinancialEntry_createdAt_id_idx" ON "FinancialEntry"("createdAt", "id");
