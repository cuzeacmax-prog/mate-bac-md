-- ETAPA 83 FAZA I — statusul foilor de formule (de_revizuit → verificat de profesor).
-- Conținutul foii e DERIVAT determinist din lecțiile canonice (R5); aici ținem doar
-- starea de aprobare per cheie de foaie (ex. "grade-12-i", "simulare"). Idempotent.

CREATE TABLE IF NOT EXISTS public.formula_sheets (
  sheet_key   text PRIMARY KEY,
  title       text,
  status      text NOT NULL DEFAULT 'de_revizuit' CHECK (status IN ('de_revizuit','verificat')),
  approved_by text,
  approved_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.formula_sheets ENABLE ROW LEVEL SECURITY;
-- elevii citesc statusul (badge-ul „verificat de profesor"); doar service_role scrie.
DROP POLICY IF EXISTS "formula_sheets read" ON public.formula_sheets;
CREATE POLICY "formula_sheets read" ON public.formula_sheets FOR SELECT TO authenticated USING (true);
GRANT SELECT ON public.formula_sheets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.formula_sheets TO service_role;
