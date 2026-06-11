-- ETAPA 75 C2+C3+E: rutarea pe dificultate + embeddings persistate.
-- (aplicate pe remote prin MCP apply_migration: etapa75_routing, etapa75_exercise_embeddings)

-- C2: task-urile de rutare
INSERT INTO public.ai_model_config
  (task_name, display_name, provider, model_name, max_tokens, temperature, price_input_per_1m, price_output_per_1m, description, is_active, fallback_task_name)
VALUES
  ('chat_simple', 'Chat simplu (Haiku, premium)', 'anthropic', 'claude-haiku-4-5-20251001', 4096, 0.7, 1.0, 5.0,
   'ETAPA 75 C: mesaje SIMPLE pe premium → Haiku (verify activ ca plasă); clasificator determinist src/lib/ai/difficulty.ts', true, 'chat_free'),
  ('chat_hard', 'Chat greu (Sonnet, toate tier-ele)', 'anthropic', 'claude-sonnet-4-6', 4096, 0.7, 3.0, 15.0,
   'ETAPA 75 C: mesaje GRELE → Sonnet pentru toți (free în limita bugetului — gardul 66 retrogradează)', true, 'chat_free')
ON CONFLICT (task_name) DO UPDATE SET is_active = true;

-- C3: logarea deciziei de rutare
ALTER TABLE public.api_usage_log ADD COLUMN IF NOT EXISTS routed_difficulty text;

-- B2: config-ul generării canonice
INSERT INTO public.ai_model_config
  (task_name, display_name, provider, model_name, max_tokens, temperature, price_input_per_1m, price_output_per_1m, description, is_active)
VALUES ('lesson_canonical', 'Lecții canonice (build-time)', 'anthropic', 'claude-fable-5', 32000, NULL, 10.0, 50.0,
   'ETAPA 75 B2: generarea o-singură-dată a lecțiilor canonice', true)
ON CONFLICT (task_name) DO NOTHING;

-- E: embeddings persistate pe exercise_raw + match pe servibile
ALTER TABLE public.exercise_raw ADD COLUMN IF NOT EXISTS embedding extensions.vector(1536);

CREATE OR REPLACE FUNCTION public.match_servable_exercises(
  query_embedding extensions.vector(1536), match_threshold float, match_count int
)
RETURNS TABLE (id uuid, statement text, similarity float)
LANGUAGE sql STABLE
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $$
  SELECT er.id, er.statement, 1 - (er.embedding <=> query_embedding) AS similarity
  FROM exercise_raw er
  JOIN exercise_servable es ON es.exercise_id = er.id
  WHERE er.embedding IS NOT NULL
    AND 1 - (er.embedding <=> query_embedding) > match_threshold
  ORDER BY er.embedding <=> query_embedding
  LIMIT match_count;
$$;

REVOKE EXECUTE ON FUNCTION public.match_servable_exercises(extensions.vector, float, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.match_servable_exercises(extensions.vector, float, int) TO service_role;
