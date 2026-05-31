-- ETAPA 14: rezultatele verificării deterministe (CAS) per exercițiu/subpunct. Separat, read-only pe rest.

CREATE TABLE IF NOT EXISTS exercise_verification (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id   uuid        NOT NULL REFERENCES exercise_raw(id) ON DELETE CASCADE,
  subpart       text,        -- a/b/c sau NULL = exercițiul întreg
  method        text,        -- 'cas_sympy_integral'
  computed_latex text,       -- primitiva F în LaTeX (NULL dacă neparsabil)
  verified      boolean,     -- self-check: d/dx F == integrand (NULL dacă neparsabil)
  note          text,        -- motiv neparsabil / eroare CAS / observație
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exercise_verification_ex ON exercise_verification (exercise_id);
CREATE INDEX IF NOT EXISTS idx_exercise_verification_method ON exercise_verification (method);

GRANT ALL ON TABLE exercise_verification TO service_role;
GRANT ALL ON TABLE exercise_verification TO authenticated;

ALTER TABLE exercise_verification ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON exercise_verification
  FOR ALL TO service_role USING (true) WITH CHECK (true);
