-- ETAPA 74 B3: exercițiile NE-AUTONOME ies din servire.
-- (aplicată pe remote prin MCP apply_migration: etapa74_self_contained)
--
-- Clasa descoperită de owner: enunțuri care referă un context-mamă absent
-- („folosind notațiile de mai sus" etc.). Detectorul (src/lib/content/
-- self-contained.ts) le marchează self_contained=false; vederea
-- exercise_servable le EXCLUDE → daily/lecție/progres se filtrează automat
-- (toate citesc vederea); simularea filtrează în exam.ts (pool separat).
-- Exercițiile NU se rescriu (R5) — așteaptă decizia de îmbinare cu contextul.

ALTER TABLE public.exercise_raw
  ADD COLUMN IF NOT EXISTS self_contained boolean NOT NULL DEFAULT true;

CREATE OR REPLACE VIEW public.exercise_servable AS
WITH verified AS (
  SELECT DISTINCT exercise_id FROM public.exercise_verification WHERE verified = true
),
strict AS (
  SELECT exercise_id FROM public.exercise_answer_link WHERE match_confidence = 'strict-bijectiv'
)
SELECT er.id AS exercise_id,
  CASE WHEN v.exercise_id IS NOT NULL THEN 'verificat' ELSE 'sursa-oficiala' END AS tier,
  CASE WHEN v.exercise_id IS NOT NULL
       THEN 'verificare CAS (exercise_verification)'
       ELSE 'răspuns oficial culegere (exercise_answer_link strict-bijectiv)' END AS provenance
FROM public.exercise_raw er
LEFT JOIN verified v ON v.exercise_id = er.id
LEFT JOIN strict s ON s.exercise_id = er.id
WHERE (v.exercise_id IS NOT NULL OR s.exercise_id IS NOT NULL)
  AND er.self_contained;

GRANT SELECT ON public.exercise_servable TO service_role;
