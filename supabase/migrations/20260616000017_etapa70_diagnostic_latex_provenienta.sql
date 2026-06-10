-- ETAPA 70 G1: convertorul Unicode→LaTeX pentru diagnostic_exercises.
-- converted_etapa70: proveniența conversiei ('complet' | 'partial'); NULL = neconvertit.
-- original_etapa70: câmpurile originale (rollback fără pierdere de date).
alter table diagnostic_exercises
  add column if not exists converted_etapa70 text
    check (converted_etapa70 in ('complet', 'partial')),
  add column if not exists original_etapa70 jsonb;
