-- ETAPA 64: nivelul „sursă-oficială" — conținutul se deblochează.
-- (aplicată pe remote prin MCP apply_migration: etapa64_servable_tier)
--
-- DECIZIE APROBATĂ: două niveluri de încredere servibile:
--   'verificat'      = verificare CAS pass (exercise_verification.verified)
--   'sursa-oficiala' = enunț + răspuns oficial extras din culegere, prin link
--                      neambiguu ('strict-bijectiv', auditat în ETAPA 63)
-- Tot EXTRAGERE, zero generare de conținut matematic.
--
-- Cifre la aplicare: verificate=345 (Modulele I–II); servibile=423;
-- concepte cu conținut 17 → 51; figuri care se aprind: 1/19 (restul legate
-- de exerciții ne-servibile — gol de date marcat, nu forțat).

-- ── 1) Vederea servibilității (tier + proveniență) ─────────────────────────
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
WHERE v.exercise_id IS NOT NULL OR s.exercise_id IS NOT NULL;

GRANT SELECT ON public.exercise_servable TO service_role;

-- ── 2) frontier_concepts: + servable_exercises (verified rămâne separat) ───
DROP FUNCTION IF EXISTS public.frontier_concepts(uuid, integer, integer);
CREATE FUNCTION public.frontier_concepts(p_user_id uuid, p_grade integer, p_limit integer DEFAULT 5)
 RETURNS TABLE(concept_id uuid, slug text, name text, grade_level integer, mastery real,
               verified_exercises bigint, servable_exercises bigint,
               prereq_total bigint, prereq_ok bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $$
WITH m AS (
  SELECT cm.concept_id, cm.mastery, cm.evidence_count
  FROM concept_mastery cm WHERE cm.user_id = p_user_id
),
prereq_status AS (
  SELECT e.from_concept AS cid,
    count(*) AS total,
    count(*) FILTER (
      WHERE coalesce(pm.mastery, 0) >= 0.6
         OR (pm.concept_id IS NULL AND pc.grade_level <= p_grade - 3)
    ) AS ok
  FROM concept_edges e
  JOIN concepts pc ON pc.id = e.to_concept
  LEFT JOIN m pm ON pm.concept_id = e.to_concept
  GROUP BY e.from_concept
),
verified AS (
  SELECT ecl.concept_id AS cid, count(DISTINCT ev.exercise_id) AS n
  FROM exercise_concept_link ecl
  JOIN exercise_verification ev ON ev.exercise_id = ecl.exercise_id AND ev.verified = true
  GROUP BY ecl.concept_id
),
servable AS (
  SELECT ecl.concept_id AS cid, count(DISTINCT es.exercise_id) AS n
  FROM exercise_concept_link ecl
  JOIN exercise_servable es ON es.exercise_id = ecl.exercise_id
  GROUP BY ecl.concept_id
)
SELECT c.id, c.slug, c.name, c.grade_level,
  coalesce(cm.mastery, 0)::real AS mastery,
  coalesce(v.n, 0) AS verified_exercises,
  coalesce(sv.n, 0) AS servable_exercises,
  coalesce(ps.total, 0) AS prereq_total,
  coalesce(ps.ok, 0) AS prereq_ok
FROM concepts c
LEFT JOIN m cm ON cm.concept_id = c.id
LEFT JOIN prereq_status ps ON ps.cid = c.id
LEFT JOIN verified v ON v.cid = c.id
LEFT JOIN servable sv ON sv.cid = c.id
WHERE c.grade_level <= p_grade
  AND (cm.concept_id IS NULL OR cm.mastery < 0.6)
  AND NOT (cm.concept_id IS NULL AND c.grade_level <= p_grade - 3)
  AND coalesce(ps.total, 0) = coalesce(ps.ok, 0)
ORDER BY (coalesce(sv.n, 0) > 0) DESC, c.grade_level ASC, coalesce(sv.n, 0) DESC, c.name ASC
LIMIT p_limit;
$$;

-- Funcția primește p_user_id arbitrar → NU e pentru apel direct din client.
REVOKE EXECUTE ON FUNCTION public.frontier_concepts(uuid, int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.frontier_concepts(uuid, int, int) TO service_role;
