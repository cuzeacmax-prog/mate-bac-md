-- ETAPA 79 FAZA C: diagnostic v2 din sursă oficială + plasă (decizia 3).
ALTER TABLE diagnostic_exercises
  ADD COLUMN IF NOT EXISTS item_kind text NOT NULL DEFAULT 'mcq'
    CHECK (item_kind IN ('mcq','free')),
  ADD COLUMN IF NOT EXISTS source_tag text
    CHECK (source_tag IN ('oficial-v2','plasa-temporara')),
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS source_exercise_id uuid REFERENCES exercise_raw(id);

COMMENT ON COLUMN diagnostic_exercises.item_kind IS
  'ETAPA 79: mcq (cu distractori, vechi/generat) sau free (răspuns liber verificat determinist cu compareAnswers, v2 oficial).';
COMMENT ON COLUMN diagnostic_exercises.source_tag IS
  'ETAPA 79: oficial-v2 (din exerciții servibile cu răspuns oficial) sau plasa-temporara (generat, păstrat doar pe topice fără itemi oficiali).';
COMMENT ON COLUMN diagnostic_exercises.active IS
  'ETAPA 79: false = dezactivat (itemi generați pe topice acoperite de v2). diagnostic/next servește doar active=true.';

-- itemii free (v2) nu au literă de variantă; permitem placeholder 'x'.
ALTER TABLE diagnostic_exercises DROP CONSTRAINT IF EXISTS diagnostic_exercises_correct_letter_check;
ALTER TABLE diagnostic_exercises ADD CONSTRAINT diagnostic_exercises_correct_letter_check
  CHECK (correct_letter IN ('a','b','c','d','x'));
