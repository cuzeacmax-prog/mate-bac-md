-- ════════════════════════════════════════════════════════════
-- ETAPA 1 — Graf de cunoștințe matematice
-- concepts, concept_edges, exercises, exercise_concepts
-- ════════════════════════════════════════════════════════════

-- ── 1. concepts ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS concepts (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text        UNIQUE NOT NULL,
  name            text        NOT NULL,
  grade_level     int         NOT NULL CHECK (grade_level BETWEEN 1 AND 12),
  order_in_grade  int         NOT NULL,
  kind            text        NOT NULL CHECK (kind IN ('concept','definitie','teorema','formula','procedeu')),
  body            text,
  notation        jsonb       DEFAULT '{}'::jsonb,
  status          text        NOT NULL DEFAULT 'gol' CHECK (status IN ('gol','extras','verificat')),
  embedding       vector(1536),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_concepts_grade_order ON concepts(grade_level, order_in_grade);

CREATE TRIGGER set_concepts_updated_at
  BEFORE UPDATE ON concepts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE concepts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read concepts" ON concepts FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Service role manages concepts" ON concepts FOR ALL USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON concepts TO service_role;
GRANT SELECT ON concepts TO authenticated;

-- ── 2. concept_edges ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS concept_edges (
  id            uuid  PRIMARY KEY DEFAULT gen_random_uuid(),
  from_concept  uuid  NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  to_concept    uuid  NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  relation      text  NOT NULL CHECK (relation IN ('prerechizit','foloseste','specializeaza')),
  UNIQUE (from_concept, to_concept, relation),
  CHECK (from_concept <> to_concept)
);

CREATE INDEX IF NOT EXISTS idx_concept_edges_from ON concept_edges(from_concept);
CREATE INDEX IF NOT EXISTS idx_concept_edges_to   ON concept_edges(to_concept);

ALTER TABLE concept_edges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read concept_edges" ON concept_edges FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Service role manages concept_edges" ON concept_edges FOR ALL USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON concept_edges TO service_role;
GRANT SELECT ON concept_edges TO authenticated;

-- ── 3. exercises ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS exercises (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  statement   text        NOT NULL,
  solution    text,
  answer      text,
  difficulty  int         CHECK (difficulty BETWEEN 1 AND 5),
  status      text        NOT NULL DEFAULT 'brut' CHECK (status IN ('brut','rezolvat','verificat','carantina')),
  source      text,
  grade_level int         CHECK (grade_level BETWEEN 1 AND 12),
  embedding   vector(1536),
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exercises_status_grade ON exercises(status, grade_level);

ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read exercises" ON exercises FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Service role manages exercises" ON exercises FOR ALL USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON exercises TO service_role;
GRANT SELECT ON exercises TO authenticated;

-- ── 4. exercise_concepts (many-to-many) ─────────────────────
CREATE TABLE IF NOT EXISTS exercise_concepts (
  exercise_id  uuid REFERENCES exercises(id) ON DELETE CASCADE,
  concept_id   uuid REFERENCES concepts(id)  ON DELETE CASCADE,
  PRIMARY KEY (exercise_id, concept_id)
);

ALTER TABLE exercise_concepts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read exercise_concepts" ON exercise_concepts FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Service role manages exercise_concepts" ON exercise_concepts FOR ALL USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON exercise_concepts TO service_role;
GRANT SELECT ON exercise_concepts TO authenticated;
