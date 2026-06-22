-- ETAPA 82 FAZA A1 — obiectivul elevului + clasa a 9-a
--
-- Cerința structurală: "nu toți dau BAC". Adăugăm `goal` ca dimensiune separată
-- de `target_bac_score` (care rămâne nota-țintă, refolosită). Extindem clasa la
-- 9–12 (azi CHECK-ul permite doar 10/11/12).
--
-- Idempotent: rulabil de oricâte ori. RLS rămâne cel existent (user-owned:
-- "Users see/update own profile") — coloana nouă moștenește politicile tabelului.

-- 1) Obiectivul: bac | note_clasa | explorare. NULL = neconfirmat (gate-ul A3
--    cere confirmarea o singură dată la următoarea intrare).
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS goal TEXT
  CHECK (goal IS NULL OR goal IN ('bac', 'note_clasa', 'explorare'));

-- 2) Clasa 9–12: scoatem orice CHECK vechi pe grade_level (numele auto-generat
--    poate diferi între medii) și punem unul nou care acceptă și clasa 9.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE rel.relname = 'user_profiles'
      AND nsp.nspname = 'public'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%grade_level%'
  LOOP
    EXECUTE format('ALTER TABLE public.user_profiles DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_grade_level_check
  CHECK (grade_level IS NULL OR grade_level IN (9, 10, 11, 12));

-- 3) Index parțial pe elevii care încă nu și-au confirmat obiectivul (gate A3).
CREATE INDEX IF NOT EXISTS idx_user_profiles_goal_null
  ON public.user_profiles (id)
  WHERE goal IS NULL;
