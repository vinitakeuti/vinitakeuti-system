-- Contato do visitante que inicia o atendimento com a IA no site
ALTER TABLE "AiConversation" ADD COLUMN "contactName" TEXT;
ALTER TABLE "AiConversation" ADD COLUMN "contactPhone" TEXT;
ALTER TABLE "AiConversation" ADD COLUMN "contactEmail" TEXT;
