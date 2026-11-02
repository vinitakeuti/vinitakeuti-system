-- Modelo de cada tarefa da IA (gestão, atendimento, documentos, orçamentos) e preço por modelo
ALTER TABLE "AiSettings" ADD COLUMN "attendanceModel" TEXT;
ALTER TABLE "AiSettings" ADD COLUMN "documentModel" TEXT;
ALTER TABLE "AiSettings" ADD COLUMN "quoteModel" TEXT;
ALTER TABLE "AiSettings" ADD COLUMN "modelPrices" JSONB;
