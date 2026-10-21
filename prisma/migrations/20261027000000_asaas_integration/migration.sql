-- AlterTable: integração Asaas configurada em Integrações (conta, webhook e sincronização)
ALTER TABLE "PaymentIntegration" ADD COLUMN "keyHint" TEXT;
ALTER TABLE "PaymentIntegration" ADD COLUMN "webhookId" TEXT;
ALTER TABLE "PaymentIntegration" ADD COLUMN "webhookUrl" TEXT;
ALTER TABLE "PaymentIntegration" ADD COLUMN "webhookStatus" TEXT;
ALTER TABLE "PaymentIntegration" ADD COLUMN "webhookPenalized" INTEGER;
ALTER TABLE "PaymentIntegration" ADD COLUMN "accountName" TEXT;
ALTER TABLE "PaymentIntegration" ADD COLUMN "accountEmail" TEXT;
ALTER TABLE "PaymentIntegration" ADD COLUMN "accountDocument" TEXT;
ALTER TABLE "PaymentIntegration" ADD COLUMN "accountStatus" TEXT;
ALTER TABLE "PaymentIntegration" ADD COLUMN "lastCheckedAt" TIMESTAMP(3);
ALTER TABLE "PaymentIntegration" ADD COLUMN "lastError" TEXT;
ALTER TABLE "PaymentIntegration" ADD COLUMN "lastSyncAt" TIMESTAMP(3);

-- AlterTable: eventos do webhook processados fora da resposta, com novas tentativas
ALTER TABLE "GatewayEvent" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "GatewayEvent" ADD COLUMN "payload" JSONB;

-- CreateIndex
CREATE INDEX "GatewayEvent_processedAt_receivedAt_idx" ON "GatewayEvent"("processedAt", "receivedAt");
