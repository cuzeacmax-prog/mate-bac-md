-- ═══════════════════════════════════════════════════════════════
-- GRANT-uri SQL pentru rolurile Supabase
-- RLS policies singure nu sunt suficiente — rolul trebuie să aibă
-- și permisiuni SQL clasice la nivel de tabelă.
-- ═══════════════════════════════════════════════════════════════

-- Date utilizator — authenticated poate citi/scrie propriile rânduri (RLS filtrează)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles           TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages           TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.progress           TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exercise_attempts  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bac_simulations    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_enrollments   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_devices       TO authenticated;

-- Rate limiting — authenticated poate citi și insera (RLS + SECURITY DEFINER functions)
GRANT SELECT, INSERT ON public.rate_limits    TO authenticated;
GRANT SELECT         ON public.api_usage_log  TO authenticated;

-- Conținut public — citit de oricine (autentificat sau anonim)
GRANT SELECT ON public.courses        TO authenticated, anon;
GRANT SELECT ON public.course_modules TO authenticated, anon;

-- Funcții rate limiting — authenticated le apelează direct din client
GRANT EXECUTE ON FUNCTION public.check_rate_limit(uuid, text)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_rate_limit(uuid, text) TO authenticated;
