-- ETAPA 60 PAS 3: frontiera pe DAG.
-- (aplicate pe remote prin MCP: etapa60_frontier_concepts + etapa60_concept_mastery_grants)
-- SEMANTICA MUCHIILOR (verificată pe date, nu pe presupunere): concept_edges
-- from_concept = conceptul DEPENDENT, to_concept = PREREChIZITUL lui
-- (ex.: g10-modulul-numarului-real → g8-modulul-unui-numar-real).
-- Deci prerechizitele lui c = muchiile cu from_concept = c.
--
-- PRESUPUNERE DOCUMENTATĂ: conceptele din clase ≤ p_grade-3 fără nicio evidență
-- se consideră știute (atât ca prerechizite, cât și ca candidați — aplicată
-- consecvent, altfel frontiera ar fi inundată de concepte de clase mici).
--
-- Ordonare (per mandat): întâi conceptele cu exerciții VERIFICATE
-- (exercise_concept_link × exercise_verification.verified=true), apoi clasă crescătoare.

CREATE OR REPLACE FUNCTION public.frontier_concepts(p_user_id uuid, p_grade int, p_limit int DEFAULT 5)
RETURNS TABLE (
  concept_id uuid, slug text, name text, grade_level int,
  mastery real, verified_exercises bigint, prereq_total bigint, prereq_ok bigint
)
LANGUAGE sql STABLE
SET search_path = public, pg_temp
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
)
SELECT c.id, c.slug, c.name, c.grade_level,
  coalesce(cm.mastery, 0)::real AS mastery,
  coalesce(v.n, 0) AS verified_exercises,
  coalesce(ps.total, 0) AS prereq_total,
  coalesce(ps.ok, 0) AS prereq_ok
FROM concepts c
LEFT JOIN m cm ON cm.concept_id = c.id
LEFT JOIN prereq_status ps ON ps.cid = c.id
LEFT JOIN verified v ON v.cid = c.id
WHERE c.grade_level <= p_grade
  AND (cm.concept_id IS NULL OR cm.mastery < 0.6)
  AND NOT (cm.concept_id IS NULL AND c.grade_level <= p_grade - 3)
  AND coalesce(ps.total, 0) = coalesce(ps.ok, 0)
ORDER BY (coalesce(v.n, 0) > 0) DESC, c.grade_level ASC, coalesce(v.n, 0) DESC, c.name ASC
LIMIT p_limit;
$$;

-- Funcția primește p_user_id arbitrar → NU e pentru apel direct din client.
REVOKE EXECUTE ON FUNCTION public.frontier_concepts(uuid, int, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.frontier_concepts(uuid, int, int) TO service_role;

-- GRANT-uri explicite pe concept_mastery: default privileges din proiect s-au
-- dovedit sparte pentru tabele noi (service_role moștenea doar
-- TRUNCATE/REFERENCES/TRIGGER, fără DML; authenticated nimic).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.concept_mastery TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.concept_mastery TO authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.concept_mastery FROM service_role;
