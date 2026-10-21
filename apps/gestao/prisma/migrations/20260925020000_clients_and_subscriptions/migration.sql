ALTER TABLE "Client" ADD COLUMN "address" TEXT;

CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'PAUSED', 'CANCELLED');

CREATE TABLE "Subscription" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "billingCycle" TEXT NOT NULL DEFAULT 'MONTHLY',
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
  "nextPaymentAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Quote" ALTER COLUMN "clientId" SET NOT NULL;
ALTER TABLE "Quote" DROP CONSTRAINT "Quote_clientId_fkey";
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Quote_clientId_createdAt_idx" ON "Quote"("clientId", "createdAt");
CREATE INDEX "Subscription_clientId_status_idx" ON "Subscription"("clientId", "status");
CREATE INDEX "Subscription_status_nextPaymentAt_idx" ON "Subscription"("status", "nextPaymentAt");

ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
