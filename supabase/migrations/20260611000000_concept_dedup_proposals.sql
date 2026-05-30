-- ETAPA 3.1: tabelă STAGING pentru propunerile de dedup (AI propune, omul aprobă).
-- NU este tabela `concepts` reală. Doar propuneri — nimic definitiv până la aprobare umană.

CREATE TABLE IF NOT EXISTS concept_dedup_proposals (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  grade          int         NOT NULL,
  canonical_name text        NOT NULL,
  kind           text,        -- notiune | definitie | teorema | formula | procedeu
  raw_names      jsonb       NOT NULL DEFAULT '[]'::jsonb,  -- variantele brute incluse
  variant_count  int         NOT NULL DEFAULT 0,
  min_pdf_page   int,         -- prima apariție (pentru ordonare)
  confidence     text,        -- high | medium | low
  note           text,
  created_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_concept_dedup_proposals_grade_page
  ON concept_dedup_proposals (grade, min_pdf_page);

-- Grants (la fel ca staging-ul concept_inventory_raw)
GRANT ALL ON TABLE concept_dedup_proposals TO service_role;
GRANT ALL ON TABLE concept_dedup_proposals TO authenticated;

ALTER TABLE concept_dedup_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON concept_dedup_proposals
  FOR ALL TO service_role USING (true) WITH CHECK (true);
