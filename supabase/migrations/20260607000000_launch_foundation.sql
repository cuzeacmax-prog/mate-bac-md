-- ════════════════════════════════════════════════════════════
-- ETAPA 10 — Foundation pentru launch comercial Mate BAC MD
-- ════════════════════════════════════════════════════════════

-- 1. EXTEND user_profiles cu coloane noi pentru launch
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS target_bac_score NUMERIC(3,1) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS grade_level INTEGER CHECK (grade_level IN (10, 11, 12)),
  ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS current_bac_prediction NUMERIC(3,1) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS initial_bac_prediction NUMERIC(3,1) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS bac_prediction_updated_at TIMESTAMP,

  -- Streak system
  ADD COLUMN IF NOT EXISTS streak_current INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS streak_longest INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS streak_last_activity_date DATE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS streak_freezes_available INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS streak_freeze_last_granted_at TIMESTAMP,

  -- Subscription
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT CHECK (subscription_tier IN ('free', 'trial', 'premium', 'pro', 'family')) DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS trial_used BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS subscription_cancelled_at TIMESTAMP,

  -- Referral
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by_user_id UUID REFERENCES user_profiles(id),

  -- Tracking
  ADD COLUMN IF NOT EXISTS total_exercises_solved INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_minutes_studied INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"push": true, "email": true, "streak_reminders": true, "daily_challenge": true, "mock_bac": true}'::jsonb,

  -- Cost tracking (pentru risk management AI)
  ADD COLUMN IF NOT EXISTS monthly_ai_cost_cents INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_cost_reset_at TIMESTAMP DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_user_profiles_subscription_tier ON user_profiles(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_user_profiles_referral_code ON user_profiles(referral_code);
CREATE INDEX IF NOT EXISTS idx_user_profiles_last_active ON user_profiles(last_active_at DESC);

-- 2. TOPIC_MASTERY — tracking mastery per topic BAC
CREATE TABLE IF NOT EXISTS topic_mastery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL,
  topic_display_name TEXT NOT NULL,
  mastery_score NUMERIC(5,2) DEFAULT 0,
  exercises_attempted INTEGER DEFAULT 0,
  exercises_correct INTEGER DEFAULT 0,
  last_practice_at TIMESTAMP,
  needs_review BOOLEAN DEFAULT FALSE,
  next_review_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, topic_id)
);

CREATE INDEX IF NOT EXISTS idx_topic_mastery_user ON topic_mastery(user_id);
CREATE INDEX IF NOT EXISTS idx_topic_mastery_review ON topic_mastery(user_id, next_review_at) WHERE needs_review = TRUE;
CREATE INDEX IF NOT EXISTS idx_topic_mastery_score ON topic_mastery(user_id, mastery_score);

-- 3. EXERCISE_ATTEMPTS — log granular fiecare exercițiu
CREATE TABLE IF NOT EXISTS exercise_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  exercise_id TEXT,
  topic_id TEXT NOT NULL,
  difficulty INTEGER CHECK (difficulty BETWEEN 1 AND 5),
  is_correct BOOLEAN NOT NULL,
  time_spent_seconds INTEGER,
  user_answer TEXT,
  correct_answer TEXT,
  hints_used INTEGER DEFAULT 0,
  session_type TEXT CHECK (session_type IN ('daily_challenge', 'free_question', 'mock_bac', 'diagnostic', 'practice')) DEFAULT 'free_question',
  metadata JSONB,
  attempted_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attempts_user_topic ON exercise_attempts(user_id, topic_id);
CREATE INDEX IF NOT EXISTS idx_attempts_user_date ON exercise_attempts(user_id, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_attempts_session_type ON exercise_attempts(user_id, session_type);

-- 4. STREAK_LOG — zile active pentru streak
CREATE TABLE IF NOT EXISTS streak_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  activity_date DATE NOT NULL,
  exercises_count INTEGER DEFAULT 0,
  minutes_studied INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, activity_date)
);

CREATE INDEX IF NOT EXISTS idx_streak_log_user_date ON streak_log(user_id, activity_date DESC);

-- 5. DAILY_CHALLENGES — challenge zilnic per user
CREATE TABLE IF NOT EXISTS daily_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  challenge_date DATE NOT NULL,
  exercises JSONB NOT NULL,
  exercises_completed INTEGER DEFAULT 0,
  exercises_correct INTEGER DEFAULT 0,
  estimated_minutes INTEGER,
  actual_minutes INTEGER,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, challenge_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_challenge_user ON daily_challenges(user_id, challenge_date DESC);

