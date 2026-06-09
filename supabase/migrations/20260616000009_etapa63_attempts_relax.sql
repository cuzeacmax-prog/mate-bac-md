-- ETAPA 63: exercise_attempts primește încercările din chat-ul ancorat.
-- (aplicată pe remote prin MCP apply_migration: etapa63_attempts_relax)
-- Tabelul era croit pe diagnostic (topic_id obligatoriu, is_correct boolean strict).
-- Încercările din chat: nu au topic (au concept prin exercițiu), iar verdictul
-- judecătorului sub pragul de încredere este onest NULL (nu mișcă mastery).

ALTER TABLE public.exercise_attempts ALTER COLUMN topic_id DROP NOT NULL;
ALTER TABLE public.exercise_attempts ALTER COLUMN is_correct DROP NOT NULL;

-- session_type nou: 'chat_ancorat' (încercări evaluate în chat-ul ancorat în concept)
ALTER TABLE public.exercise_attempts DROP CONSTRAINT IF EXISTS exercise_attempts_session_type_check;
ALTER TABLE public.exercise_attempts ADD CONSTRAINT exercise_attempts_session_type_check
  CHECK (session_type = ANY (ARRAY['daily_challenge'::text, 'free_question'::text,
    'mock_bac'::text, 'diagnostic'::text, 'practice'::text, 'chat_ancorat'::text]));
