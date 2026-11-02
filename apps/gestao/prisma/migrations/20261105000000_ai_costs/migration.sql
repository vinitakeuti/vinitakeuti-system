-- Custo das respostas da IA e preço do modelo
ALTER TABLE "AiSettings" ADD COLUMN "inputPriceMicros" INTEGER;
ALTER TABLE "AiSettings" ADD COLUMN "outputPriceMicros" INTEGER;
ALTER TABLE "AiSettings" ADD COLUMN "usdBrlCents" INTEGER;
ALTER TABLE "AiRun" ADD COLUMN "costMicros" INTEGER;
