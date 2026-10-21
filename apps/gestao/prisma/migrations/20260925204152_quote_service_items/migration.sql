-- CreateTable
CREATE TABLE "QuoteServiceItem" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "serviceCatalogItemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryName" TEXT NOT NULL,
    "billingType" "ServiceBillingType" NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitAmountCents" INTEGER NOT NULL,
    "totalAmountCents" INTEGER NOT NULL,
    "estimatedHours" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteServiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuoteServiceItem_quoteId_createdAt_idx" ON "QuoteServiceItem"("quoteId", "createdAt");

-- CreateIndex
CREATE INDEX "QuoteServiceItem_serviceCatalogItemId_idx" ON "QuoteServiceItem"("serviceCatalogItemId");

-- AddForeignKey
ALTER TABLE "QuoteServiceItem" ADD CONSTRAINT "QuoteServiceItem_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteServiceItem" ADD CONSTRAINT "QuoteServiceItem_serviceCatalogItemId_fkey" FOREIGN KEY ("serviceCatalogItemId") REFERENCES "ServiceCatalogItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
