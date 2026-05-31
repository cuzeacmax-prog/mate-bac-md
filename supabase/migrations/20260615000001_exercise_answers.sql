-- ETAPA 11b: staging pentru cheia de RĂSPUNSURI (SOLUȚII) din culegere. Captură fidelă, fără match.

CREATE TABLE IF NOT EXISTS exercise_answers (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  source          text,        -- 'culegere_12_2'
  pdf_page        int,
  test_or_section text,        -- gruparea (Modulul / § / Testul N)
  problem_number  text,
  answer_text     text,        -- răspunsul/soluția finală, fidel
  confidence      text,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exercise_answers_source_page ON exercise_answers (source, pdf_page);

GRANT ALL ON TABLE exercise_answers TO service_role;
GRANT ALL ON TABLE exercise_answers TO authenticated;

ALTER TABLE exercise_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON exercise_answers
  FOR ALL TO service_role USING (true) WITH CHECK (true);
