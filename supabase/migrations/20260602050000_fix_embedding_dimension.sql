-- Fix embedding column dimension: 3072 → 1536 (pgvector HNSW index limit).
-- Apply BEFORE inserting any data. Safe if solved_exercises is empty.

ALTER TABLE solved_exercises
  ALTER COLUMN embedding TYPE vector(1536)
  USING embedding::text::vector(1536);

-- Drop and recreate HNSW index with correct dimension.
DROP INDEX IF EXISTS solved_exercises_embedding_idx;
CREATE INDEX solved_exercises_embedding_idx
  ON solved_exercises
  USING hnsw (embedding vector_cosine_ops);

-- Recreate gap_analysis embedding column if exists.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gap_analysis' AND column_name = 'query_embedding'
  ) THEN
    ALTER TABLE gap_analysis
      ALTER COLUMN query_embedding TYPE vector(1536)
      USING query_embedding::text::vector(1536);
  END IF;
END $$;
