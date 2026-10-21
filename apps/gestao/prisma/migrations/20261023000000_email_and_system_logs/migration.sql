-- AlterTable: resumo da última verificação de cada sistema monitorado
ALTER TABLE "MonitoredApp" ADD COLUMN "lastCheckSummary" TEXT;

-- CreateTable: envios de e-mail
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "messageId" TEXT,
    "response" TEXT,
    "error" TEXT,
    "durationMs" INTEGER,
    "actorEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable: eventos da aplicação
CREATE TABLE "SystemLog" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "actorEmail" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailLog_createdAt_id_idx" ON "EmailLog"("createdAt", "id");
CREATE INDEX "EmailLog_status_createdAt_idx" ON "EmailLog"("status", "createdAt");
CREATE INDEX "SystemLog_createdAt_id_idx" ON "SystemLog"("createdAt", "id");
CREATE INDEX "SystemLog_source_level_createdAt_idx" ON "SystemLog"("source", "level", "createdAt");
CREATE INDEX "SystemLog_event_createdAt_idx" ON "SystemLog"("event", "createdAt");
