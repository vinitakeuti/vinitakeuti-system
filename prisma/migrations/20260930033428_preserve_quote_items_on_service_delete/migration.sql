-- DropForeignKey
ALTER TABLE "QuoteServiceItem" DROP CONSTRAINT "QuoteServiceItem_serviceCatalogItemId_fkey";

-- AlterTable
ALTER TABLE "QuoteServiceItem" ALTER COLUMN "serviceCatalogItemId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "QuoteServiceItem" ADD CONSTRAINT "QuoteServiceItem_serviceCatalogItemId_fkey" FOREIGN KEY ("serviceCatalogItemId") REFERENCES "ServiceCatalogItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
