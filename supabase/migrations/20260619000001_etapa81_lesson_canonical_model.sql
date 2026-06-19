-- ETAPA 81 D2: modelul lecțiilor canonice → Opus 4.8 (Fable 5 indisponibil în mediul curent).
-- Adus în repo ca migrație ca să nu existe drift între DB și sursă.
UPDATE ai_model_config
SET model_name = 'claude-opus-4-8'
WHERE task_name = 'lesson_canonical';
