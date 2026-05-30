-- ETAPA 6: staging pentru extracția de CONȚINUT al nodurilor (probă, AI propune, omul aprobă).
-- NU este `concepts`.body — doar propuneri de conținut extras din manual.

CREATE TABLE IF NOT EXISTS concept_content_proposals (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  concept_id    uuid        NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  definitie     text,
  formule_latex jsonb       NOT NULL DEFAULT '[]'::jsonb,  -- listă de șiruri LaTeX
  conditii      text,
  exemplu       text,
  confidence    text,        -- high | medium | low
  source_pages  int[],       -- paginile PDF din care s-a extras
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_concept_content_proposals_concept ON concept_content_proposals (concept_id);

GRANT ALL ON TABLE concept_content_proposals TO service_role;
GRANT ALL ON TABLE concept_content_proposals TO authenticated;

ALTER TABLE concept_content_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON concept_content_proposals
  FOR ALL TO service_role USING (true) WITH CHECK (true);
