-- CreateEnum
CREATE TYPE "FinanceScope" AS ENUM ('BUSINESS', 'PERSONAL');

-- AlterTable
ALTER TABLE "FinancialEntry" ADD COLUMN     "accountId" TEXT,
ADD COLUMN     "scope" "FinanceScope" NOT NULL DEFAULT 'BUSINESS',
ADD COLUMN     "seriesId" TEXT;

-- AlterTable
ALTER TABLE "RecurringEntry" ADD COLUMN     "accountId" TEXT,
ADD COLUMN     "scope" "FinanceScope" NOT NULL DEFAULT 'BUSINESS';

-- CreateTable
CREATE TABLE "FinanceAccount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceCategory" (
    "id" TEXT NOT NULL,
    "scope" "FinanceScope" NOT NULL,
    "type" "FinancialEntryType" NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FinanceAccount_name_key" ON "FinanceAccount"("name");

-- CreateIndex
CREATE INDEX "FinanceAccount_archivedAt_name_idx" ON "FinanceAccount"("archivedAt", "name");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceCategory_scope_type_name_key" ON "FinanceCategory"("scope", "type", "name");

-- CreateIndex
CREATE INDEX "FinancialEntry_scope_dueDate_idx" ON "FinancialEntry"("scope", "dueDate");

-- CreateIndex
CREATE INDEX "FinancialEntry_accountId_dueDate_idx" ON "FinancialEntry"("accountId", "dueDate");

-- CreateIndex
CREATE INDEX "FinancialEntry_seriesId_dueDate_idx" ON "FinancialEntry"("seriesId", "dueDate");

-- CreateIndex
CREATE INDEX "RecurringEntry_accountId_idx" ON "RecurringEntry"("accountId");

-- AddForeignKey
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinanceAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringEntry" ADD CONSTRAINT "RecurringEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinanceAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Categorias iniciais por escopo e tipo, mais as que os lançamentos já usam (todos eram da empresa).
INSERT INTO "FinanceCategory" ("id", "scope", "type", "name")
SELECT 'fcat' || substr(md5(random()::text || clock_timestamp()::text || v.scope || v.type || v.name), 1, 21), v.scope::"FinanceScope", v.type::"FinancialEntryType", v.name
FROM (VALUES
  ('BUSINESS', 'INCOME', 'Vendas'),
  ('BUSINESS', 'INCOME', 'Serviços recorrentes'),
  ('BUSINESS', 'INCOME', 'Rendimentos'),
  ('BUSINESS', 'INCOME', 'Outros'),
  ('BUSINESS', 'EXPENSE', 'Impostos'),
  ('BUSINESS', 'EXPENSE', 'Marketing'),
  ('BUSINESS', 'EXPENSE', 'Infraestrutura'),
  ('BUSINESS', 'EXPENSE', 'Ferramentas'),
  ('BUSINESS', 'EXPENSE', 'Administrativo'),
  ('BUSINESS', 'EXPENSE', 'Pró-labore'),
  ('BUSINESS', 'EXPENSE', 'Outros'),
  ('PERSONAL', 'INCOME', 'Pró-labore'),
  ('PERSONAL', 'INCOME', 'Salário'),
  ('PERSONAL', 'INCOME', 'Rendimentos'),
  ('PERSONAL', 'INCOME', 'Outros'),
  ('PERSONAL', 'EXPENSE', 'Moradia'),
  ('PERSONAL', 'EXPENSE', 'Alimentação'),
  ('PERSONAL', 'EXPENSE', 'Transporte'),
  ('PERSONAL', 'EXPENSE', 'Saúde'),
  ('PERSONAL', 'EXPENSE', 'Educação'),
  ('PERSONAL', 'EXPENSE', 'Lazer'),
  ('PERSONAL', 'EXPENSE', 'Assinaturas'),
  ('PERSONAL', 'EXPENSE', 'Outros')
) AS v(scope, type, name)
ON CONFLICT ("scope", "type", "name") DO NOTHING;

INSERT INTO "FinanceCategory" ("id", "scope", "type", "name")
SELECT 'fcat' || substr(md5(random()::text || clock_timestamp()::text || used."type"::text || used."category"), 1, 21), 'BUSINESS'::"FinanceScope", used."type", used."category"
FROM (
  SELECT DISTINCT "type", "category" FROM "FinancialEntry" WHERE btrim("category") <> ''
  UNION
  SELECT DISTINCT "type", "category" FROM "RecurringEntry" WHERE btrim("category") <> ''
) AS used
ON CONFLICT ("scope", "type", "name") DO NOTHING;
