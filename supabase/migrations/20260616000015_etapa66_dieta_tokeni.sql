-- ETAPA 66 FAZA D: dieta de tokeni.
-- (aplicată pe remote prin MCP apply_migration: etapa66_dieta_tokeni)
--
-- D1: istoricul conversației = ultimele 6 mesaje integrale + rezumat compact
--     persistat pe conversație, actualizat incremental cu Haiku DOAR când
--     fereastra alunecă (batch de 4 mesaje, nu la fiecare mesaj).
-- D3: max_tokens pe date reale (p95 output din api_usage_log):
--     verify_math p95=122  → 512→256;  decompose (JSON ≤5 exerciții) 1024→512;
--     chat_premium p95=970 → 8192→4096 (gard anti-runaway);
--     chat_free max=4050 ATINGE plafonul 4096 → rămâne (tăierea ar trunchia
--     lecții reale); chat_admin max=5245 → rămâne 8192.
--     NOTĂ DE DECIZIE: Anthropic taxează tokenii REALI, nu plafonul —
--     max_tokens e gard de cost la derapaj, nu pârghie de tarifare.

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS summary text,
  ADD COLUMN IF NOT EXISTS summary_through integer NOT NULL DEFAULT 0;

INSERT INTO public.ai_model_config
  (task_name, display_name, provider, model_name, max_tokens, temperature,
   price_input_per_1m, price_output_per_1m, description, is_active)
VALUES
  ('summarize_history', 'Rezumat incremental istoric chat', 'anthropic',
   'claude-haiku-4-5-20251001', 300, 0, 1.0, 5.0,
   'ETAPA 66 FAZA D: comprimă mesajele care ies din fereastra de 6; rulează doar la alunecarea ferestrei (batch 4).',
   true)
ON CONFLICT (task_name) DO NOTHING;

UPDATE public.ai_model_config SET max_tokens = 256  WHERE task_name = 'verify_math';
UPDATE public.ai_model_config SET max_tokens = 512  WHERE task_name = 'decompose';
UPDATE public.ai_model_config SET max_tokens = 4096 WHERE task_name = 'chat_premium';
