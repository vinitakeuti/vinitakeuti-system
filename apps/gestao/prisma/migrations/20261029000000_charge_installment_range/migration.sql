-- AlterTable: cobrança que cobre várias parcelas seguidas (paga de uma vez pelo portal)
ALTER TABLE "Charge" ADD COLUMN "installmentThrough" INTEGER;
