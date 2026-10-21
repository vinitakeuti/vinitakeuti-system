-- CreateEnum
CREATE TYPE "ServicePricingMethod" AS ENUM ('FIXED', 'HOURLY', 'DAILY', 'CUSTOM');

-- AlterTable
ALTER TABLE "QuoteServiceItem" ADD COLUMN     "billingCycle" TEXT,
ADD COLUMN     "pricingMethod" "ServicePricingMethod" NOT NULL DEFAULT 'FIXED',
ADD COLUMN     "pricingRateCents" INTEGER;

-- AlterTable
ALTER TABLE "ServiceCatalogItem" ADD COLUMN     "pricingMethod" "ServicePricingMethod" NOT NULL DEFAULT 'FIXED';
