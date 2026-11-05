-- Gestor de projetos: projeto pessoal (sem cliente), percentual por peso, funcionalidades, subatividades,
-- diário, atualizações ao cliente e rascunhos da Eliza.
-- CreateEnum
CREATE TYPE "ProjectTaskStatus" AS ENUM ('TODO', 'DOING', 'WAITING_CLIENT', 'BLOCKED', 'DONE');

-- CreateEnum
CREATE TYPE "ProjectUpdateStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "ProjectAiJobKind" AS ENUM ('PLAN', 'DAY', 'UPDATE');

-- CreateEnum
CREATE TYPE "ProjectAiJobStatus" AS ENUM ('PENDING', 'RUNNING', 'READY', 'FAILED', 'APPLIED', 'DISCARDED');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "doneWeight" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalWeight" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "clientId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ProjectFeature" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectFeature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectTask" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "featureId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "status" "ProjectTaskStatus" NOT NULL DEFAULT 'TODO',
    "weight" INTEGER NOT NULL DEFAULT 3,
    "position" INTEGER NOT NULL DEFAULT 0,
    "doneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectLog" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "summary" TEXT NOT NULL,
    "minutes" INTEGER,
    "tasks" JSONB,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectUpdate" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "ProjectUpdateStatus" NOT NULL DEFAULT 'DRAFT',
    "progressPercent" INTEGER,
    "publishedAt" TIMESTAMP(3),
    "emailedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectAiJob" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "kind" "ProjectAiJobKind" NOT NULL,
    "status" "ProjectAiJobStatus" NOT NULL DEFAULT 'PENDING',
    "input" TEXT NOT NULL,
    "day" DATE,
    "minutes" INTEGER,
    "result" JSONB,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "model" TEXT,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "costMicros" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ProjectAiJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectFeature_projectId_position_idx" ON "ProjectFeature"("projectId", "position");

-- CreateIndex
CREATE INDEX "ProjectTask_featureId_position_idx" ON "ProjectTask"("featureId", "position");

-- CreateIndex
CREATE INDEX "ProjectTask_projectId_status_idx" ON "ProjectTask"("projectId", "status");

-- CreateIndex
CREATE INDEX "ProjectTask_projectId_doneAt_idx" ON "ProjectTask"("projectId", "doneAt");

-- CreateIndex
CREATE INDEX "ProjectLog_projectId_day_id_idx" ON "ProjectLog"("projectId", "day", "id");

-- CreateIndex
CREATE INDEX "ProjectUpdate_projectId_status_publishedAt_idx" ON "ProjectUpdate"("projectId", "status", "publishedAt");

-- CreateIndex
CREATE INDEX "ProjectAiJob_status_createdAt_idx" ON "ProjectAiJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectAiJob_projectId_kind_createdAt_idx" ON "ProjectAiJob"("projectId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "ProjectAiJob_createdAt_idx" ON "ProjectAiJob"("createdAt");

-- CreateIndex
CREATE INDEX "Project_status_updatedAt_id_idx" ON "Project"("status", "updatedAt", "id");

-- CreateIndex
CREATE INDEX "Project_updatedAt_id_idx" ON "Project"("updatedAt", "id");

-- AddForeignKey
ALTER TABLE "ProjectFeature" ADD CONSTRAINT "ProjectFeature_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_featureId_fkey" FOREIGN KEY ("featureId") REFERENCES "ProjectFeature"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectLog" ADD CONSTRAINT "ProjectLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectUpdate" ADD CONSTRAINT "ProjectUpdate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAiJob" ADD CONSTRAINT "ProjectAiJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

