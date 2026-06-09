-- ETAPA 57 (B5): gap_analysis e scris doar prin service_role (src/app/api/chat/route.ts:477).
-- Politica INSERT pentru authenticated cu WITH CHECK(true) era nefolosită și prea largă →
-- scoped la propriul user_id (inofensiv dacă apare vreodată un flux client-side).
-- (aplicată pe remote prin MCP apply_migration: etapa57_gap_analysis_scoped_insert)
DROP POLICY IF EXISTS "Service insert gap_analysis" ON public.gap_analysis;
CREATE POLICY "Users insert own gap_analysis" ON public.gap_analysis
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
