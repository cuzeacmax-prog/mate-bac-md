-- ============================================================
-- Mate BAC MD — Schema inițială
-- Migrație: 20260519000001
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- ── Utility: auto-update updated_at ──────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- TABLES
-- ═══════════════════════════════════════════════════════════════

-- ── Cursuri disponibile (multi-curs de la start) ─────────────
CREATE TABLE public.courses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text UNIQUE NOT NULL,
  name            text NOT NULL,
  grade           text,
  subject         text,
  profile_type    text,
  description     text,
  active          boolean DEFAULT true,
  price_monthly   int,
  created_at      timestamptz DEFAULT now()
);

-- ── Module per curs ──────────────────────────────────────────
CREATE TABLE public.course_modules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  name        text NOT NULL,
  order_index int  NOT NULL,
  description text
);

-- ── Profiluri utilizatori (extend auth.users) ────────────────
CREATE TABLE public.profiles (
  id                        uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                     text,
  full_name                 text,
  phone                     text,
  grade                     text,
  profile_type              text,
  subscription_status       text NOT NULL DEFAULT 'free'
                              CHECK (subscription_status IN ('free','premium','family_2','family_3','cancelled')),
  maib_customer_id          text,
  messages_used_this_month  int  DEFAULT 0,
  messages_reset_at         timestamptz DEFAULT date_trunc('month', now()),
  created_at                timestamptz DEFAULT now(),
  updated_at                timestamptz DEFAULT now()
);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Înrolare utilizatori la cursuri ──────────────────────────
CREATE TABLE public.user_enrollments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id   uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  enrolled_at timestamptz DEFAULT now(),
  UNIQUE (user_id, course_id)
);

-- ── Conversații ───────────────────────────────────────────────
CREATE TABLE public.conversations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title      text,
  topic      text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TRIGGER conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_conversations_user_id ON public.conversations(user_id);

-- ── Mesaje individuale ────────────────────────────────────────
CREATE TABLE public.messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  role            text NOT NULL CHECK (role IN ('user', 'assistant')),
  content         text,
  has_image       boolean DEFAULT false,
  image_url       text,
  tokens_input    int,
  tokens_output   int,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX idx_messages_conversation_id ON public.messages(conversation_id);

-- ── Documente pentru RAG ─────────────────────────────────────
CREATE TABLE public.documents (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id      uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  module_id      uuid REFERENCES public.course_modules(id) ON DELETE SET NULL,
  content        text,
  embedding      vector(1536),
  source_type    text CHECK (source_type IN ('bac_paper','bac_solution','lesson','formula_sheet','curriculum')),
  source_year    int,
  source_profile text,
  topic          text,
  subtopic       text,
  difficulty     text CHECK (difficulty IN ('easy','medium','hard')),
  metadata       jsonb,
  created_at     timestamptz DEFAULT now()
);

CREATE INDEX idx_documents_embedding ON public.documents
  USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_documents_course_id ON public.documents(course_id);
CREATE INDEX idx_documents_topic    ON public.documents(topic);

-- ── Progres utilizator per topic ─────────────────────────────
CREATE TABLE public.progress (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  topic           text NOT NULL,
  mastery_score   int  DEFAULT 0 CHECK (mastery_score BETWEEN 0 AND 100),
  attempts        int  DEFAULT 0,
  correct_attempts int DEFAULT 0,
  last_practiced  timestamptz,
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (user_id, topic)
);

CREATE INDEX idx_progress_user_id ON public.progress(user_id);

-- ── Exerciții generate și încercări ──────────────────────────
CREATE TABLE public.exercise_attempts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id      uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  module_id      uuid REFERENCES public.course_modules(id) ON DELETE SET NULL,
  exercise_text  text,
  exercise_topic text,
  user_solution  text,
  ai_evaluation  jsonb,
  created_at     timestamptz DEFAULT now()
);

CREATE INDEX idx_exercise_attempts_user_id ON public.exercise_attempts(user_id);

-- ── Simulări BAC ─────────────────────────────────────────────
CREATE TABLE public.bac_simulations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  profile_type     text CHECK (profile_type IN ('real','umanist')),
  exercises        jsonb,
  solutions        jsonb,
  final_score      int,
  estimated_grade  decimal(4,2),
  feedback         text,
  duration_seconds int,
  completed        boolean DEFAULT false,
  created_at       timestamptz DEFAULT now(),
  completed_at     timestamptz
);

CREATE INDEX idx_bac_simulations_user_id ON public.bac_simulations(user_id);

-- ── Device tracking pentru anti-sharing ──────────────────────
CREATE TABLE public.user_devices (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  device_fingerprint  text NOT NULL,
  last_seen_at        timestamptz DEFAULT now(),
  created_at          timestamptz DEFAULT now(),
  UNIQUE (user_id, device_fingerprint)
);

