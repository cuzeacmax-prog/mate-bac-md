-- ETAPA 3.3a: coloane noi pe `concepts` pentru promovarea din staging concept_dedup_proposals
-- sub_points: sub-punctele nodului (array de etichete string), copiat din propunere
-- subtopic:   subtema din concept_inventory_raw (ex. "Funcții trigonometrice")
-- module:     modulul tematic din concept_inventory_raw (ex. "Algebră")

ALTER TABLE concepts
  ADD COLUMN IF NOT EXISTS sub_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS subtopic   text,
  ADD COLUMN IF NOT EXISTS module     text;
