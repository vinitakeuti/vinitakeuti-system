-- Agenda: arquivo de eventos concluídos (por mês) e registro de remarcação.
ALTER TABLE "CalendarEvent" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "CalendarEvent" ADD COLUMN "rescheduledFrom" TIMESTAMP(3);
ALTER TABLE "CalendarEvent" ADD COLUMN "rescheduledCount" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "CalendarEvent_archivedAt_startsAt_idx" ON "CalendarEvent"("archivedAt", "startsAt");
