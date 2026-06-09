-- RECONSTITUIT (DEPLOY-SYNC 2026-06-10) din supabase_migrations.schema_migrations
-- (version 20260609191802, name fix_signup_creates_profiles_row — aplicată deja pe DB-ul live prin MCP).
-- NU re-aplica manual.

-- FIX BLOCANT: signup-ul nu crea rândul din public.profiles (tier/abonament), citit de /api/chat la fiecare mesaj.
-- 1) trigger-ul creează de-acum AMBELE profile; 2) backfill pentru userii existenți fără rând.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (id, email, full_name, subscription_status)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    'free'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- backfill: toți userii auth fără rând în profiles (inclusiv userul de test de azi)
INSERT INTO public.profiles (id, email, subscription_status)
SELECT u.id, u.email, 'free'
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;