-- ── Rate limits ───────────────────────────────────────────────
CREATE TABLE public.rate_limits (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  period_start     timestamptz NOT NULL,
  period_type      text NOT NULL CHECK (period_type IN ('daily','monthly')),
  message_count    int DEFAULT 0,
  exercise_count   int DEFAULT 0,
  simulation_count int DEFAULT 0,
  updated_at       timestamptz DEFAULT now(),
  UNIQUE (user_id, period_start, period_type)
);

CREATE TRIGGER rate_limits_updated_at
  BEFORE UPDATE ON public.rate_limits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_rate_limits_user_period ON public.rate_limits(user_id, period_start, period_type);

-- ── API usage logging ─────────────────────────────────────────
CREATE TABLE public.api_usage_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  model         text,
  tokens_input  int,
  tokens_output int,
  cost_usd      decimal(10,6),
  endpoint      text,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX idx_api_usage_log_user_created ON public.api_usage_log(user_id, created_at);

-- ═══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.courses          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_modules   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.progress         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bac_simulations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_devices     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage_log    ENABLE ROW LEVEL SECURITY;

-- courses: oricine citește cursurile active (landing page, no auth needed)
CREATE POLICY "courses_public_read" ON public.courses
  FOR SELECT USING (active = true);

-- course_modules: oricine citește modulele
CREATE POLICY "course_modules_public_read" ON public.course_modules
  FOR SELECT USING (true);

-- documents: acces doar service_role (RAG se face server-side)
-- (nicio politică pentru useri = documents nu sunt vizibile direct)

-- profiles: userii citesc/modifică doar propriul profil
CREATE POLICY "profiles_select_own"  ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own"  ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- user_enrollments: userul gestionează propriile înrolări
CREATE POLICY "enrollments_select_own" ON public.user_enrollments
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "enrollments_insert_own" ON public.user_enrollments
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "enrollments_delete_own" ON public.user_enrollments
  FOR DELETE USING (auth.uid() = user_id);

-- conversations: userul gestionează propriile conversații
CREATE POLICY "conversations_select_own" ON public.conversations
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "conversations_insert_own" ON public.conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "conversations_update_own" ON public.conversations
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "conversations_delete_own" ON public.conversations
  FOR DELETE USING (auth.uid() = user_id);

-- messages: acces prin conversația owner-ului
CREATE POLICY "messages_select_own" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id AND c.user_id = auth.uid()
    )
  );
CREATE POLICY "messages_insert_own" ON public.messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id AND c.user_id = auth.uid()
    )
  );

-- progress: userul citește/modifică propriul progres
CREATE POLICY "progress_select_own" ON public.progress
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "progress_insert_own" ON public.progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "progress_update_own" ON public.progress
  FOR UPDATE USING (auth.uid() = user_id);

-- exercise_attempts
CREATE POLICY "exercise_attempts_select_own" ON public.exercise_attempts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "exercise_attempts_insert_own" ON public.exercise_attempts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- bac_simulations
CREATE POLICY "bac_simulations_select_own" ON public.bac_simulations
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "bac_simulations_insert_own" ON public.bac_simulations
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bac_simulations_update_own" ON public.bac_simulations
  FOR UPDATE USING (auth.uid() = user_id);

-- user_devices: userul vede propriile device-uri (insert/update via service_role)
CREATE POLICY "user_devices_select_own" ON public.user_devices
  FOR SELECT USING (auth.uid() = user_id);

-- rate_limits: userul vede propriile counters (modificare via funcții SECURITY DEFINER)
CREATE POLICY "rate_limits_select_own" ON public.rate_limits
  FOR SELECT USING (auth.uid() = user_id);

-- api_usage_log: userul vede propriul log
CREATE POLICY "api_usage_log_select_own" ON public.api_usage_log
  FOR SELECT USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════
-- TRIGGER: auto-create profile la signup
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, subscription_status, messages_reset_at, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    'free',
    date_trunc('month', now()),
    now(),
    now()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ═══════════════════════════════════════════════════════════════
-- FUNCȚII RATE LIMITING
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_user_id    uuid,
  p_action_type text   -- 'message' | 'exercise' | 'simulation'
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status       text;
  v_period_start timestamptz;
  v_period_type  text;
  v_count        int := 0;
