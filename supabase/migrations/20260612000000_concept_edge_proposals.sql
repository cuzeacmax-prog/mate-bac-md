-- ETAPA 4: tabelă STAGING pentru propunerile de muchii de prerechizit (AI propune, omul aprobă).
-- NU este `concept_edges` reală. Doar propuneri.
-- Semantică: from_concept REQUIRES to_concept (înveți to_concept ÎNAINTE de from_concept).

CREATE TABLE IF NOT EXISTS concept_edge_proposals (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  from_concept uuid        NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,  -- conceptul AVANSAT (ținta)
  to_concept   uuid        NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,  -- PRErechizitul
  relation     text        NOT NULL DEFAULT 'prerequisit',
  confidence   text,        -- high | medium | low
  note         text,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_concept_edge_proposals_from ON concept_edge_proposals (from_concept);
CREATE INDEX IF NOT EXISTS idx_concept_edge_proposals_to   ON concept_edge_proposals (to_concept);

GRANT ALL ON TABLE concept_edge_proposals TO service_role;
GRANT ALL ON TABLE concept_edge_proposals TO authenticated;

ALTER TABLE concept_edge_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON concept_edge_proposals
  FOR ALL TO service_role USING (true) WITH CHECK (true);
