-- ETAPA 79 FAZA A: trei verdicte CAS pe geometrie (Modulele V-VI).
-- Coloana `verdict` (NULL pe rândurile vechi de integrale → comportament neschimbat).
ALTER TABLE exercise_verification
  ADD COLUMN IF NOT EXISTS verdict text
    CHECK (verdict IN ('verificat','neconcordant','nerezolvabil-cas'));

COMMENT ON COLUMN exercise_verification.verdict IS
  'ETAPA 79: verdict CAS geometrie (verificat/neconcordant/nerezolvabil-cas). NULL = rânduri vechi (integrale), conduse de coloana verified.';

-- NECONCORDANT iese din servire imediat (decizia 1 aprobată de Maxim).
CREATE OR REPLACE VIEW exercise_servable AS
WITH verified AS (
  SELECT DISTINCT exercise_id FROM exercise_verification WHERE verified = true
), strict AS (
  SELECT exercise_id FROM exercise_answer_link WHERE match_confidence = 'strict-bijectiv'
), neconcordant AS (
  SELECT DISTINCT exercise_id FROM exercise_verification WHERE verdict = 'neconcordant'
)
SELECT er.id AS exercise_id,
  CASE WHEN v.exercise_id IS NOT NULL THEN 'verificat'::text ELSE 'sursa-oficiala'::text END AS tier,
  CASE WHEN v.exercise_id IS NOT NULL THEN 'verificare CAS (exercise_verification)'::text
       ELSE 'răspuns oficial culegere (exercise_answer_link strict-bijectiv)'::text END AS provenance
FROM exercise_raw er
LEFT JOIN verified v ON v.exercise_id = er.id
LEFT JOIN strict s ON s.exercise_id = er.id
LEFT JOIN neconcordant nc ON nc.exercise_id = er.id
WHERE (v.exercise_id IS NOT NULL OR s.exercise_id IS NOT NULL)
  AND er.self_contained
  AND nc.exercise_id IS NULL;
