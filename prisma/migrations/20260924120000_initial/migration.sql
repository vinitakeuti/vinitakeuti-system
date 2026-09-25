-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

CREATE TYPE "ProjectStatus" AS ENUM ('LEAD', 'PROPOSAL', 'PLANNING', 'IN_PROGRESS', 'WAITING_CLIENT', 'DELIVERED', 'PAUSED', 'CANCELLED');
CREATE TYPE "ChargeStatus" AS ENUM ('DRAFT', 'PENDING', 'PAID', 'OVERDUE', 'REFUNDED', 'CANCELLED');
CREATE TYPE "MonitoringStatus" AS ENUM ('OPERATIONAL', 'DEGRADED', 'DOWN', 'UNKNOWN');
CREATE TYPE "MonitoringEventType" AS ENUM ('UPTIME', 'DEPLOYMENT', 'SECURITY', 'LOG');
CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'SIGNED', 'EXPIRED');

CREATE TABLE "Client" (
  "id" TEXT NOT NULL, "name" TEXT NOT NULL, "email" TEXT, "document" TEXT, "phone" TEXT, "company" TEXT, "asaasCustomerId" TEXT, "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Project" (
  "id" TEXT NOT NULL, "clientId" TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT, "status" "ProjectStatus" NOT NULL DEFAULT 'LEAD', "budgetCents" INTEGER, "startedAt" TIMESTAMP(3), "deliveryAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Charge" (
  "id" TEXT NOT NULL, "clientId" TEXT NOT NULL, "projectId" TEXT, "description" TEXT NOT NULL, "amountCents" INTEGER NOT NULL, "dueDate" TIMESTAMP(3) NOT NULL, "paidAt" TIMESTAMP(3), "status" "ChargeStatus" NOT NULL DEFAULT 'DRAFT', "paymentMethod" TEXT, "asaasPaymentId" TEXT, "invoiceUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Charge_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Quote" (
  "id" TEXT NOT NULL, "clientId" TEXT, "projectId" TEXT, "code" TEXT NOT NULL, "title" TEXT NOT NULL, "scope" TEXT NOT NULL, "estimatedHours" INTEGER NOT NULL, "estimatedDays" INTEGER NOT NULL, "amountCents" INTEGER NOT NULL, "costCents" INTEGER, "validUntil" TIMESTAMP(3), "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT', "aiAnalysis" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Contract" (
  "id" TEXT NOT NULL, "clientId" TEXT NOT NULL, "projectId" TEXT, "code" TEXT NOT NULL, "title" TEXT NOT NULL, "terms" TEXT NOT NULL, "deliveryDate" TIMESTAMP(3), "amountCents" INTEGER, "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT', "signedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "MonitoredApp" (
  "id" TEXT NOT NULL, "projectId" TEXT, "name" TEXT NOT NULL, "url" TEXT, "healthEndpoint" TEXT, "logsEndpoint" TEXT, "environment" TEXT NOT NULL DEFAULT 'production', "status" "MonitoringStatus" NOT NULL DEFAULT 'UNKNOWN', "lastCheckedAt" TIMESTAMP(3), "lastResponseMs" INTEGER, "lastIncidentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MonitoredApp_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "MonitoringEvent" (
  "id" TEXT NOT NULL, "monitoredAppId" TEXT NOT NULL, "type" "MonitoringEventType" NOT NULL, "severity" TEXT NOT NULL DEFAULT 'info', "title" TEXT NOT NULL, "details" TEXT, "metadata" JSONB, "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "MonitoringEvent_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "PaymentIntegration" (
  "id" TEXT NOT NULL, "provider" TEXT NOT NULL, "isActive" BOOLEAN NOT NULL DEFAULT false, "environment" TEXT NOT NULL DEFAULT 'sandbox', "apiKeyEncrypted" TEXT, "webhookTokenHash" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentIntegration_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "GatewayEvent" (
  "id" TEXT NOT NULL, "provider" TEXT NOT NULL, "eventKey" TEXT NOT NULL, "eventName" TEXT NOT NULL, "providerPaymentId" TEXT, "amountCents" INTEGER, "occurredAt" TIMESTAMP(3), "processedAt" TIMESTAMP(3), "error" TEXT, "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GatewayEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Client_asaasCustomerId_key" ON "Client"("asaasCustomerId");
CREATE INDEX "Client_name_idx" ON "Client"("name");
CREATE INDEX "Client_email_idx" ON "Client"("email");
CREATE INDEX "Project_clientId_status_idx" ON "Project"("clientId", "status");
CREATE INDEX "Project_deliveryAt_idx" ON "Project"("deliveryAt");
CREATE UNIQUE INDEX "Charge_asaasPaymentId_key" ON "Charge"("asaasPaymentId");
CREATE INDEX "Charge_status_dueDate_idx" ON "Charge"("status", "dueDate");
CREATE INDEX "Charge_clientId_dueDate_idx" ON "Charge"("clientId", "dueDate");
CREATE UNIQUE INDEX "Quote_code_key" ON "Quote"("code");
CREATE INDEX "Quote_status_validUntil_idx" ON "Quote"("status", "validUntil");
CREATE UNIQUE INDEX "Contract_code_key" ON "Contract"("code");
CREATE INDEX "MonitoredApp_status_lastCheckedAt_idx" ON "MonitoredApp"("status", "lastCheckedAt");
CREATE INDEX "MonitoringEvent_monitoredAppId_occurredAt_idx" ON "MonitoringEvent"("monitoredAppId", "occurredAt");
CREATE INDEX "MonitoringEvent_type_severity_idx" ON "MonitoringEvent"("type", "severity");
CREATE UNIQUE INDEX "PaymentIntegration_provider_key" ON "PaymentIntegration"("provider");
CREATE UNIQUE INDEX "GatewayEvent_eventKey_key" ON "GatewayEvent"("eventKey");
CREATE INDEX "GatewayEvent_provider_receivedAt_idx" ON "GatewayEvent"("provider", "receivedAt");
CREATE INDEX "GatewayEvent_providerPaymentId_idx" ON "GatewayEvent"("providerPaymentId");

ALTER TABLE "Project" ADD CONSTRAINT "Project_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MonitoredApp" ADD CONSTRAINT "MonitoredApp_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MonitoringEvent" ADD CONSTRAINT "MonitoringEvent_monitoredAppId_fkey" FOREIGN KEY ("monitoredAppId") REFERENCES "MonitoredApp"("id") ON DELETE CASCADE ON UPDATE CASCADE;
