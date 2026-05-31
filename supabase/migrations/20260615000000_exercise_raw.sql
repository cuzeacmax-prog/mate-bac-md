-- ETAPA 11: staging pentru importul BRUT al exercițiilor din culegere (doar enunțuri + metadate).
-- Fără rezolvare, fără verificare, fără desene, fără plasare la noduri.

CREATE TABLE IF NOT EXISTS exercise_raw (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  source          text,        -- ex. 'culegere_12_2'
  pdf_page        int,
  exercise_number text,
  module          text,
  section         text,        -- §
  statement       text,
  subparts        jsonb       NOT NULL DEFAULT '[]'::jsonb,  -- [a, b, c, d]
  has_figure      boolean     DEFAULT false,
  given_answer    text,        -- din cheia de răspunsuri (acum null)
  confidence      text,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exercise_raw_source_page ON exercise_raw (source, pdf_page);

GRANT ALL ON TABLE exercise_raw TO service_role;
GRANT ALL ON TABLE exercise_raw TO authenticated;

ALTER TABLE exercise_raw ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON exercise_raw
  FOR ALL TO service_role USING (true) WITH CHECK (true);
