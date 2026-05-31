-- ETAPA 18: etichetăm seturile de propuneri + RPC constrâns pe clasă (structura bate semantica brută).

ALTER TABLE exercise_concept_link ADD COLUMN IF NOT EXISTS method text;
UPDATE exercise_concept_link SET method = 'semantic_all' WHERE method IS NULL;  -- setul vechi (tot graful)
CREATE INDEX IF NOT EXISTS idx_exercise_concept_link_method ON exercise_concept_link (method);

-- Cele mai apropiate `match_count` concepte DINTR-O CLASĂ dată (subset constrâns).
CREATE OR REPLACE FUNCTION match_concepts_for_exercise_grade(query_embedding text, match_count int, grade int)
RETURNS TABLE(concept_id uuid, similarity real)
LANGUAGE sql STABLE AS $$
  SELECT id, (1 - (embedding <=> query_embedding::vector))::real AS similarity
  FROM concepts
  WHERE embedding IS NOT NULL AND grade_level = grade
  ORDER BY embedding <=> query_embedding::vector
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION match_concepts_for_exercise_grade(text, int, int) TO service_role;
