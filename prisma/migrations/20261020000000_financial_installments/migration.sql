-- CreateTable: parcelas combinadas de uma entrada
CREATE TABLE "FinancialInstallment" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinancialInstallment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FinancialInstallment_entryId_number_key" ON "FinancialInstallment"("entryId", "number");
CREATE INDEX "FinancialInstallment_dueDate_idx" ON "FinancialInstallment"("dueDate");

-- AddForeignKey
ALTER TABLE "FinancialInstallment" ADD CONSTRAINT "FinancialInstallment_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "FinancialEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
