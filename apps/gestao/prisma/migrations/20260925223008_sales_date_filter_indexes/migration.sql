-- DropIndex
DROP INDEX "Quote_status_createdAt_idx";

-- CreateIndex
CREATE INDEX "Quote_status_createdAt_id_idx" ON "Quote"("status", "createdAt", "id");

-- CreateIndex
CREATE INDEX "Sale_createdAt_id_idx" ON "Sale"("createdAt", "id");
