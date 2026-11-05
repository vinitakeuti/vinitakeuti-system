-- AlterTable
ALTER TABLE "Quote" ADD COLUMN "lostAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Quote_lostAt_createdAt_idx" ON "Quote"("lostAt", "createdAt");
