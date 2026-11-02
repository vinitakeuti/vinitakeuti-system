-- Contexto da IA: instruções de atendimento e atendimento de outros números no WhatsApp
ALTER TABLE "AiSettings" ADD COLUMN "serviceInstructions" TEXT;
ALTER TABLE "AiSettings" ADD COLUMN "whatsappAttendance" BOOLEAN NOT NULL DEFAULT false;
