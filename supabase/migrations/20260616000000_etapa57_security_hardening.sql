-- ETAPA 57 (B5): întărire securitate — defecte demonstrate de advisors + pg_policies + role_table_grants
-- (aplicată pe remote prin MCP apply_migration: etapa57_security_hardening)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Politicile "Service role manages …" erau FOR ALL TO public USING(true):
--    ORICE rol (inclusiv anon) trecea de RLS pe aceste tabele. Re-scopate la service_role.
DROP POLICY IF EXISTS "Service role manages concepts" ON public.concepts;
CREATE POLICY "Service role manages concepts" ON public.concepts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role manages concept_edges" ON public.concept_edges;
CREATE POLICY "Service role manages concept_edges" ON public.concept_edges
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role manages exercises" ON public.diagnostic_exercises;
CREATE POLICY "Service role manages exercises" ON public.diagnostic_exercises
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role manages exercises" ON public.exercises;
CREATE POLICY "Service role manages exercises" ON public.exercises
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role manages exercise_concepts" ON public.exercise_concepts;
CREATE POLICY "Service role manages exercise_concepts" ON public.exercise_concepts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2) TRUNCATE nu e supus RLS; TRIGGER/REFERENCES n-au ce căuta la rolurile API.
--    Erau acordate pe TOATE cele 51 de tabele către anon + authenticated.
REVOKE TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLES FROM anon, authenticated;

-- 3) search_path fix pe toate funcțiile semnalate de advisor (search_path mutabil).
ALTER FUNCTION public.check_rate_limit(uuid, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.generate_referral_code() SET search_path = public, pg_temp;
ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;
ALTER FUNCTION public.increment_rate_limit(uuid, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.match_concepts_for_exercise(text, integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.match_concepts_for_exercise_grade(text, integer, integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.match_concepts_in_set(text, integer, uuid[]) SET search_path = public, pg_temp;
ALTER FUNCTION public.match_exercises(vector, double precision, integer) SET search_path = public, pg_temp;
ALTER FUNCTION public.match_solution_methods(vector, double precision, integer, integer, text) SET search_path = public, pg_temp;
ALTER FUNCTION public.rls_auto_enable() SET search_path = public, pg_temp;
ALTER FUNCTION public.set_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_chat_interactions_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_solution_methods_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_topic_mastery_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_user_profiles_updated_at() SET search_path = public, pg_temp;

-- 4) SECURITY DEFINER expuse prin RPC: scoatem EXECUTE de unde nu e nevoie.
--    handle_new_user/rls_auto_enable sunt funcții de trigger, nu API.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
--    rate-limit: apelate doar din rute server cu sesiune autentificată → anon nu are nevoie.
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.increment_rate_limit(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_rate_limit(uuid, text) TO authenticated, service_role;
