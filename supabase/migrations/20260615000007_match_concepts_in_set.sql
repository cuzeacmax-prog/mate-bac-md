-- ETAPA 19: potrivire semantică restrânsă la un SET dat de concepte (candidați pe temă, orice clasă).

CREATE OR REPLACE FUNCTION match_concepts_in_set(query_embedding text, match_count int, ids uuid[])
RETURNS TABLE(concept_id uuid, similarity real)
LANGUAGE sql STABLE AS $$
  SELECT id, (1 - (embedding <=> query_embedding::vector))::real AS similarity
  FROM concepts
  WHERE embedding IS NOT NULL AND id = ANY(ids)
  ORDER BY embedding <=> query_embedding::vector
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION match_concepts_in_set(text, int, uuid[]) TO service_role;
