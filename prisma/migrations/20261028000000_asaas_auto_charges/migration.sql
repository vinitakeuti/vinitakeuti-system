-- AlterTable: cobrança automática das parcelas no Asaas (dias antes do vencimento; nulo desliga)
ALTER TABLE "PaymentIntegration" ADD COLUMN "autoChargeDays" INTEGER DEFAULT 7;
