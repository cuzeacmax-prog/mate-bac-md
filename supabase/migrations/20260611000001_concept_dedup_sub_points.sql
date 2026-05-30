-- ETAPA 3.2: granularitate MEDIE — sub-proprietățile/sub-formulele trăiesc ca SUB-PUNCTE
-- în nodul-părinte, nu ca noduri separate. Adăugăm coloana sub_points.
-- sub_points: jsonb array de { "label": text, "raw_names": text[] }.

ALTER TABLE concept_dedup_proposals
  ADD COLUMN IF NOT EXISTS sub_points jsonb NOT NULL DEFAULT '[]'::jsonb;