-- 6. MOCK_BAC_ATTEMPTS
CREATE TABLE IF NOT EXISTS mock_bac_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  duration_seconds INTEGER,
  total_score NUMERIC(3,1),
  exercises_data JSONB NOT NULL,
  detailed_feedback JSONB,
  grade_level INTEGER NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_mock_bac_user ON mock_bac_attempts(user_id, started_at DESC);

-- 7. SUBSCRIPTIONS — history of subscription events
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  tier TEXT NOT NULL,
  event_type TEXT CHECK (event_type IN ('started', 'renewed', 'upgraded', 'downgraded', 'cancelled', 'expired', 'refunded')),
  amount_lei INTEGER,
  duration_days INTEGER,
  payment_provider TEXT,
  payment_id TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id, created_at DESC);

-- 8. PAYMENT_ATTEMPTS — log fiecare payment attempt
CREATE TABLE IF NOT EXISTS payment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  plan_tier TEXT NOT NULL,
  amount_lei INTEGER NOT NULL,
  payment_provider TEXT NOT NULL,
  status TEXT CHECK (status IN ('pending', 'success', 'failed', 'cancelled')) DEFAULT 'pending',
  provider_payment_id TEXT,
  failure_reason TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_attempts_user ON payment_attempts(user_id, created_at DESC);

-- 9. REFERRALS
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id UUID REFERENCES user_profiles(id),
  referred_user_id UUID REFERENCES user_profiles(id),
  referral_code TEXT NOT NULL,
  status TEXT CHECK (status IN ('pending', 'completed', 'rewarded')) DEFAULT 'pending',
  reward_granted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(referred_user_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_user_id, status);

-- 10. NOTIFICATIONS_LOG
CREATE TABLE IF NOT EXISTS notifications_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  channel TEXT CHECK (channel IN ('push', 'email')),
  sent_at TIMESTAMP DEFAULT NOW(),
  opened_at TIMESTAMP,
  clicked_at TIMESTAMP,
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_notif_user_type_date ON notifications_log(user_id, notification_type, sent_at DESC);

-- 11. PUSH_SUBSCRIPTIONS — Web Push subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  keys JSONB NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);

