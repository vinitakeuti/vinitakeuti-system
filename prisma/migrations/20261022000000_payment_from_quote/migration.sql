-- AlterTable: pagamentos que vieram da proposta comercial
ALTER TABLE "FinancialPayment" ADD COLUMN "fromQuote" BOOLEAN NOT NULL DEFAULT false;

-- Os pagamentos copiados da proposta na confirmação da venda já tinham esta observação.
UPDATE "FinancialPayment" SET "fromQuote" = true WHERE "notes" = 'Registrado na proposta.';
