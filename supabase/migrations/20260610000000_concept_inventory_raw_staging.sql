-- ETAPA 3.0: tabelă staging pentru inspecție duplicare înainte de dedup
-- NU este tabela `concepts` reală; doar staging temporar.

CREATE TABLE IF NOT EXISTS concept_inventory_raw (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  grade               int         NOT NULL,
  name                text        NOT NULL,
  first_seen_pdf_page int,
  module              text,
  subtopic            text,
  occurrences         int,
  created_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_concept_inventory_raw_grade_page
  ON concept_inventory_raw (grade, first_seen_pdf_page);

-- Grants
GRANT ALL ON TABLE concept_inventory_raw TO service_role;
GRANT ALL ON TABLE concept_inventory_raw TO authenticated;

ALTER TABLE concept_inventory_raw ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON concept_inventory_raw
  FOR ALL TO service_role USING (true) WITH CHECK (true);
