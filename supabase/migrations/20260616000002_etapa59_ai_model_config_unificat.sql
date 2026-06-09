-- ETAPA 59 (P7): config modele unificat
-- (aplicată pe remote prin MCP apply_migration: etapa59_ai_model_config_unificat)

-- 1) Task-uri noi pentru apelurile care aveau modele hardcodate în src/lib
INSERT INTO ai_model_config (task_name, display_name, provider, model_name, max_tokens, temperature, price_input_per_1m, price_output_per_1m, description)
VALUES
  ('decompose',   'Descompunere multi-exercițiu', 'anthropic', 'claude-haiku-4-5-20251001', 1024, 0, 1.0, 5.0, 'Parser multi-exercițiu (regex fast-path → LLM doar la markeri). Folosit de lib/chat/query-decomposer.'),
  ('verify_math', 'Verificare matematică tăcută', 'anthropic', 'claude-haiku-4-5-20251001', 512, 0, 1.0, 5.0, 'Verificare post-stream a răspunsului (eveniment SSE separat). Folosit de lib/chat/math-verifier.')
ON CONFLICT (task_name) DO NOTHING;

-- 2) Task-uri fantomă (zero call-site-uri în src/ și scripts/ — verificat prin grep) → șterse
DELETE FROM ai_model_config
WHERE task_name IN ('classify_problem', 'background_tagging', 'generate_tikz_complex', 'validate_visual');

-- 3) 'embedding' rămâne ca documentare a modelului de embeddings folosit (gemini-embedding-001),
--    deși apelul e direct în lib/embeddings/gemini.ts, nu prin router.
UPDATE ai_model_config
SET description = 'REZERVAT/documentare: modelul de embeddings folosit de lib/embeddings/gemini.ts (apel direct, nu prin router).'
WHERE task_name = 'embedding';
