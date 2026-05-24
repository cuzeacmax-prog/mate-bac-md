# APPLY_MANUAL — Aplică migrările Supabase (5 minute)

> **De ce manual?** Supabase nu permite DDL (CREATE TABLE) prin API-ul standard.  
> Ai nevoie de acces la SQL Editor din browser — o singură dată, durează ~1 minut.

---

## PASUL 1 — Deschide SQL Editor

**Link direct:**  
👉 https://app.supabase.com/project/zrudijfezfjshpdymtst/sql/new

Sau: Supabase Studio → proiect `zrudijfezfjshpdymtst` → **SQL Editor** (bara laterală stânga)

---

## PASUL 2 — Aplică migrarea `solution_methods`

Copiază **tot** SQL-ul de mai jos și lipește-l în editorul SQL, apoi click **Run** (sau `Ctrl+Enter`):

```sql
-- ─────────────────────────────────────────────────────────────────────────────
-- ETAPA 6 — solution_methods: Metode de rezolvare BAC MD
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS solution_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  exercise_type       TEXT NOT NULL,
  exercise_type_label TEXT NOT NULL,
  method_name         TEXT NOT NULL,
  region              TEXT DEFAULT 'MD',
  grade_level         INT  NOT NULL CHECK (grade_level IN (10, 11, 12)),
  topic               TEXT NOT NULL,
  subtopic            TEXT,

  description TEXT,
  steps JSONB NOT NULL DEFAULT '[]',
  notation_rules JSONB DEFAULT '{}',
  required_elements JSONB DEFAULT '[]',
  forbidden_shortcuts TEXT[] DEFAULT '{}',
  examples JSONB DEFAULT '[]',
  common_mistakes JSONB DEFAULT '[]',
  required_tools TEXT[] DEFAULT '{}',

  difficulty       INT DEFAULT 3 CHECK (difficulty BETWEEN 1 AND 5),
  importance_score INT DEFAULT 5 CHECK (importance_score BETWEEN 1 AND 10),
  validated        BOOLEAN DEFAULT false,
  validated_by     TEXT,

  embedding vector(1536),

  usage_count  INT DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_solution_methods_grade
  ON solution_methods(grade_level);
CREATE INDEX IF NOT EXISTS idx_solution_methods_topic
  ON solution_methods(topic);
CREATE INDEX IF NOT EXISTS idx_solution_methods_type
  ON solution_methods(exercise_type);
CREATE INDEX IF NOT EXISTS idx_solution_methods_validated
  ON solution_methods(validated) WHERE validated = true;
CREATE INDEX IF NOT EXISTS idx_solution_methods_embedding
  ON solution_methods USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL;

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
    sm.id, sm.exercise_type, sm.exercise_type_label, sm.method_name,
    sm.description, sm.steps, sm.notation_rules, sm.examples, sm.common_mistakes,
    sm.grade_level, sm.topic, sm.importance_score,
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

ALTER TABLE solution_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "solution_methods_read_validated"
  ON solution_methods FOR SELECT
  USING (validated = true);

CREATE POLICY "solution_methods_service_full"
  ON solution_methods FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT ON solution_methods TO authenticated;
GRANT ALL    ON solution_methods TO service_role;
GRANT EXECUTE ON FUNCTION match_solution_methods TO authenticated, service_role;
```

✅ **Verificare**: ar trebui să apară mesajul `Success. No rows returned.`

---

## PASUL 3 — (Opțional) Aplică migrarea `tool_capabilities`

Același procedeu — SQL nou, click Run:

