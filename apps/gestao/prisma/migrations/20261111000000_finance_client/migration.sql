-- Financeiro: lançamentos e recorrências podem ser vinculados a um cliente cadastrado (a contraparte continua como
-- nome, para o histórico). Excluir o cliente mantém os lançamentos, só desfaz o vínculo.
ALTER TABLE "FinancialEntry" ADD COLUMN "clientId" TEXT;
ALTER TABLE "RecurringEntry" ADD COLUMN "clientId" TEXT;
ALTER TABLE "FinancialEntry" ADD CONSTRAINT "FinancialEntry_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RecurringEntry" ADD CONSTRAINT "RecurringEntry_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "FinancialEntry_clientId_dueDate_idx" ON "FinancialEntry"("clientId", "dueDate");
CREATE INDEX "RecurringEntry_clientId_idx" ON "RecurringEntry"("clientId");

-- Entradas de vendas: o cliente da proposta.
UPDATE "FinancialEntry" e SET "clientId" = q."clientId"
FROM "Quote" q
WHERE e."clientId" IS NULL AND e."sourceKey" = 'quote:' || q."id" AND q."clientId" IS NOT NULL;

-- Contraparte digitada igual ao nome de um único cliente (sem diferença de maiúsculas e espaços nas pontas).
UPDATE "FinancialEntry" e SET "clientId" = c."id"
FROM (SELECT lower(btrim("name")) AS key, min("id") AS id FROM "Client" GROUP BY 1 HAVING count(*) = 1) c
WHERE e."clientId" IS NULL AND e."counterparty" IS NOT NULL AND lower(btrim(e."counterparty")) = c.key;

UPDATE "RecurringEntry" r SET "clientId" = c."id"
FROM (SELECT lower(btrim("name")) AS key, min("id") AS id FROM "Client" GROUP BY 1 HAVING count(*) = 1) c
WHERE r."clientId" IS NULL AND r."counterparty" IS NOT NULL AND lower(btrim(r."counterparty")) = c.key;
