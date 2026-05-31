-- ETAPA 8b: tabelă DIAGNOSTIC (export) — formulele care dau eroare KaTeX reală.
-- Artefact read-only: NU modifică `concepts` sau `concept_content_proposals`; doar le scanează.

CREATE TABLE IF NOT EXISTS katex_error_report (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  concept_id   uuid        REFERENCES concepts(id) ON DELETE CASCADE,
  grade_level  int,
  concept_name text,
  source       text,        -- formule_latex | definitie | conditii | exemplu
  raw          text,        -- formula brută
  error        text,        -- mesajul KaTeX
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_katex_error_report_grade ON katex_error_report (grade_level, concept_name);

GRANT ALL ON TABLE katex_error_report TO service_role;
GRANT ALL ON TABLE katex_error_report TO authenticated;

ALTER TABLE katex_error_report ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON katex_error_report
  FOR ALL TO service_role USING (true) WITH CHECK (true);
