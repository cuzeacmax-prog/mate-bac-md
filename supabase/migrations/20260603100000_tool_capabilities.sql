-- ─────────────────────────────────────────────────────────────────────────────
-- ETAPA 6 — tool_capabilities: Mapare tipuri exerciții → calculatoare disponibile
-- Tabelă pentru RAG tool lookup — care calculator e relevant pt ce tip de problemă
-- NU aplica automat — profesorul aplică manual din Supabase Studio
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tool_capabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── Identificare ─────────────────────────────────────────────────────────
  tool_id          TEXT NOT NULL UNIQUE,   -- "ecuatie_gradul_2", "triunghi_dreptunghic"
  tool_label       TEXT NOT NULL,          -- "Ecuație gradul II"
  tool_category    TEXT NOT NULL,          -- "algebra" | "geometrie" | "analiza" | "trigonometrie"
  topic            TEXT NOT NULL,          -- subiect mai fin
  grade_levels     INT[] DEFAULT '{10,11,12}',

  -- ── Ce tipuri de exerciții rezolvă ───────────────────────────────────────
  -- ["ecuatie_gradul_2", "ecuatie_gradul_2_parametrica"]
  exercise_types   TEXT[] DEFAULT '{}',

  -- ── Cuvinte cheie din enunț care sugerează acest tool ────────────────────
  -- ["discriminant", "Δ", "rădăcini", "soluții ecuație"]
  keywords         TEXT[] DEFAULT '{}',

  -- ── Descriere pedagogică ─────────────────────────────────────────────────
  description      TEXT,
  what_it_computes TEXT,   -- ce calculează concret (volum, rădăcini, etc.)

  -- ── Input params pe care le acceptă ─────────────────────────────────────
  -- [{"name":"a","type":"number","required":true,"label":"Coef. a"},...]
  input_schema     JSONB DEFAULT '[]',

  -- ── Output pe care îl produce ─────────────────────────────────────────────
  -- {"primary":"x1, x2","secondary":["Delta","verificare Viete"]}
  output_schema    JSONB DEFAULT '{}',

  -- ── Link API intern ──────────────────────────────────────────────────────
  api_endpoint     TEXT,    -- "/api/tools/algebra/quadratic"
  api_method       TEXT DEFAULT 'POST',

  -- ── Meta ─────────────────────────────────────────────────────────────────
  is_active        BOOLEAN DEFAULT true,
  importance_score INT DEFAULT 5 CHECK (importance_score BETWEEN 1 AND 10),

  -- ── Embedding pentru semantic search ─────────────────────────────────────
  embedding        vector(1536),

  -- ── Tracking ─────────────────────────────────────────────────────────────
  usage_count INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Indecși ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tool_capabilities_category
  ON tool_capabilities(tool_category);
CREATE INDEX IF NOT EXISTS idx_tool_capabilities_topic
  ON tool_capabilities(topic);
CREATE INDEX IF NOT EXISTS idx_tool_capabilities_active
  ON tool_capabilities(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_tool_capabilities_exercise_types
  ON tool_capabilities USING gin(exercise_types);
CREATE INDEX IF NOT EXISTS idx_tool_capabilities_keywords
  ON tool_capabilities USING gin(keywords);

-- Index HNSW pentru semantic search
CREATE INDEX IF NOT EXISTS idx_tool_capabilities_embedding
  ON tool_capabilities USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL;

-- ── Trigger updated_at ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_tool_capabilities_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tool_capabilities_updated_at ON tool_capabilities;
CREATE TRIGGER trg_tool_capabilities_updated_at
  BEFORE UPDATE ON tool_capabilities
  FOR EACH ROW EXECUTE FUNCTION update_tool_capabilities_updated_at();

-- ── RPC: semantic search pentru tool lookup ───────────────────────────────────
CREATE OR REPLACE FUNCTION match_tool_capabilities(
  query_embedding  vector(1536),
  match_threshold  float DEFAULT 0.4,
  match_count      int   DEFAULT 5,
  filter_category  text  DEFAULT NULL,
  filter_grade     int   DEFAULT NULL
)
RETURNS TABLE (
  id               uuid,
  tool_id          text,
  tool_label       text,
  tool_category    text,
  description      text,
  what_it_computes text,
  api_endpoint     text,
  exercise_types   text[],
  keywords         text[],
  input_schema     jsonb,
  output_schema    jsonb,
  importance_score int,
  similarity       float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    tc.id,
    tc.tool_id,
    tc.tool_label,
    tc.tool_category,
    tc.description,
    tc.what_it_computes,
    tc.api_endpoint,
    tc.exercise_types,
    tc.keywords,
    tc.input_schema,
    tc.output_schema,
    tc.importance_score,
    1 - (tc.embedding <=> query_embedding) AS similarity
  FROM tool_capabilities tc
  WHERE tc.is_active = true
    AND tc.embedding IS NOT NULL
    AND 1 - (tc.embedding <=> query_embedding) > match_threshold
    AND (filter_category IS NULL OR tc.tool_category = filter_category)
    AND (filter_grade IS NULL OR filter_grade = ANY(tc.grade_levels))
  ORDER BY tc.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ── RPC: keyword-based lookup (fără embedding, fallback) ─────────────────────
CREATE OR REPLACE FUNCTION find_tools_by_keywords(
  search_keywords  text[],
  filter_grade     int DEFAULT NULL
)
RETURNS TABLE (
  tool_id          text,
  tool_label       text,
  tool_category    text,
  description      text,
  api_endpoint     text,
  matched_keywords text[]
)
LANGUAGE sql STABLE
AS $$
  SELECT
    tc.tool_id,
    tc.tool_label,
    tc.tool_category,
    tc.description,
    tc.api_endpoint,
    ARRAY(
      SELECT unnest(tc.keywords)
      INTERSECT
      SELECT unnest(search_keywords)
    ) AS matched_keywords
  FROM tool_capabilities tc
  WHERE tc.is_active = true
    AND tc.keywords && search_keywords
    AND (filter_grade IS NULL OR filter_grade = ANY(tc.grade_levels))
  ORDER BY array_length(
    ARRAY(
      SELECT unnest(tc.keywords) INTERSECT SELECT unnest(search_keywords)
    ), 1
  ) DESC NULLS LAST
  LIMIT 5;
$$;

-- ── RLS Policies ─────────────────────────────────────────────────────────────
ALTER TABLE tool_capabilities ENABLE ROW LEVEL SECURITY;

-- Toți utilizatorii autentificați pot citi tool-urile active
CREATE POLICY "tool_capabilities_read_active"
  ON tool_capabilities FOR SELECT
  USING (is_active = true);

-- Service role are acces complet
CREATE POLICY "tool_capabilities_service_full"
  ON tool_capabilities FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ── Grants ───────────────────────────────────────────────────────────────────
GRANT SELECT ON tool_capabilities TO authenticated;
GRANT ALL    ON tool_capabilities TO service_role;
GRANT EXECUTE ON FUNCTION match_tool_capabilities  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION find_tools_by_keywords   TO authenticated, service_role;
