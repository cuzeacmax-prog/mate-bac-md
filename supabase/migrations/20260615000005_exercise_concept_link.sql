-- ETAPA 17: PROPUNERI de plasare exercițiu → noduri (concepte), prin similaritate de embedding.
-- NU e adevăr — sunt sugestii (similarity + rank) pentru revizie ulterioară.

CREATE TABLE IF NOT EXISTS exercise_concept_link (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id uuid        NOT NULL REFERENCES exercise_raw(id) ON DELETE CASCADE,
  concept_id  uuid        NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  similarity  real,        -- cosinus (embedding-uri L2-normalizate)
  rank        int,         -- 1 = cel mai apropiat
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exercise_concept_link_ex ON exercise_concept_link (exercise_id);
CREATE INDEX IF NOT EXISTS idx_exercise_concept_link_concept ON exercise_concept_link (concept_id);

GRANT ALL ON TABLE exercise_concept_link TO service_role;
GRANT ALL ON TABLE exercise_concept_link TO authenticated;

ALTER TABLE exercise_concept_link ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON exercise_concept_link
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Cele mai apropiate `match_count` concepte (cu embedding) pentru un vector dat.
-- Param ca text → cast la vector, ca să-l putem trimite simplu din supabase-js.
CREATE OR REPLACE FUNCTION match_concepts_for_exercise(query_embedding text, match_count int)
RETURNS TABLE(concept_id uuid, similarity real)
LANGUAGE sql STABLE AS $$
  SELECT id, (1 - (embedding <=> query_embedding::vector))::real AS similarity
  FROM concepts
  WHERE embedding IS NOT NULL
  ORDER BY embedding <=> query_embedding::vector
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION match_concepts_for_exercise(text, int) TO service_role;
