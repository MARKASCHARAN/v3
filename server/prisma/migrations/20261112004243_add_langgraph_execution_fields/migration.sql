/*
  Warnings:

  - The required column `threadId` was added to the `ai_executions` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- AlterTable
ALTER TABLE "ai_executions" ADD COLUMN     "agentRole" TEXT NOT NULL DEFAULT 'MAIN_ORCHESTRATOR',
ADD COLUMN     "checkpointNamespace" TEXT,
ADD COLUMN     "langsmithTraceId" TEXT,
ADD COLUMN     "threadId" TEXT NOT NULL,
ADD COLUMN     "tokenBudget" INTEGER,
ADD COLUMN     "tokensUsed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "triggerType" TEXT NOT NULL DEFAULT 'REQUEST';

-- CreateIndex
CREATE INDEX "ai_executions_threadId_idx" ON "ai_executions"("threadId");
