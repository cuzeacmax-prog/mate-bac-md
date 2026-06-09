-- ETAPA 60 PAS 6: legătura figura_autor → exercise_raw (match pe text normalizat).
-- (aplicată pe remote prin MCP apply_migration: etapa60_figura_exercise_link)
-- Explorare prealabilă: 19/30 figuri acceptate au match EXACT UNIC pe condition
-- normalizat; 0 ambigue; 11 fără match (rămân exercise_id NULL = MARCATE nelegate,
-- nu forțate).

ALTER TABLE public.figura_autor
  ADD COLUMN IF NOT EXISTS exercise_id uuid REFERENCES public.exercise_raw(id) ON DELETE SET NULL;

WITH f AS (
  SELECT id, regexp_replace(lower(condition), '[^a-zăâîșț0-9]+', '', 'g') AS norm
  FROM figura_autor WHERE status IN ('approved','auto-acceptat')
),
e AS (
  SELECT id, regexp_replace(lower(statement), '[^a-zăâîșț0-9]+', '', 'g') AS norm
  FROM exercise_raw
),
match_unic AS (
  SELECT f.id AS fid, min(e.id::text)::uuid AS eid
  FROM f JOIN e ON e.norm = f.norm
  GROUP BY f.id
  HAVING count(*) = 1
)
UPDATE figura_autor fa
SET exercise_id = mu.eid
FROM match_unic mu
WHERE fa.id = mu.fid;

CREATE INDEX IF NOT EXISTS idx_figura_autor_exercise ON public.figura_autor (exercise_id)
  WHERE exercise_id IS NOT NULL;
