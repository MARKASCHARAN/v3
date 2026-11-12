CREATE INDEX IF NOT EXISTS "memories_embedding_hnsw_idx" ON "memories" USING hnsw ("embedding" vector_cosine_ops);
