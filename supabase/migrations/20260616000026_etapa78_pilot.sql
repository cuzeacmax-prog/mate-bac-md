-- ETAPA 78 FAZA D: cohorta pilot + inbox-ul de feedback cu stare.
-- (aplicată pe remote prin MCP apply_migration: etapa78_pilot)
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS is_pilot BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.admin_feedback
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'nou'
    CHECK (status IN ('nou', 'vazut', 'rezolvat'));

CREATE INDEX IF NOT EXISTS idx_user_profiles_pilot ON public.user_profiles (is_pilot) WHERE is_pilot;
