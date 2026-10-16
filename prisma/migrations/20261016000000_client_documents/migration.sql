-- CreateEnum
CREATE TYPE "ClientDocumentKind" AS ENUM ('CONTRACT', 'IP_ASSIGNMENT', 'TECHNICAL_MEMORIAL');

-- CreateTable
CREATE TABLE "ClientDocument" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "quoteId" TEXT,
    "kind" "ClientDocumentKind" NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "documentContent" JSONB,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientDocument_pkey" PRIMARY KEY ("id")
);

-- AlterTable: imagens passam a poder pertencer a um documento do cliente
ALTER TABLE "QuoteImage" ALTER COLUMN "quoteId" DROP NOT NULL;
ALTER TABLE "QuoteImage" ADD COLUMN "documentId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ClientDocument_code_key" ON "ClientDocument"("code");
CREATE INDEX "ClientDocument_clientId_kind_createdAt_idx" ON "ClientDocument"("clientId", "kind", "createdAt");
CREATE INDEX "ClientDocument_kind_updatedAt_id_idx" ON "ClientDocument"("kind", "updatedAt", "id");
CREATE INDEX "ClientDocument_updatedAt_id_idx" ON "ClientDocument"("updatedAt", "id");
CREATE INDEX "ClientDocument_quoteId_idx" ON "ClientDocument"("quoteId");
CREATE INDEX "QuoteImage_documentId_createdAt_idx" ON "QuoteImage"("documentId", "createdAt");

-- AddForeignKey
ALTER TABLE "ClientDocument" ADD CONSTRAINT "ClientDocument_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClientDocument" ADD CONSTRAINT "ClientDocument_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "QuoteImage" ADD CONSTRAINT "QuoteImage_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ClientDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
