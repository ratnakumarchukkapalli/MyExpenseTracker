-- Migration: RAG Phase 6 — vector search infra on expenses
-- Run in Supabase SQL editor
--
-- Adds a pgvector embedding column + HNSW index over expenses.description
-- (and tag, when set) for semantic retrieval. Aggregation/numeric questions
-- ("how much did I spend on X in Q1") still go through plain SQL, not this —
-- this column only serves the semantic-search half of the RAG router.
--
-- Embedding dimension is 768 to match nomic-embed-text (LM Studio, local).
-- No RLS policy needed: this is a column on the existing `expenses` table,
-- which already enforces auth.uid() = user_id row-level security.

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS embedding vector(768);

-- Tracks whether `embedding` reflects the current description/tag, so the
-- write-time embedding step (Phase 6 issue .2) knows what still needs a
-- backfill pass without re-embedding unchanged rows.
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS embedded_at TIMESTAMPTZ;

-- HNSW over cosine distance — pgvector's ANN index, avoids a full table scan
-- per query. ivfflat would need a pre-sized row count; HNSW doesn't.
CREATE INDEX IF NOT EXISTS expenses_embedding_hnsw_idx
  ON expenses USING hnsw (embedding vector_cosine_ops);
