-- AlterTable
ALTER TABLE "memories" ADD COLUMN     "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "memoryType" TEXT NOT NULL DEFAULT 'SEMANTIC',
ADD COLUMN     "sourceId" TEXT,
ADD COLUMN     "sourceType" TEXT NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "supersededById" TEXT;

-- CreateIndex
CREATE INDEX "memories_userId_memoryType_idx" ON "memories"("userId", "memoryType");

-- CreateIndex
CREATE INDEX "memories_userId_expiresAt_idx" ON "memories"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "memories_supersededById_idx" ON "memories"("supersededById");

-- AddForeignKey
ALTER TABLE "memories" ADD CONSTRAINT "memories_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "memories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "memories" ALTER COLUMN "embedding" TYPE vector(768);

CREATE INDEX IF NOT EXISTS "memories_embedding_hnsw_idx" ON "memories" USING hnsw ("embedding" vector_cosine_ops);
CREATE INDEX IF NOT EXISTS "memories_fts_gin_idx" ON "memories" USING gin (to_tsvector('english', coalesce("title", '') || ' ' || "content"));
