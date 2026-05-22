-- ═══════════════════════════════════════════════════════════════
-- Templates parametrice TikZ
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS tikz_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,

  category TEXT NOT NULL,
  subcategory TEXT,

  latex_source TEXT NOT NULL,

  required_params JSONB NOT NULL DEFAULT '[]'::jsonb,
  optional_params JSONB NOT NULL DEFAULT '[]'::jsonb,

  calculator_function TEXT,

  preview_svg TEXT,
  default_params JSONB,

  pedagogical_notes JSONB NOT NULL DEFAULT '[]'::jsonb,
  search_keywords JSONB NOT NULL DEFAULT '[]'::jsonb,
  example_problems JSONB NOT NULL DEFAULT '[]'::jsonb,

  is_active BOOLEAN DEFAULT TRUE,
  version INTEGER DEFAULT 1,
  created_by UUID REFERENCES auth.users(id),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tikz_templates_category ON tikz_templates(category) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_tikz_templates_name ON tikz_templates(name);

ALTER TABLE tikz_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read tikz_templates"
  ON tikz_templates FOR SELECT
  TO authenticated USING (is_active = true);

CREATE POLICY "Admin write tikz_templates"
  ON tikz_templates FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.subscription_status = 'admin'
  ));

CREATE TRIGGER set_tikz_templates_updated_at
  BEFORE UPDATE ON tikz_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON tikz_templates TO service_role;
GRANT SELECT ON tikz_templates TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- Exerciții pre-rezolvate cu SVG static
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS solved_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  template_id UUID REFERENCES tikz_templates(id) ON DELETE SET NULL,

  statement TEXT NOT NULL,
  solution TEXT NOT NULL,

  tikz_source TEXT,
  svg_static TEXT,
  svg_thumbnail TEXT,

  topic TEXT NOT NULL,
  subtopic TEXT,
  difficulty INTEGER CHECK (difficulty BETWEEN 1 AND 5),
  grade_level INTEGER CHECK (grade_level BETWEEN 5 AND 12),
  source TEXT,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,

  embedding vector(3072),

  reviewed_by_admin BOOLEAN DEFAULT FALSE,
  needs_review BOOLEAN DEFAULT TRUE,
  view_count INTEGER DEFAULT 0,
  helpful_count INTEGER DEFAULT 0,
  not_helpful_count INTEGER DEFAULT 0,

  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_solved_exercises_topic ON solved_exercises(topic);
CREATE INDEX IF NOT EXISTS idx_solved_exercises_difficulty ON solved_exercises(difficulty);
CREATE INDEX IF NOT EXISTS idx_solved_exercises_grade ON solved_exercises(grade_level);
CREATE INDEX IF NOT EXISTS idx_solved_exercises_reviewed ON solved_exercises(reviewed_by_admin)
  WHERE reviewed_by_admin = false;
CREATE INDEX IF NOT EXISTS idx_solved_exercises_embedding ON solved_exercises
  USING hnsw (embedding vector_cosine_ops);

ALTER TABLE solved_exercises ENABLE ROW LEVEL SECURITY;

-- Users see only reviewed exercises
CREATE POLICY "Authenticated read solved_exercises"
  ON solved_exercises FOR SELECT
  TO authenticated USING (reviewed_by_admin = true);

-- Admin sees all
CREATE POLICY "Admin read all solved_exercises"
  ON solved_exercises FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.subscription_status = 'admin'
  ));

CREATE POLICY "Admin write solved_exercises"
  ON solved_exercises FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.subscription_status = 'admin'
  ));

CREATE POLICY "Admin update solved_exercises"
  ON solved_exercises FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.subscription_status = 'admin'
  ));

CREATE POLICY "Admin delete solved_exercises"
  ON solved_exercises FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.subscription_status = 'admin'
  ));

CREATE TRIGGER set_solved_exercises_updated_at
  BEFORE UPDATE ON solved_exercises
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON solved_exercises TO service_role;
GRANT SELECT ON solved_exercises TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- Gap analysis: întrebări fără match bun în bibliotecă
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS gap_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  query TEXT NOT NULL,
  query_embedding vector(3072),

  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  conversation_id UUID,

  max_similarity_found NUMERIC,
  top_match_id UUID REFERENCES solved_exercises(id) ON DELETE SET NULL,

  detected_topic TEXT,
  detected_subtopic TEXT,

  resolved BOOLEAN DEFAULT FALSE,
  resolved_with_exercise_id UUID REFERENCES solved_exercises(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gap_analysis_resolved ON gap_analysis(resolved) WHERE resolved = false;
CREATE INDEX IF NOT EXISTS idx_gap_analysis_created ON gap_analysis(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gap_analysis_topic ON gap_analysis(detected_topic) WHERE resolved = false;

ALTER TABLE gap_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin read gap_analysis"
  ON gap_analysis FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.subscription_status = 'admin'
  ));

CREATE POLICY "Service insert gap_analysis"
  ON gap_analysis FOR INSERT
  TO authenticated
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON gap_analysis TO service_role;
GRANT SELECT, INSERT ON gap_analysis TO authenticated;