-- 12. ANALYTICS_EVENTS — backup local events (Posthog principal)
CREATE TABLE IF NOT EXISTS analytics_events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  event_name TEXT NOT NULL,
  properties JSONB,
  session_id TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_name_date ON analytics_events(event_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_user ON analytics_events(user_id, created_at DESC);

-- 13. EMAIL_LIST — pre-launch lead capture
CREATE TABLE IF NOT EXISTS email_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  source TEXT,
  signed_up_at TIMESTAMP DEFAULT NOW(),
  converted_user_id UUID REFERENCES user_profiles(id),
  unsubscribed BOOLEAN DEFAULT FALSE,
  metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_email_list_email ON email_list(email);

-- ════════════════════════════════════════════════════════════
-- PERMISIUNI și RLS
-- ════════════════════════════════════════════════════════════

GRANT SELECT, INSERT, UPDATE, DELETE ON
  topic_mastery, exercise_attempts, streak_log, daily_challenges,
  mock_bac_attempts, subscriptions, payment_attempts, referrals,
  notifications_log, push_subscriptions, analytics_events, email_list
  TO service_role;

GRANT SELECT, INSERT, UPDATE ON
  topic_mastery, exercise_attempts, streak_log, daily_challenges,
  mock_bac_attempts, notifications_log, push_subscriptions, analytics_events
  TO authenticated;

GRANT SELECT, INSERT ON email_list TO anon;

-- RLS Policies
ALTER TABLE topic_mastery ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own mastery" ON topic_mastery FOR ALL USING (auth.uid() = user_id);

ALTER TABLE exercise_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own attempts" ON exercise_attempts FOR ALL USING (auth.uid() = user_id);

ALTER TABLE streak_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own streak" ON streak_log FOR ALL USING (auth.uid() = user_id);

ALTER TABLE daily_challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own challenges" ON daily_challenges FOR ALL USING (auth.uid() = user_id);

ALTER TABLE mock_bac_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own mock bac" ON mock_bac_attempts FOR ALL USING (auth.uid() = user_id);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own subscriptions" ON subscriptions FOR SELECT USING (auth.uid() = user_id);

ALTER TABLE payment_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own payments" ON payment_attempts FOR SELECT USING (auth.uid() = user_id);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own referrals" ON referrals FOR SELECT USING (auth.uid() = referrer_user_id OR auth.uid() = referred_user_id);

ALTER TABLE notifications_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own notifications" ON notifications_log FOR SELECT USING (auth.uid() = user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own push subs" ON push_subscriptions FOR ALL USING (auth.uid() = user_id);

-- analytics_events: doar service_role poate citi (privacy)
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users insert own events" ON analytics_events FOR INSERT WITH CHECK (auth.uid() = user_id);

-- email_list: public insert pentru lead capture
ALTER TABLE email_list ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can subscribe" ON email_list FOR INSERT WITH CHECK (true);

-- ════════════════════════════════════════════════════════════
-- FUNCTII & TRIGGERS
-- ════════════════════════════════════════════════════════════

-- Auto-update updated_at pentru topic_mastery
CREATE OR REPLACE FUNCTION update_topic_mastery_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_topic_mastery_updated_at ON topic_mastery;
CREATE TRIGGER trg_topic_mastery_updated_at
  BEFORE UPDATE ON topic_mastery
  FOR EACH ROW EXECUTE FUNCTION update_topic_mastery_updated_at();

-- Generate referral code la signup
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := UPPER(SUBSTRING(MD5(NEW.id::text || NOW()::text) FROM 1 FOR 8));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_referral_code ON user_profiles;
CREATE TRIGGER trg_generate_referral_code
  BEFORE INSERT ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION generate_referral_code();

-- ════════════════════════════════════════════════════════════
-- INITIAL DATA: BAC Topics pentru toți utilizatorii existenți
-- ════════════════════════════════════════════════════════════

-- Insert topic_mastery records pentru users existenți cu grade_level
DO $$
DECLARE
  user_record RECORD;
  i INTEGER;
  topics TEXT[][];
  topics_grade_10 TEXT[][] := ARRAY[
    ARRAY['algebra_ecuatii', 'Algebră - Ecuații'],
    ARRAY['algebra_inecuatii', 'Algebră - Inecuații'],
    ARRAY['siruri', 'Șiruri'],
    ARRAY['functii', 'Funcții'],
    ARRAY['trigonometrie_baza', 'Trigonometrie de bază'],
    ARRAY['logaritmi', 'Logaritmi'],
    ARRAY['exponentiale', 'Funcții exponențiale']
  ];
  topics_grade_11 TEXT[][] := ARRAY[
    ARRAY['limite', 'Limite de funcții'],
    ARRAY['derivate', 'Derivate'],
    ARRAY['derivate_aplicatii', 'Aplicații derivate'],
    ARRAY['polinoame', 'Polinoame'],
    ARRAY['ecuatii_log_exp', 'Ecuații log/exp'],
    ARRAY['inecuatii_log_exp', 'Inecuații log/exp'],
    ARRAY['siruri_avansate', 'Șiruri avansate']
  ];
  topics_grade_12 TEXT[][] := ARRAY[
    ARRAY['primitive', 'Primitive'],
    ARRAY['integrale', 'Integrale definite'],
    ARRAY['arii_volume', 'Arii și volume'],
    ARRAY['geometrie_3d', 'Geometrie 3D'],
    ARRAY['numere_complexe', 'Numere complexe'],
    ARRAY['matrici_determinanti', 'Matrici și determinanți'],
    ARRAY['combinatorica', 'Combinatorică'],
    ARRAY['probabilitati', 'Probabilități']
  ];
BEGIN
  FOR user_record IN SELECT id, grade_level FROM user_profiles WHERE grade_level IS NOT NULL LOOP
    IF user_record.grade_level = 10 THEN topics := topics_grade_10;
    ELSIF user_record.grade_level = 11 THEN topics := topics_grade_11;
    ELSE topics := topics_grade_12;
    END IF;

    FOR i IN 1..array_length(topics, 1) LOOP
      INSERT INTO topic_mastery (user_id, topic_id, topic_display_name)
      VALUES (user_record.id, topics[i][1], topics[i][2])
      ON CONFLICT (user_id, topic_id) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;
