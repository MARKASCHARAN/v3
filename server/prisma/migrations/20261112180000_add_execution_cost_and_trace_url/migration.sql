-- AlterTable
ALTER TABLE "ai_executions" ADD COLUMN     "costMicroUsd" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "langsmithTraceUrl" TEXT;

