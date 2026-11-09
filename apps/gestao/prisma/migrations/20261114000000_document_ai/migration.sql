-- Eliza no editor de PDF: pedidos para escrever ou aperfeiçoar o texto da proposta ou do documento.
-- CreateEnum
CREATE TYPE "DocumentAiMode" AS ENUM ('WRITE', 'IMPROVE');

-- CreateEnum
CREATE TYPE "DocumentAiJobStatus" AS ENUM ('PENDING', 'RUNNING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "DocumentAiJob" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT,
    "documentId" TEXT,
    "mode" "DocumentAiMode" NOT NULL,
    "status" "DocumentAiJobStatus" NOT NULL DEFAULT 'PENDING',
    "prompt" TEXT NOT NULL,
    "source" JSONB,
    "result" JSONB,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "model" TEXT,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "costMicros" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "DocumentAiJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentAiJob_status_createdAt_idx" ON "DocumentAiJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentAiJob_quoteId_createdAt_idx" ON "DocumentAiJob"("quoteId", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentAiJob_documentId_createdAt_idx" ON "DocumentAiJob"("documentId", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentAiJob_createdAt_idx" ON "DocumentAiJob"("createdAt");

-- AddForeignKey
ALTER TABLE "DocumentAiJob" ADD CONSTRAINT "DocumentAiJob_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAiJob" ADD CONSTRAINT "DocumentAiJob_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ClientDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

