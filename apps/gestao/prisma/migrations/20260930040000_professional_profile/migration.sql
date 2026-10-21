CREATE TABLE "ProfessionalProfile" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "name" TEXT NOT NULL DEFAULT 'Vinicius Riudi',
  "professionalTitle" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "document" TEXT,
  "address" TEXT,
  "city" TEXT,
  "state" TEXT,
  "website" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProfessionalProfile_pkey" PRIMARY KEY ("id")
);
