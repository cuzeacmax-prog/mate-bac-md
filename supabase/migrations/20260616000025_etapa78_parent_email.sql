-- ETAPA 78 FAZA C: emailul părintelui (opțional) — raportul săptămânal merge
-- și către părinte când există un email separat în profil.
-- (aplicată pe remote prin MCP apply_migration: etapa78_parent_email)
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS parent_email TEXT;
