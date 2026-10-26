-- AlterTable: assinatura do profissional (SVG reduzido aos traços) usada nas folhas de assinatura dos PDFs
ALTER TABLE "ProfessionalProfile" ADD COLUMN "signatureSvg" TEXT;
