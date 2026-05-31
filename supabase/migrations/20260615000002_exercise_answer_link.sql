-- ETAPA 12: legătura exercițiu↔răspuns (separată, NU mutăm nimic în exercise_raw).

CREATE TABLE IF NOT EXISTS exercise_answer_link (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id      uuid        NOT NULL REFERENCES exercise_raw(id) ON DELETE CASCADE,
  subpart          text,        -- a/b/c dacă răspunsul e pentru un subpunct; NULL = exercițiul întreg
  answer_id        uuid        NOT NULL REFERENCES exercise_answers(id) ON DELETE CASCADE,
  match_confidence text,        -- exact | fuzzy
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exercise_answer_link_ex ON exercise_answer_link (exercise_id);
CREATE INDEX IF NOT EXISTS idx_exercise_answer_link_ans ON exercise_answer_link (answer_id);

GRANT ALL ON TABLE exercise_answer_link TO service_role;
GRANT ALL ON TABLE exercise_answer_link TO authenticated;

ALTER TABLE exercise_answer_link ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON exercise_answer_link
  FOR ALL TO service_role USING (true) WITH CHECK (true);
