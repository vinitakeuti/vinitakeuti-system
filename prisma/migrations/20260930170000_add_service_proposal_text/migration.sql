-- Preserve the proposal copy selected from the service catalog at the time of the quote.
ALTER TABLE "ServiceCatalogItem" ADD COLUMN "proposalText" TEXT;
ALTER TABLE "QuoteServiceItem" ADD COLUMN "proposalText" TEXT;