BEGIN
  SELECT subscription_status INTO v_status
  FROM public.profiles WHERE id = p_user_id;

  IF v_status IS NULL THEN RETURN false; END IF;

  -- simulare: doar premium
  IF p_action_type = 'simulation' THEN
    RETURN v_status IN ('premium','family_2','family_3');
  END IF;

  -- exerciții: premium = nelimitat
  IF p_action_type = 'exercise' THEN
    IF v_status IN ('premium','family_2','family_3') THEN RETURN true; END IF;
    v_period_start := date_trunc('day', now() AT TIME ZONE 'Europe/Chisinau');
    v_period_type  := 'daily';
    SELECT COALESCE(exercise_count, 0) INTO v_count
    FROM public.rate_limits
    WHERE user_id = p_user_id AND period_start = v_period_start AND period_type = v_period_type;
    RETURN v_count < 5;
  END IF;

  -- mesaje
  IF p_action_type = 'message' THEN
    v_period_start := date_trunc('month', now() AT TIME ZONE 'Europe/Chisinau');
    v_period_type  := 'monthly';
    SELECT COALESCE(message_count, 0) INTO v_count
    FROM public.rate_limits
    WHERE user_id = p_user_id AND period_start = v_period_start AND period_type = v_period_type;
    IF v_status IN ('premium','family_2','family_3') THEN
      RETURN v_count < 500;
    ELSE
      RETURN v_count < 30;
    END IF;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_rate_limit(
  p_user_id     uuid,
  p_action_type text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status       text;
  v_period_start timestamptz;
  v_period_type  text;
BEGIN
  SELECT subscription_status INTO v_status
  FROM public.profiles WHERE id = p_user_id;

  IF p_action_type = 'exercise' AND v_status NOT IN ('premium','family_2','family_3') THEN
    v_period_start := date_trunc('day', now() AT TIME ZONE 'Europe/Chisinau');
    v_period_type  := 'daily';
  ELSE
    v_period_start := date_trunc('month', now() AT TIME ZONE 'Europe/Chisinau');
    v_period_type  := 'monthly';
  END IF;

  INSERT INTO public.rate_limits
    (user_id, period_start, period_type, message_count, exercise_count, simulation_count, updated_at)
  VALUES (
    p_user_id, v_period_start, v_period_type,
    CASE WHEN p_action_type = 'message'    THEN 1 ELSE 0 END,
    CASE WHEN p_action_type = 'exercise'   THEN 1 ELSE 0 END,
    CASE WHEN p_action_type = 'simulation' THEN 1 ELSE 0 END,
    now()
  )
  ON CONFLICT (user_id, period_start, period_type) DO UPDATE SET
    message_count    = rate_limits.message_count    + CASE WHEN p_action_type = 'message'    THEN 1 ELSE 0 END,
    exercise_count   = rate_limits.exercise_count   + CASE WHEN p_action_type = 'exercise'   THEN 1 ELSE 0 END,
    simulation_count = rate_limits.simulation_count + CASE WHEN p_action_type = 'simulation' THEN 1 ELSE 0 END,
    updated_at = now();
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- SEED DATA — cursuri inițiale
-- ═══════════════════════════════════════════════════════════════

INSERT INTO public.courses (slug, name, grade, subject, profile_type, description, active)
VALUES
  (
    'bac-mate-real-md',
    'BAC Matematică — Profil Real Moldova',
    '12',
    'matematica',
    'real',
    'Pregătire pentru examenul de Bacalaureat la matematică, profil real (fără calculator). Subiecte: algebră, geometrie, trigonometrie, calcul diferențial și integral.',
    true
  ),
  (
    'bac-mate-umanist-md',
    'BAC Matematică — Profil Umanist Moldova',
    '12',
    'matematica',
    'umanist',
    'Pregătire pentru examenul de Bacalaureat la matematică, profil umanist. Subiecte: algebră, geometrie, probabilități.',
    true
  );

-- Module pentru BAC Real
WITH real_course AS (SELECT id FROM public.courses WHERE slug = 'bac-mate-real-md')
INSERT INTO public.course_modules (course_id, name, order_index, description)
SELECT
  real_course.id, m.name, m.ord, m.description
FROM real_course, (VALUES
  ('Mulțimi și relații',             1, 'Operații cu mulțimi, relații de ordine și echivalență'),
  ('Algebră și funcții',             2, 'Funcții, ecuații, inecuații, sisteme; funcții elementare'),
  ('Trigonometrie',                  3, 'Funcții trigonometrice, formule, ecuații trigonometrice'),
  ('Geometrie plană',                4, 'Triunghiuri, poligoane, cerc; metrica planului'),
  ('Geometrie în spațiu',            5, 'Corpuri geometrice, suprafețe, volume'),
  ('Calcul diferențial',             6, 'Limite, continuitate, derivate și aplicații'),
  ('Calcul integral',                7, 'Primitive, integrala definită, aplicații'),
  ('Numere complexe',                8, 'Forma algebrică și trigonometrică, operații')
) AS m(name, ord, description);

-- Module pentru BAC Umanist
WITH umanist_course AS (SELECT id FROM public.courses WHERE slug = 'bac-mate-umanist-md')
INSERT INTO public.course_modules (course_id, name, order_index, description)
SELECT
  umanist_course.id, m.name, m.ord, m.description
FROM umanist_course, (VALUES
  ('Algebră',                        1, 'Ecuații, inecuații, funcții de bază'),
  ('Geometrie',                      2, 'Elemente de geometrie plană și în spațiu'),
  ('Probabilități și statistică',    3, 'Evenimente, probabilitate, elemente de statistică')
) AS m(name, ord, description);
