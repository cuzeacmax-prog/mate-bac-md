-- ETAPA 16: a treia poartă — verdictul UMAN (profesor) peste verificarea CAS.

ALTER TABLE exercise_verification
  ADD COLUMN IF NOT EXISTS human_status text,   -- 'confirmat' | 'respins' | NULL (nerevizuit)
  ADD COLUMN IF NOT EXISTS human_note   text;

CREATE INDEX IF NOT EXISTS idx_exercise_verification_human ON exercise_verification (human_status);
