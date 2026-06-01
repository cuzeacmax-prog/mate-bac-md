-- ETAPA 25: PROPUNERI de figură (FigureSpec2D) extrase din enunț de Claude. AI propune, omul confirmă.

CREATE TABLE IF NOT EXISTS exercise_figure_spec (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id       uuid        NOT NULL REFERENCES exercise_raw(id) ON DELETE CASCADE,
  spec              jsonb,        -- FigureSpec2D (NULL dacă 3d/fără figură)
  classifier_verdict text,        -- 'figurabil_2d' | '3d' | 'fara_figura'
  valid             boolean,      -- validateSpec a trecut
  validation_error  text,
  human_status      text,         -- 'confirmat' | 'respins' | NULL (nerevizuit)
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exercise_figure_spec_ex ON exercise_figure_spec (exercise_id);
CREATE INDEX IF NOT EXISTS idx_exercise_figure_spec_verdict ON exercise_figure_spec (classifier_verdict);

GRANT ALL ON TABLE exercise_figure_spec TO service_role;
GRANT ALL ON TABLE exercise_figure_spec TO authenticated;

ALTER TABLE exercise_figure_spec ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON exercise_figure_spec
  FOR ALL TO service_role USING (true) WITH CHECK (true);
