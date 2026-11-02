-- Atendimentos: situação e anotações de cada conversa com clientes e visitantes
CREATE TYPE "AttendanceStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'CONVERTED', 'ARCHIVED');
ALTER TABLE "AiConversation" ADD COLUMN "attendanceStatus" "AttendanceStatus" NOT NULL DEFAULT 'NEW';
ALTER TABLE "AiConversation" ADD COLUMN "ownerNotes" TEXT;
CREATE INDEX "AiConversation_attendanceStatus_lastMessageAt_id_idx" ON "AiConversation"("attendanceStatus", "lastMessageAt", "id");
