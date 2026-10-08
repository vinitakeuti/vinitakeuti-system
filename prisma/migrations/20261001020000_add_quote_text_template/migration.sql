CREATE TABLE "QuoteTextTemplate" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "content" TEXT NOT NULL DEFAULT '',
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "QuoteTextTemplate_pkey" PRIMARY KEY ("id")
);
