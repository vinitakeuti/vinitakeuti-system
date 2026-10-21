-- CreateEnum
CREATE TYPE "ServiceBillingType" AS ENUM ('ONE_TIME', 'RECURRING');

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "serviceCatalogItemId" TEXT;

-- CreateTable
CREATE TABLE "ServiceCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceCatalogItem" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "billingType" "ServiceBillingType" NOT NULL,
    "defaultAmountCents" INTEGER NOT NULL DEFAULT 0,
    "estimatedHours" INTEGER,
    "billingCycle" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceCatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCategory_name_key" ON "ServiceCategory"("name");

-- CreateIndex
CREATE INDEX "ServiceCategory_isActive_sortOrder_name_idx" ON "ServiceCategory"("isActive", "sortOrder", "name");

-- CreateIndex
CREATE INDEX "ServiceCatalogItem_categoryId_isActive_createdAt_idx" ON "ServiceCatalogItem"("categoryId", "isActive", "createdAt");

-- CreateIndex
CREATE INDEX "ServiceCatalogItem_isActive_createdAt_idx" ON "ServiceCatalogItem"("isActive", "createdAt");

-- CreateIndex
CREATE INDEX "Subscription_serviceCatalogItemId_status_idx" ON "Subscription"("serviceCatalogItemId", "status");

-- AddForeignKey
ALTER TABLE "ServiceCatalogItem" ADD CONSTRAINT "ServiceCatalogItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ServiceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_serviceCatalogItemId_fkey" FOREIGN KEY ("serviceCatalogItemId") REFERENCES "ServiceCatalogItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
