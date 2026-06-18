-- ETAPA 79 FAZA B: coada umană de reparare body-uri LaTeX (decizia 2).
ALTER TABLE exercise_raw
  ADD COLUMN IF NOT EXISTS human_body_status text
    CHECK (human_body_status IN ('coada','rezolvat'));
COMMENT ON COLUMN exercise_raw.human_body_status IS
  'ETAPA 79: starea în coada umană de reparare LaTeX (coada/rezolvat). NULL = neintrat în coadă. Maxim curăță; modelul nu rescrie (R5).';
