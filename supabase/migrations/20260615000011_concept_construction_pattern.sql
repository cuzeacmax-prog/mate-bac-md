-- ETAPA 50: TIPARE DE CONSTRUCȚIE per concept-metodă (din graf). AI le draftează din teorie; omul le validează.
-- Construcția unui exercițiu = reuniunea tiparelor conceptelor lui (prin exercise_concept_link).

CREATE TABLE IF NOT EXISTS concept_construction_pattern (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  concept       text        UNIQUE,        -- slug-ul conceptului-metodă
  title         text,
  derived_from  text,                      -- teoria (body-ul conceptului) din care e draftat
  pattern       jsonb,                     -- { requires: [{el, role}] } (mașină-citibil)
  drafted_by    text        DEFAULT 'claude-code',
  human_status  text,                      -- 'validat' | 'respins' | NULL (nerevizuit)
  created_at    timestamptz DEFAULT now()
);

GRANT ALL ON TABLE concept_construction_pattern TO service_role;
GRANT ALL ON TABLE concept_construction_pattern TO authenticated;
ALTER TABLE concept_construction_pattern ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON concept_construction_pattern FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_read" ON concept_construction_pattern FOR SELECT TO authenticated USING (true);
