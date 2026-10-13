-- AlterTable
ALTER TABLE "MonitoredApp" ADD COLUMN "clientId" TEXT;

-- Sistemas já vinculados a um projeto herdam o cliente desse projeto.
UPDATE "MonitoredApp" AS m
SET "clientId" = p."clientId"
FROM "Project" AS p
WHERE m."projectId" = p."id" AND m."clientId" IS NULL;

-- CreateIndex
CREATE INDEX "MonitoredApp_clientId_createdAt_id_idx" ON "MonitoredApp"("clientId", "createdAt", "id");

-- AddForeignKey
ALTER TABLE "MonitoredApp" ADD CONSTRAINT "MonitoredApp_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
