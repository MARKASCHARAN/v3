-- AlterTable
ALTER TABLE "accountability_logs" ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "severity" TEXT NOT NULL DEFAULT 'MEDIUM';

-- CreateTable
CREATE TABLE "research_items" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "goalId" TEXT,
    "query" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "keyFindings" JSONB NOT NULL,
    "sources" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "provider" TEXT,
    "model" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "research_items_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "research_items" ADD CONSTRAINT "research_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_items" ADD CONSTRAINT "research_items_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
