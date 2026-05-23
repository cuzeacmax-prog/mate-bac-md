-- Grants for service_role on all library tables.
-- Required for batch generator scripts that use SUPABASE_SERVICE_ROLE_KEY.
-- Apply via Supabase Studio SQL Editor or supabase db push.

GRANT SELECT, INSERT, UPDATE, DELETE ON solved_exercises TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON tikz_templates TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON gap_analysis TO service_role;

-- RPC grants are handled in 20260602100000_match_exercises_rpc.sql
