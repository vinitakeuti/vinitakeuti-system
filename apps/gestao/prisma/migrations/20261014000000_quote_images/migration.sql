-- CreateTable
CREATE TABLE "QuoteImage" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuoteImage_quoteId_createdAt_idx" ON "QuoteImage"("quoteId", "createdAt");

-- AddForeignKey
ALTER TABLE "QuoteImage" ADD CONSTRAINT "QuoteImage_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
