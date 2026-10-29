-- Vias assinadas passam por conferência manual na gestão, no lugar da checagem automática de assinatura digital.
CREATE TYPE "SignedDocumentReview" AS ENUM ('IN_REVIEW', 'APPROVED', 'REJECTED');

ALTER TABLE "SignedDocument"
    ADD COLUMN "reviewStatus" "SignedDocumentReview" NOT NULL DEFAULT 'IN_REVIEW',
    ADD COLUMN "reviewedAt" TIMESTAMP(3),
    ADD COLUMN "reviewedBy" TEXT,
    ADD COLUMN "rejectionReason" TEXT;

-- As vias aceitas pela checagem automática já contavam como assinadas; as demais ficam para conferir.
UPDATE "SignedDocument" SET "reviewStatus" = 'APPROVED', "reviewedAt" = "createdAt" WHERE "signatureDetected" = true;

ALTER TABLE "SignedDocument" DROP COLUMN "signatureDetected";
