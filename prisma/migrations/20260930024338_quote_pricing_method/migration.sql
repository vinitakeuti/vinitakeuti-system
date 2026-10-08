-- CreateEnum
CREATE TYPE "QuotePricingMethod" AS ENUM ('FIXED', 'HOURLY', 'DAILY');

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "pricingMethod" "QuotePricingMethod" NOT NULL DEFAULT 'FIXED',
ADD COLUMN     "pricingRateCents" INTEGER;
