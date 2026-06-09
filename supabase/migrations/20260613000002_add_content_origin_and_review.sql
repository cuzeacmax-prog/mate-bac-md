-- RECONSTITUIT (DEPLOY-SYNC 2026-06-10) din supabase_migrations.schema_migrations
-- (version 20260531071420, name add_content_origin_and_review — aplicată deja pe DB-ul live prin MCP).
-- NU re-aplica manual.

-- proveniența conținutului (garda anti-generare neverificată) + flag de re-extracție
ALTER TABLE concepts ADD COLUMN IF NOT EXISTS content_origin text;
ALTER TABLE concepts ADD COLUMN IF NOT EXISTS needs_reextraction boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN concepts.content_origin IS 'manual | repere | generat_ai — provenienta continutului din body. generat_ai NU se serveste elevilor pana la verificare.';
