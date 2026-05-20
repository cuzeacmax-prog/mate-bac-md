-- ============================================================
-- Mate BAC MD — Admin status + Feedback table
-- Migrație: 20260520000001
-- ============================================================

-- ── 1. Adaugă 'admin' în constraint profiles.subscription_status ──
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_subscription_status_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_subscription_status_check
  CHECK (subscription_status IN ('free','premium','family_2','family_3','cancelled','admin'));

-- ── 2. Setează admin pentru contul principal ──────────────────
UPDATE public.profiles
SET subscription_status = 'admin'
WHERE email = 'wot.maxim2004@mail.ru';

-- ── 3. Update funcția check_rate_limit — bypass pentru admin ──
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_user_id   uuid,
  p_action_type text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_status        text;
  v_count         integer;
  v_limit         integer;
  v_period_start  timestamptz;
BEGIN
  SELECT subscription_status INTO v_status
  FROM public.profiles
  WHERE id = p_user_id;

  -- Admin bypasses all rate limits
  IF v_status = 'admin' THEN RETURN true; END IF;

  -- Premium / family skip rate limiting
  IF v_status IN ('premium','family_2','family_3') THEN RETURN true; END IF;

  -- Free tier: 30 messages/month
  v_limit := 30;
  v_period_start := date_trunc('month', now());

  SELECT COALESCE(message_count, 0) INTO v_count
  FROM public.rate_limits
  WHERE user_id = p_user_id
    AND period_type = 'monthly'
    AND period_start >= v_period_start;

  RETURN COALESCE(v_count, 0) < v_limit;
END;
$$;

-- ── 4. Tabela admin_feedback ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_feedback (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id         uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  message_id       uuid REFERENCES public.messages(id) ON DELETE CASCADE,
  rating           text NOT NULL CHECK (rating IN ('good','bad','needs_improvement')),
  ideal_response   text,
  notes            text,
  created_at       timestamptz DEFAULT now()
);

ALTER TABLE public.admin_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_feedback_admin_only" ON public.admin_feedback;
CREATE POLICY "admin_feedback_admin_only" ON public.admin_feedback
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND subscription_status = 'admin'
    )
  );

GRANT ALL ON public.admin_feedback TO authenticated;
GRANT ALL ON public.admin_feedback TO service_role;
