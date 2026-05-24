-- ─────────────────────────────────────────────────────────────────────────────
-- ETAPA 6 — solution_methods: Metode de rezolvare BAC MD
-- Tabelă pentru stocarea metodelor pedagogice MD-specifice
-- NU aplica automat — profesorul aplică manual din Supabase Studio
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS solution_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── Identificare ─────────────────────────────────────────────────────────
  exercise_type       TEXT NOT NULL,          -- "ecuatie_gradul_2"
  exercise_type_label TEXT NOT NULL,          -- "Ecuație de gradul II"
  method_name         TEXT NOT NULL,          -- "Metoda discriminantului cu verificare Viète"
  region              TEXT DEFAULT 'MD',
  grade_level         INT  NOT NULL CHECK (grade_level IN (10, 11, 12)),
  topic               TEXT NOT NULL,          -- "algebra", "analiza", "geometrie", etc.
  subtopic            TEXT,                   -- "ecuatii", "inecuatii", etc.

  -- ── Conținut pedagogic ───────────────────────────────────────────────────
  description TEXT,

  -- Etapele rezolvării numerotate
  -- [{step:1, title:"Calculează Δ", content:"Δ = b² - 4ac", formula:"\\Delta = b^2 - 4ac"}]
  steps JSONB NOT NULL DEFAULT '[]',

  -- Reguli notație BAC MD stricte
  -- {"delta":"Δ", "solution_set":"S = {…}", "final":"R: …"}
  notation_rules JSONB DEFAULT '{}',

  -- Elemente obligatorii în rezolvare
  required_elements JSONB DEFAULT '[]',

  -- Scurtături interzise
  forbidden_shortcuts TEXT[] DEFAULT '{}',

  -- ── Exemple complete ─────────────────────────────────────────────────────
  -- [{problem:"x²-5x+6=0", solution:[...steps...], answer:"S = {2, 3}"}]
  examples JSONB DEFAULT '[]',

  -- ── Greșeli comune ───────────────────────────────────────────────────────
  -- [{mistake:"uită Δ < 0 caz", correction:"Dacă Δ < 0, S = ∅"}]
  common_mistakes JSONB DEFAULT '[]',

  -- ── Tool-uri calculatoare necesare ───────────────────────────────────────
  required_tools TEXT[] DEFAULT '{}',

  -- ── Meta ─────────────────────────────────────────────────────────────────
  difficulty       INT DEFAULT 3 CHECK (difficulty BETWEEN 1 AND 5),
  importance_score INT DEFAULT 5 CHECK (importance_score BETWEEN 1 AND 10),
  validated        BOOLEAN DEFAULT false,
  validated_by     TEXT,

  -- ── Embedding semantic search ─────────────────────────────────────────────
  embedding vector(1536),

  -- ── Tracking ─────────────────────────────────────────────────────────────
  usage_count  INT DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indecși ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_solution_methods_grade
  ON solution_methods(grade_level);
CREATE INDEX IF NOT EXISTS idx_solution_methods_topic
  ON solution_methods(topic);
CREATE INDEX IF NOT EXISTS idx_solution_methods_type
  ON solution_methods(exercise_type);
CREATE INDEX IF NOT EXISTS idx_solution_methods_validated
  ON solution_methods(validated) WHERE validated = true;

-- Index HNSW pentru semantic search (necesită pgvector)
CREATE INDEX IF NOT EXISTS idx_solution_methods_embedding
  ON solution_methods USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL;

-- ── Trigger updated_at ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_solution_methods_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_solution_methods_updated_at ON solution_methods;
CREATE TRIGGER trg_solution_methods_updated_at
  BEFORE UPDATE ON solution_methods
  FOR EACH ROW EXECUTE FUNCTION update_solution_methods_updated_at();

-- ── RPC: semantic search ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION match_solution_methods(
  query_embedding  vector(1536),
  match_threshold  float DEFAULT 0.5,
  match_count      int   DEFAULT 3,
  filter_grade     int   DEFAULT NULL,
  filter_topic     text  DEFAULT NULL
)
RETURNS TABLE (
  id                  uuid,
  exercise_type       text,
  exercise_type_label text,
  method_name         text,
  description         text,
  steps               jsonb,
  notation_rules      jsonb,
  examples            jsonb,
  common_mistakes     jsonb,
  grade_level         int,
  topic               text,
  importance_score    int,
  similarity          float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    sm.id,
    sm.exercise_type,
    sm.exercise_type_label,
    sm.method_name,
    sm.description,
    sm.steps,
    sm.notation_rules,
    sm.examples,
    sm.common_mistakes,
    sm.grade_level,
    sm.topic,
    sm.importance_score,
    1 - (sm.embedding <=> query_embedding) AS similarity
  FROM solution_methods sm
  WHERE sm.validated = true
    AND sm.embedding IS NOT NULL
    AND 1 - (sm.embedding <=> query_embedding) > match_threshold
    AND (filter_grade IS NULL OR sm.grade_level = filter_grade)
    AND (filter_topic IS NULL OR sm.topic = filter_topic)
  ORDER BY sm.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ── RLS Policies ─────────────────────────────────────────────────────────────
ALTER TABLE solution_methods ENABLE ROW LEVEL SECURITY;

-- Toți utilizatorii autentificați pot citi metodele validate
CREATE POLICY "solution_methods_read_validated"
  ON solution_methods FOR SELECT
  USING (validated = true);

-- Service role are acces complet (pentru API admin)
CREATE POLICY "solution_methods_service_full"
  ON solution_methods FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ── Grants ───────────────────────────────────────────────────────────────────
GRANT SELECT ON solution_methods TO authenticated;
GRANT ALL    ON solution_methods TO service_role;
GRANT EXECUTE ON FUNCTION match_solution_methods TO authenticated, service_role;
