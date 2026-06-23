-- ETAPA 83 FAZA A3 — coada de revizuire a mapării concept→clasă (din manuale).
-- Propunerile sunt generate de scripts/etapa83/match-curriculum.ts (determinist,
-- onest: firm vs nesigur). Maxim e arbitrul: grade_level NU se scrie automat —
-- doar la decizia ownerului din /admin/curriculum.
-- Idempotent. Tabel intern-admin (service_role scrie; RLS blochează publicul).

CREATE TABLE IF NOT EXISTS public.curriculum_proposals (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  concept_id     uuid NOT NULL REFERENCES public.concepts(id) ON DELETE CASCADE,
  concept_slug   text NOT NULL,
  concept_name   text NOT NULL,
  current_grade  integer,
  proposed_grade integer CHECK (proposed_grade IS NULL OR proposed_grade IN (9,10,11,12)),
  confidence     text NOT NULL CHECK (confidence IN ('firm','nesigur')),
  source         text,
  reason         text,
  candidates     jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- status fluxul de revizuire: pending → accepted/corrected/rejected (Maxim)
  status         text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','corrected','rejected')),
  decided_grade  integer CHECK (decided_grade IS NULL OR decided_grade IN (9,10,11,12)),
  decided_by     text,
  decided_at     timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS curriculum_proposals_concept_uq ON public.curriculum_proposals (concept_id);
CREATE INDEX IF NOT EXISTS curriculum_proposals_status_idx ON public.curriculum_proposals (status, confidence);

ALTER TABLE public.curriculum_proposals ENABLE ROW LEVEL SECURITY;
-- intern-admin: nicio politică pentru anon/authenticated → doar service_role accesează.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.curriculum_proposals TO service_role;
