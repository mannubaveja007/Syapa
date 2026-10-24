-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Ensure GIN index for full-text search on content
CREATE INDEX IF NOT EXISTS document_chunk_content_tsv_idx 
ON "DocumentChunk" USING gin(to_tsvector('english', "content"));

-- Ensure GIN index on searchVector column
CREATE INDEX IF NOT EXISTS document_chunk_search_vector_idx 
ON "DocumentChunk" USING gin("searchVector");

-- Ensure HNSW vector index using cosine distance (vector_cosine_ops)
CREATE INDEX IF NOT EXISTS "DocumentChunk_embedding_hnsw_idx" 
ON "DocumentChunk" USING hnsw ("embedding" vector_cosine_ops);
