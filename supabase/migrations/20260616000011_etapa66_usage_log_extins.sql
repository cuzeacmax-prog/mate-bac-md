-- ETAPA 66 FAZA A: instrumentare cost + performanță.
-- (aplicată pe remote prin MCP apply_migration: etapa66_usage_log_extins)
-- api_usage_log primește latență și tokeni cache-uiți, completate la FIECARE
-- apel LLM/TTS/embedding din răspunsurile API (nu estimate).
-- model, task_name, tokens_input, tokens_output, cost_usd existau deja.

ALTER TABLE public.api_usage_log
  ADD COLUMN IF NOT EXISTS latency_ms_total integer,
  ADD COLUMN IF NOT EXISTS latency_ms_ttfb integer,
  ADD COLUMN IF NOT EXISTS cached_input_tokens integer;

-- agregările din /admin/metrics filtrează pe zi
CREATE INDEX IF NOT EXISTS idx_api_usage_log_created ON public.api_usage_log (created_at DESC);
