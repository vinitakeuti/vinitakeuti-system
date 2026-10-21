-- CreateTable
CREATE TABLE "RecurringEntry" (
    "id" TEXT NOT NULL,
    "type" "FinancialEntryType" NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "counterparty" TEXT,
    "amountCents" INTEGER NOT NULL,
    "dayOfMonth" INTEGER NOT NULL,
    "startsOn" TIMESTAMP(3) NOT NULL,
    "endsOn" TIMESTAMP(3),
    "generatedThrough" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringEntry_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "FinancialEntry" ADD COLUMN "recurringEntryId" TEXT;

-- CreateIndex
CREATE INDEX "RecurringEntry_endsOn_generatedThrough_idx" ON "RecurringEntry"("endsOn", "generatedThrough");
CREATE INDEX "RecurringEntry_type_createdAt_id_idx" ON "RecurringEntry"("type", "createdAt", "id");
CREATE INDEX "FinancialEntry_recurringEntryId_dueDate_idx" ON "FinancialEntry"("recurringEntryId", "dueDate");

-- AddForeignKey
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_recurringEntryId_fkey" FOREIGN KEY ("recurringEntryId") REFERENCES "RecurringEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Lançamentos marcados como recorrentes viram recorrências de verdade, a partir do mês do vencimento.
-- O próprio lançamento passa a ser a ocorrência daquele mês.
INSERT INTO "RecurringEntry" ("id", "type", "description", "category", "counterparty", "amountCents", "dayOfMonth", "startsOn", "generatedThrough", "notes", "updatedAt")
SELECT 'rec' || "id", "type", "description", "category", "counterparty", "amountCents",
  EXTRACT(DAY FROM ("dueDate" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Maceio')::INTEGER,
  date_trunc('month', ("dueDate" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Maceio') + INTERVAL '12 hours',
  date_trunc('month', ("dueDate" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Maceio') + INTERVAL '12 hours',
  "notes", CURRENT_TIMESTAMP
FROM "FinancialEntry" WHERE "isFixed" = true AND "status" <> 'CANCELLED';

UPDATE "FinancialEntry" SET "recurringEntryId" = 'rec' || "id",
  "sourceKey" = COALESCE("sourceKey", 'recurring:rec' || "id" || ':' || to_char(("dueDate" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Maceio', 'YYYY-MM'))
WHERE "isFixed" = true AND "status" <> 'CANCELLED';

-- Saídas não precisam ser confirmadas: contam como pagas na data do vencimento.
INSERT INTO "FinancialPayment" ("id", "entryId", "amountCents", "paidAt")
SELECT 'exp' || "id", "id", "amountCents" - "paidCents", "dueDate" FROM "FinancialEntry"
WHERE "type" = 'EXPENSE' AND "status" = 'PENDING' AND "amountCents" > "paidCents";
UPDATE "FinancialEntry" SET "paidCents" = "amountCents", "status" = 'SETTLED', "settledAt" = "dueDate"
WHERE "type" = 'EXPENSE' AND "status" = 'PENDING';
