-- ETAPA 60 PAS 1: modelul de stare al elevului pe graful de concepte.
-- (aplicată pe remote prin MCP apply_migration: etapa60_concept_mastery)
-- topic_mastery (plat, 0 rânduri) se DEPRECIAZĂ: nu se mai scrie din aplicație;
-- rămâne în DB netradus (decizie umană ulterioară de ștergere).

CREATE TABLE IF NOT EXISTS public.concept_mastery (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  concept_id uuid NOT NULL REFERENCES public.concepts(id) ON DELETE CASCADE,
  mastery real NOT NULL DEFAULT 0 CHECK (mastery >= 0 AND mastery <= 1),
  evidence_count integer NOT NULL DEFAULT 0,
  last_evidence_at timestamptz,
  source text[] NOT NULL DEFAULT '{}',
  PRIMARY KEY (user_id, concept_id)
);

ALTER TABLE public.concept_mastery ENABLE ROW LEVEL SECURITY;

-- user-owned strict: doar propriile rânduri
CREATE POLICY "Users select own concept_mastery" ON public.concept_mastery
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own concept_mastery" ON public.concept_mastery
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own concept_mastery" ON public.concept_mastery
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
-- scrierile server trec prin service_role
CREATE POLICY "service_role_all" ON public.concept_mastery
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_concept_mastery_user ON public.concept_mastery (user_id);

COMMENT ON TABLE public.concept_mastery IS
  'ETAPA 60: măiestrie per concept (EMA α=0.3 din evidențe diagnostic/chat/exercise). Înlocuiește conceptual topic_mastery (deprecated, nescris din aplicație).';
COMMENT ON TABLE public.topic_mastery IS
  'DEPRECATED din ETAPA 60: nu se mai scrie din aplicație (înlocuit de concept_mastery). Păstrat pentru decizie umană ulterioară.';