```sql
-- ─────────────────────────────────────────────────────────────────────────────
-- ETAPA 6 — tool_capabilities: Mapare exerciții → calculatoare
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tool_capabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  tool_id          TEXT NOT NULL UNIQUE,
  tool_label       TEXT NOT NULL,
  tool_category    TEXT NOT NULL,
  topic            TEXT NOT NULL,
  grade_levels     INT[] DEFAULT '{10,11,12}',

  exercise_types   TEXT[] DEFAULT '{}',
  keywords         TEXT[] DEFAULT '{}',

  description      TEXT,
  what_it_computes TEXT,
  input_schema     JSONB DEFAULT '[]',
  output_schema    JSONB DEFAULT '{}',

  api_endpoint     TEXT,
  api_method       TEXT DEFAULT 'POST',

  is_active        BOOLEAN DEFAULT true,
  importance_score INT DEFAULT 5 CHECK (importance_score BETWEEN 1 AND 10),
  embedding        vector(1536),

  usage_count INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tool_capabilities_category  ON tool_capabilities(tool_category);
CREATE INDEX IF NOT EXISTS idx_tool_capabilities_topic     ON tool_capabilities(topic);
CREATE INDEX IF NOT EXISTS idx_tool_capabilities_active    ON tool_capabilities(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_tool_capabilities_exercise_types ON tool_capabilities USING gin(exercise_types);
CREATE INDEX IF NOT EXISTS idx_tool_capabilities_keywords  ON tool_capabilities USING gin(keywords);
CREATE INDEX IF NOT EXISTS idx_tool_capabilities_embedding ON tool_capabilities USING hnsw (embedding vector_cosine_ops) WHERE embedding IS NOT NULL;

CREATE OR REPLACE FUNCTION update_tool_capabilities_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_tool_capabilities_updated_at ON tool_capabilities;
CREATE TRIGGER trg_tool_capabilities_updated_at
  BEFORE UPDATE ON tool_capabilities
  FOR EACH ROW EXECUTE FUNCTION update_tool_capabilities_updated_at();

CREATE OR REPLACE FUNCTION match_tool_capabilities(
  query_embedding  vector(1536),
  match_threshold  float DEFAULT 0.4,
  match_count      int   DEFAULT 5,
  filter_category  text  DEFAULT NULL,
  filter_grade     int   DEFAULT NULL
)
RETURNS TABLE (
  id uuid, tool_id text, tool_label text, tool_category text,
  description text, what_it_computes text, api_endpoint text,
  exercise_types text[], keywords text[], input_schema jsonb,
  output_schema jsonb, importance_score int, similarity float
)
LANGUAGE sql STABLE AS $$
  SELECT tc.id, tc.tool_id, tc.tool_label, tc.tool_category,
    tc.description, tc.what_it_computes, tc.api_endpoint,
    tc.exercise_types, tc.keywords, tc.input_schema, tc.output_schema,
    tc.importance_score,
    1 - (tc.embedding <=> query_embedding) AS similarity
  FROM tool_capabilities tc
  WHERE tc.is_active = true AND tc.embedding IS NOT NULL
    AND 1 - (tc.embedding <=> query_embedding) > match_threshold
    AND (filter_category IS NULL OR tc.tool_category = filter_category)
    AND (filter_grade IS NULL OR filter_grade = ANY(tc.grade_levels))
  ORDER BY tc.embedding <=> query_embedding LIMIT match_count;
$$;

CREATE OR REPLACE FUNCTION find_tools_by_keywords(search_keywords text[], filter_grade int DEFAULT NULL)
RETURNS TABLE (tool_id text, tool_label text, tool_category text, description text, api_endpoint text, matched_keywords text[])
LANGUAGE sql STABLE AS $$
  SELECT tc.tool_id, tc.tool_label, tc.tool_category, tc.description, tc.api_endpoint,
    ARRAY(SELECT unnest(tc.keywords) INTERSECT SELECT unnest(search_keywords)) AS matched_keywords
  FROM tool_capabilities tc
  WHERE tc.is_active = true AND tc.keywords && search_keywords
    AND (filter_grade IS NULL OR filter_grade = ANY(tc.grade_levels))
  ORDER BY array_length(ARRAY(SELECT unnest(tc.keywords) INTERSECT SELECT unnest(search_keywords)), 1) DESC NULLS LAST
  LIMIT 5;
$$;

ALTER TABLE tool_capabilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tool_capabilities_read_active"  ON tool_capabilities FOR SELECT USING (is_active = true);
CREATE POLICY "tool_capabilities_service_full" ON tool_capabilities FOR ALL TO service_role USING (true) WITH CHECK (true);
GRANT SELECT ON tool_capabilities TO authenticated;
GRANT ALL    ON tool_capabilities TO service_role;
GRANT EXECUTE ON FUNCTION match_tool_capabilities TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION find_tools_by_keywords  TO authenticated, service_role;
```

---

## PASUL 4 — Rulează importul (44 scenarii + embeddings)

După ce migrarea a trecut cu succes, în terminal:

```bash
npm run seed:scenarii
```

**Așteptat:**
- 44 scenarii inserate cu `✅ OK`
- Cost: ~$0 (Gemini Embedding free tier)
- Durată: ~1-2 minute

**Sau pentru verificare rapidă înainte:**
```bash
npm run check:migration
```

---

## PASUL 5 — Verificare finală

**Supabase Studio (Table Editor):**
```sql
SELECT exercise_type, method_name, grade_level, topic, validated
FROM solution_methods
ORDER BY grade_level, importance_score DESC;
```
→ Așteptat: 44 rânduri, `validated = true`, embedding populat

**Admin UI:**
- Mergi la `/admin/methodologies`
- Filtrează după clasă pentru a verifica acoperirea

**Test RAG în chat:**
- `"Cum rezolv ∫(1/x⁶)dx?"` → găsește `primitiva_simpla`
- `"Calculează lim(x→2) (x²-8x+12)/(x²-4)"` → găsește `l_hopital` sau `limite_forme_nedeterminate`
- `"Rezolvă x² - 3x - 4 > 0"` → găsește `inecuatii_gradul_2`

---

## Fișiere SQL complete (în repo)

- `supabase/migrations/20260603000000_solution_methods.sql`
- `supabase/migrations/20260603100000_tool_capabilities.sql`
