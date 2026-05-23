-- match_exercises RPC: cosine similarity search for RAG
-- Apply manually via Supabase SQL Editor AFTER running batch generator.
-- NOTE: embedding column is vector(1536) after 20260602050000 migration.

CREATE OR REPLACE FUNCTION match_exercises(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.5,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  statement text,
  solution text,
  topic text,
  subtopic text,
  difficulty int,
  grade_level int,
  svg_static text,
  tags jsonb,
  similarity float
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    se.id,
    se.statement,
    se.solution,
    se.topic,
    se.subtopic,
    se.difficulty,
    se.grade_level,
    se.svg_static,
    se.tags,
    1 - (se.embedding <=> query_embedding) AS similarity
  FROM solved_exercises se
  WHERE se.reviewed_by_admin = true
    AND 1 - (se.embedding <=> query_embedding) > match_threshold
  ORDER BY se.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION match_exercises TO authenticated;
GRANT EXECUTE ON FUNCTION match_exercises TO service_role;
