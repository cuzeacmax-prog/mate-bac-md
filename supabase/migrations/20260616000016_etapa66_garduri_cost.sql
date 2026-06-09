-- ETAPA 66 FAZA F: garduri de cost.
-- (aplicată pe remote prin MCP apply_migration: etapa66_garduri_cost)
--
-- DRIFT MARCAT ONEST: fișierul 20260601000001_system_config.sql exista în repo,
-- dar tabelul NU exista pe DB-ul live (verificat: to_regclass = null) — definiția
-- se re-aplică aici idempotent, identică cu originalul + grants pentru service_role.

CREATE TABLE IF NOT EXISTS public.system_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Admins read system_config" ON public.system_config FOR SELECT
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.subscription_status = 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Admins write system_config" ON public.system_config FOR ALL
    USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.subscription_status = 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_config TO service_role;
GRANT SELECT ON public.system_config TO authenticated;

-- Bugete lunare per tier (USD echivalent tokeni) + kill-switch + prag alertă/zi.
INSERT INTO public.system_config (key, value, description) VALUES
  ('cost_budget_usd', '{"free": 1.0, "premium": 10.0, "family": 15.0}',
   'ETAPA 66 F1: plafon lunar de cost LLM per user, pe tier. Depășire → downgrade temporar la Haiku cu mesaj politicos. Adminii sunt exceptați.'),
  ('llm_kill_switch', 'false',
   'ETAPA 66 F1: true = oprește TOATE apelurile LLM de chat (incident de cost). Mesaj politicos, nu tăcere.'),
  ('cost_alert_daily_usd', '5.0',
   'ETAPA 66 F3: dacă costul total al zilei depășește pragul, se scrie un marcaj vizibil în admin_feedback (o dată pe zi).')
ON CONFLICT (key) DO NOTHING;

-- Costul lunii curente pentru un user (folosit de gardul de buget, per mesaj).
CREATE OR REPLACE FUNCTION public.month_cost(p_user_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT coalesce(sum(cost_usd), 0)
  FROM api_usage_log
  WHERE user_id = p_user_id
    AND created_at >= date_trunc('month', now());
$$;
REVOKE EXECUTE ON FUNCTION public.month_cost(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.month_cost(uuid) TO service_role;

-- index pentru gard + top-useri în /admin/metrics
CREATE INDEX IF NOT EXISTS idx_api_usage_log_user_created
  ON public.api_usage_log (user_id, created_at DESC);
