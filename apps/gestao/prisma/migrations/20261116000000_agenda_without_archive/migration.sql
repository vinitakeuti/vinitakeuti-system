-- A agenda deixa de arquivar: eventos concluídos continuam no calendário e aparecem na aba Concluídos.
-- DropIndex
DROP INDEX "CalendarEvent_archivedAt_startsAt_idx";

-- AlterTable
ALTER TABLE "CalendarEvent" DROP COLUMN "archivedAt";

