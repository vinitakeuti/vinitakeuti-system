-- Agenda, disponibilidade, resumo do atendimento e nome da assistente
ALTER TABLE "AiSettings" ADD COLUMN "assistantName" TEXT;
ALTER TABLE "AiConversation" ADD COLUMN "summary" TEXT;
ALTER TABLE "AiConversation" ADD COLUMN "summaryUpdatedAt" TIMESTAMP(3);

CREATE TYPE "CalendarEventStatus" AS ENUM ('SCHEDULED', 'CANCELLED', 'DONE');

CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'MEETING',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "status" "CalendarEventStatus" NOT NULL DEFAULT 'SCHEDULED',
    "clientId" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "conversationId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'gestao',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CalendarEvent_status_startsAt_idx" ON "CalendarEvent"("status", "startsAt");
CREATE INDEX "CalendarEvent_startsAt_id_idx" ON "CalendarEvent"("startsAt", "id");
CREATE INDEX "CalendarEvent_clientId_startsAt_idx" ON "CalendarEvent"("clientId", "startsAt");
CREATE INDEX "CalendarEvent_conversationId_idx" ON "CalendarEvent"("conversationId");
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AiConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "AgendaSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "workDays" INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5]::INTEGER[],
    "dayStart" INTEGER NOT NULL DEFAULT 540,
    "dayEnd" INTEGER NOT NULL DEFAULT 1080,
    "breakStart" INTEGER DEFAULT 720,
    "breakEnd" INTEGER DEFAULT 780,
    "meetingMinutes" INTEGER NOT NULL DEFAULT 30,
    "bufferMinutes" INTEGER NOT NULL DEFAULT 15,
    "minNoticeHours" INTEGER NOT NULL DEFAULT 12,
    "maxDaysAhead" INTEGER NOT NULL DEFAULT 21,
    "meetingFormat" TEXT,
    "aiBooking" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AgendaSettings_pkey" PRIMARY KEY ("id")
);
