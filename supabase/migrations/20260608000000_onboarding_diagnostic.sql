-- ════════════════════════════════════════════════════════════
-- ETAPA 11 — Onboarding Diagnostic tables
-- ════════════════════════════════════════════════════════════

-- Diagnostic sessions — track diagnostic test per user
CREATE TABLE IF NOT EXISTS diagnostic_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  grade_level INTEGER NOT NULL CHECK (grade_level IN (10, 11, 12)),
  target_bac_score NUMERIC(3,1),
  started_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  total_questions INTEGER DEFAULT 0,
  correct_count INTEGER DEFAULT 0,
  final_difficulty NUMERIC(3,1),
  initial_bac_prediction NUMERIC(3,1),
  exercises_log JSONB DEFAULT '[]'::jsonb,
  topics_covered TEXT[] DEFAULT ARRAY[]::TEXT[],
  weaknesses TEXT[] DEFAULT ARRAY[]::TEXT[]
);

CREATE INDEX IF NOT EXISTS idx_diagnostic_user ON diagnostic_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_diagnostic_user_date ON diagnostic_sessions(user_id, started_at DESC);

GRANT SELECT, INSERT, UPDATE ON diagnostic_sessions TO service_role;
GRANT SELECT, INSERT, UPDATE ON diagnostic_sessions TO authenticated;

ALTER TABLE diagnostic_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own diagnostic" ON diagnostic_sessions
  FOR ALL USING (auth.uid() = user_id);

-- Pool exerciții diagnostic — generat din scenarii DB + Haiku distractors
CREATE TABLE IF NOT EXISTS diagnostic_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grade_level INTEGER NOT NULL CHECK (grade_level IN (10, 11, 12)),
  topic_id TEXT NOT NULL,
  difficulty INTEGER CHECK (difficulty BETWEEN 1 AND 5),
  prompt TEXT NOT NULL,
  correct_answer TEXT NOT NULL,
  distractors JSONB NOT NULL,        -- {"a": "...", "b": "...", "c": "...", "d": "..."}
  correct_letter CHAR(1) NOT NULL CHECK (correct_letter IN ('a', 'b', 'c', 'd')),
  explanation TEXT,
  source_scenario_id UUID,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_diag_ex_grade_diff ON diagnostic_exercises(grade_level, difficulty);
CREATE INDEX IF NOT EXISTS idx_diag_ex_topic ON diagnostic_exercises(grade_level, topic_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON diagnostic_exercises TO service_role;
-- authenticated users can read exercises (answers returned server-side only)
GRANT SELECT ON diagnostic_exercises TO authenticated;

ALTER TABLE diagnostic_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users read exercises" ON diagnostic_exercises
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Service role manages exercises" ON diagnostic_exercises
  FOR ALL USING (true);
