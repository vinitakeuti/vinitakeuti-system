-- CreateTable: vias assinadas enviadas pelo cliente no portal
CREATE TABLE "SignedDocument" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "quoteId" TEXT,
    "documentId" TEXT,
    "fileName" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "signatureDetected" BOOLEAN NOT NULL,
    "data" BYTEA NOT NULL,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignedDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SignedDocument_quoteId_createdAt_idx" ON "SignedDocument"("quoteId", "createdAt");
CREATE INDEX "SignedDocument_documentId_createdAt_idx" ON "SignedDocument"("documentId", "createdAt");
CREATE INDEX "SignedDocument_clientId_createdAt_idx" ON "SignedDocument"("clientId", "createdAt");

-- AddForeignKey
ALTER TABLE "SignedDocument" ADD CONSTRAINT "SignedDocument_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SignedDocument" ADD CONSTRAINT "SignedDocument_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SignedDocument" ADD CONSTRAINT "SignedDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ClientDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
