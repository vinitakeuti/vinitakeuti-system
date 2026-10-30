-- Documento livre: novo tipo, com capa opcional e sem cliente obrigatório.
ALTER TYPE "ClientDocumentKind" ADD VALUE 'FREE';

ALTER TABLE "ClientDocument" ALTER COLUMN "clientId" DROP NOT NULL;
