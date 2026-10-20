-- AlterTable: agendamento, alertas, certificado HTTPS e domínio de cada sistema monitorado
ALTER TABLE "MonitoredApp" ADD COLUMN "nextCheckAt" TIMESTAMP(3);
ALTER TABLE "MonitoredApp" ADD COLUMN "lastAlertAt" TIMESTAMP(3);
ALTER TABLE "MonitoredApp" ADD COLUMN "sslExpiresAt" TIMESTAMP(3);
ALTER TABLE "MonitoredApp" ADD COLUMN "sslIssuer" TEXT;
ALTER TABLE "MonitoredApp" ADD COLUMN "sslCheckedAt" TIMESTAMP(3);
ALTER TABLE "MonitoredApp" ADD COLUMN "sslError" TEXT;
ALTER TABLE "MonitoredApp" ADD COLUMN "sslAlertedDays" INTEGER;
ALTER TABLE "MonitoredApp" ADD COLUMN "domainName" TEXT;
ALTER TABLE "MonitoredApp" ADD COLUMN "domainExpiresAt" TIMESTAMP(3);
ALTER TABLE "MonitoredApp" ADD COLUMN "domainCheckedAt" TIMESTAMP(3);
ALTER TABLE "MonitoredApp" ADD COLUMN "domainError" TEXT;
ALTER TABLE "MonitoredApp" ADD COLUMN "domainAlertedDays" INTEGER;

-- CreateTable: histórico de verificações
CREATE TABLE "MonitoringCheck" (
    "id" TEXT NOT NULL,
    "monitoredAppId" TEXT NOT NULL,
    "status" "MonitoringStatus" NOT NULL,
    "responseMs" INTEGER NOT NULL,
    "statusCode" INTEGER,
    "summary" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonitoringCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable: estado das tarefas agendadas
CREATE TABLE "SchedulerState" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchedulerState_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "MonitoredApp_nextCheckAt_idx" ON "MonitoredApp"("nextCheckAt");
CREATE INDEX "MonitoringCheck_monitoredAppId_checkedAt_idx" ON "MonitoringCheck"("monitoredAppId", "checkedAt");
CREATE INDEX "MonitoringCheck_checkedAt_idx" ON "MonitoringCheck"("checkedAt");

-- AddForeignKey
ALTER TABLE "MonitoringCheck" ADD CONSTRAINT "MonitoringCheck_monitoredAppId_fkey" FOREIGN KEY ("monitoredAppId") REFERENCES "MonitoredApp"("id") ON DELETE CASCADE ON UPDATE CASCADE;
