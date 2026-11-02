-- Stack dos sistemas monitorados e atualizações disponíveis
ALTER TABLE "MonitoredApp" ADD COLUMN "stack" JSONB;
ALTER TABLE "MonitoredApp" ADD COLUMN "stackUpdates" JSONB;
ALTER TABLE "MonitoredApp" ADD COLUMN "stackCheckedAt" TIMESTAMP(3);
CREATE INDEX "MonitoredApp_stackCheckedAt_idx" ON "MonitoredApp"("stackCheckedAt");

-- IA
CREATE TYPE "AiChannel" AS ENUM ('GESTAO', 'PORTAL', 'SITE', 'WHATSAPP', 'SISTEMA');
CREATE TYPE "AiRunStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED');

CREATE TABLE "AiSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "provider" TEXT NOT NULL DEFAULT 'openrouter',
    "baseUrl" TEXT,
    "model" TEXT,
    "apiKeyEncrypted" TEXT,
    "keyHint" TEXT,
    "channels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ownerPhones" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requireConfirmation" BOOLEAN NOT NULL DEFAULT true,
    "instructions" TEXT,
    "dailyRunLimit" INTEGER DEFAULT 300,
    "externalTokenHash" TEXT,
    "externalTokenHint" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AiSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiConversation" (
    "id" TEXT NOT NULL,
    "channel" "AiChannel" NOT NULL,
    "clientId" TEXT,
    "userId" TEXT,
    "externalKey" TEXT,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiConversation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AiConversation_channel_externalKey_key" ON "AiConversation"("channel", "externalKey");
CREATE INDEX "AiConversation_channel_lastMessageAt_id_idx" ON "AiConversation"("channel", "lastMessageAt", "id");
CREATE INDEX "AiConversation_clientId_lastMessageAt_idx" ON "AiConversation"("clientId", "lastMessageAt");
CREATE INDEX "AiConversation_userId_lastMessageAt_idx" ON "AiConversation"("userId", "lastMessageAt");
CREATE INDEX "AiConversation_lastMessageAt_idx" ON "AiConversation"("lastMessageAt");
ALTER TABLE "AiConversation" ADD CONSTRAINT "AiConversation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "AiMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "toolCalls" JSONB,
    "toolCallId" TEXT,
    "toolName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AiMessage_conversationId_createdAt_id_idx" ON "AiMessage"("conversationId", "createdAt", "id");
ALTER TABLE "AiMessage" ADD CONSTRAINT "AiMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AiConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AiRun" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "status" "AiRunStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "provider" TEXT,
    "model" TEXT,
    "steps" INTEGER NOT NULL DEFAULT 0,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    CONSTRAINT "AiRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AiRun_status_createdAt_idx" ON "AiRun"("status", "createdAt");
CREATE INDEX "AiRun_conversationId_createdAt_idx" ON "AiRun"("conversationId", "createdAt");
CREATE INDEX "AiRun_createdAt_id_idx" ON "AiRun"("createdAt", "id");
ALTER TABLE "AiRun" ADD CONSTRAINT "AiRun_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AiConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AiAction" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "runId" TEXT,
    "tool" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "result" JSONB,
    "status" TEXT NOT NULL,
    "mutates" BOOLEAN NOT NULL DEFAULT false,
    "actor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    CONSTRAINT "AiAction_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AiAction_conversationId_createdAt_idx" ON "AiAction"("conversationId", "createdAt");
CREATE INDEX "AiAction_status_createdAt_idx" ON "AiAction"("status", "createdAt");
CREATE INDEX "AiAction_createdAt_id_idx" ON "AiAction"("createdAt", "id");
ALTER TABLE "AiAction" ADD CONSTRAINT "AiAction_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AiConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
