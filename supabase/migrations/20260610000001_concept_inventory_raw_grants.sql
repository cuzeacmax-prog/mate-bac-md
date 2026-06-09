-- RECONSTITUIT (DEPLOY-SYNC 2026-06-10) din supabase_migrations.schema_migrations
-- (version 20260530101644, name concept_inventory_raw_grants — aplicată deja pe DB-ul live prin MCP).
-- NU re-aplica manual.

GRANT ALL ON TABLE concept_inventory_raw TO service_role;
GRANT ALL ON TABLE concept_inventory_raw TO authenticated;
ALTER TABLE concept_inventory_raw ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON concept_inventory_raw
  FOR ALL TO service_role USING (true) WITH CHECK (true);
