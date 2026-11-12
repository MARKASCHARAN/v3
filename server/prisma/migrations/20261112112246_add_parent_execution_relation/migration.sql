-- DropIndex
DROP INDEX "memories_embedding_hnsw_idx";

-- AlterTable
ALTER TABLE "ai_executions" ADD COLUMN     "parentExecutionId" TEXT;

-- CreateIndex
CREATE INDEX "ai_executions_parentExecutionId_idx" ON "ai_executions"("parentExecutionId");

-- AddForeignKey
ALTER TABLE "ai_executions" ADD CONSTRAINT "ai_executions_parentExecutionId_fkey" FOREIGN KEY ("parentExecutionId") REFERENCES "ai_executions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
