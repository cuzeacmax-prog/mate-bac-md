/**
 * setup-all.ts — ETAPA 11 end-to-end setup automation
 *
 * Strategy:
 *   1. Conectare pg → aplică migrările în ordine
 *   2. Dacă DB indisponibil → generează APPLY_ALL_MIGRATIONS.sql (manual fallback)
 *   3. După migrări → rulează diagnostic:generate-pool dacă pool < 50 exerciții
 *
 * Run: npm run db:setup-all
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import pg from 'pg';
import { spawn } from 'child_process';

const PROJECT_REF = 'zrudijfezfjshpdymtst';

const MIGRATIONS = [
  '20260607000000_launch_foundation.sql',
  '20260608000000_onboarding_diagnostic.sql',
];

// ── Connection ───────────────────────────────────────────────────────────────

/**
 * Try multiple Supabase connection string formats in order:
 *   1. Explicit DATABASE_URL env var
 *   2. Direct connection  db.PROJECT.supabase.co:5432  (postgres user)
 *   3. Pooler transaction  aws-0-eu-west-2.pooler:6543  (postgres.PROJECT user)
 */
function buildDbUrls(): string[] {
  if (process.env.DATABASE_URL) return [process.env.DATABASE_URL];
  const pwd = process.env.SUPABASE_DB_PASSWORD;
  if (!pwd) return [];
  const enc = encodeURIComponent(pwd);
  return [
    // Direct (no pgbouncer)
    `postgresql://postgres:${enc}@db.${PROJECT_REF}.supabase.co:5432/postgres`,
    // Pooler transaction mode
    `postgresql://postgres.${PROJECT_REF}:${enc}@aws-0-eu-west-2.pooler.supabase.com:6543/postgres`,
    // Pooler session mode
    `postgresql://postgres.${PROJECT_REF}:${enc}@aws-0-eu-west-2.pooler.supabase.com:5432/postgres`,
  ];
}

async function makeClient(): Promise<pg.Client | null> {
  const urls = buildDbUrls();
  if (urls.length === 0) return null;

  for (const url of urls) {
    const label = url.replace(/:([^:@]+)@/, ':***@').substring(0, 80);
    const client = new pg.Client({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 8000,
    });
    try {
      await client.connect();
      console.log(`   Connected via: ${label}`);
      return client;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const host = label.split('@')[1]?.split('/')[0] ?? label;
      console.log(`   skip ${host} — ${msg.substring(0, 80)}`);
      try { await client.end(); } catch { /* ignore */ }
    }
  }
  console.error('   All connection attempts failed');
  return null;
}

function buildDbUrl(): string | null {
  const urls = buildDbUrls();
  return urls[0] ?? null;
}

async function execSql(sql: string, desc: string): Promise<boolean> {
  const client = await makeClient();
  if (!client) return false;
  try {
    await client.query(sql);
    return true;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`   ERROR ${desc}: ${msg.substring(0, 300)}`);
    return false;
  } finally {
    try { await client.end(); } catch { /* ignore */ }
  }
}

async function tableExists(name: string): Promise<boolean> {
  const client = await makeClient();
  if (!client) return false;
  try {
    const { rows } = await client.query(
      `SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1)`,
      [name],
    );
    return rows[0].exists === true;
  } catch {
    return false;
  } finally {
    try { await client.end(); } catch { /* ignore */ }
  }
}

// ── npm script runner ────────────────────────────────────────────────────────

function runNpmScript(script: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn('npm', ['run', script], { stdio: 'inherit', shell: true });
    child.on('close', (code) => resolve(code === 0));
    child.on('error', () => resolve(false));
  });
}

// ── Manual SQL generator ─────────────────────────────────────────────────────

const BASE_SCHEMA_SQL = `
-- BASE SCHEMA: user_profiles + handle_new_user trigger
-- (Necesar dacă tabelul user_profiles nu există încă)

DROP TABLE IF EXISTS email_list CASCADE;
DROP TABLE IF EXISTS analytics_events CASCADE;
DROP TABLE IF EXISTS push_subscriptions CASCADE;
DROP TABLE IF EXISTS notifications_log CASCADE;
DROP TABLE IF EXISTS referrals CASCADE;
DROP TABLE IF EXISTS payment_attempts CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS mock_bac_attempts CASCADE;
DROP TABLE IF EXISTS daily_challenges CASCADE;
DROP TABLE IF EXISTS streak_log CASCADE;
DROP TABLE IF EXISTS exercise_attempts CASCADE;
DROP TABLE IF EXISTS topic_mastery CASCADE;
DROP TABLE IF EXISTS diagnostic_sessions CASCADE;
DROP TABLE IF EXISTS diagnostic_exercises CASCADE;

DROP TRIGGER IF EXISTS trg_generate_referral_code ON user_profiles;
DROP FUNCTION IF EXISTS generate_referral_code() CASCADE;
DROP FUNCTION IF EXISTS update_topic_mastery_updated_at() CASCADE;

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON user_profiles TO service_role;
GRANT SELECT, UPDATE ON user_profiles TO authenticated;

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own profile" ON user_profiles;
CREATE POLICY "Users see own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users update own profile" ON user_profiles;
CREATE POLICY "Users update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill existing users
INSERT INTO public.user_profiles (id, email, full_name, avatar_url)
SELECT id, email,
  raw_user_meta_data->>'full_name',
  raw_user_meta_data->>'avatar_url'
FROM auth.users
ON CONFLICT (id) DO NOTHING;
`;

function generateManualScript(): void {
  const header = [
    '-- ================================================================',
    '-- ALL MIGRATIONS COMBINED -- ETAPA 10 + ETAPA 11',
    '-- Lipesti tot in Supabase SQL Editor -> Run',
    `-- Dashboard: https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new`,
    '-- ================================================================',
    '',
  ].join('\n');

  let combined = header + BASE_SCHEMA_SQL;

  for (const m of MIGRATIONS) {
    const p = join('supabase/migrations', m);
    if (existsSync(p)) {
      combined += `\n-- === ${m} ===\n`;
      combined += readFileSync(p, 'utf-8');
      combined += '\n';
    } else {
      combined += `\n-- WARNING: File not found: ${m}\n`;
    }
  }

  combined += `
-- ================================================================
-- VERIFICATION
-- ================================================================
SELECT
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public') AS total_tables,
  (SELECT COUNT(*) FROM topic_mastery)          AS topic_mastery_rows,
  (SELECT COUNT(*) FROM diagnostic_exercises)   AS diagnostic_ex_rows;
`;

  writeFileSync('APPLY_ALL_MIGRATIONS.sql', combined, 'utf-8');

  console.log('Generated: APPLY_ALL_MIGRATIONS.sql\n');
  console.log('Steps:');
  console.log('  PowerShell:');
  console.log('    Get-Content -Raw APPLY_ALL_MIGRATIONS.sql | Set-Clipboard');
  console.log(`  Browser: https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new`);
  console.log('  Ctrl+A -> Delete -> Ctrl+V -> Run\n');
  console.log('  Then:');
  console.log('    npm run diagnostic:generate-pool\n');
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n===========================================================');
  console.log('   ETAPA 11 -- Setup automat complet');
  console.log('===========================================================\n');

  // ── Test DB connectivity ──────────────────────────────────────────────────
  const dbUrl = buildDbUrl();
  if (!dbUrl) {
    console.log('WARNING: SUPABASE_DB_PASSWORD lipseste in .env.local');
    console.log('  Get parola: https://supabase.com/dashboard/project/' + PROJECT_REF + '/settings/database\n');
    generateManualScript();
    return;
  }

  const testClient = await makeClient();
  if (!testClient) {
    console.log('WARNING: Nu pot conecta la DB. Generez SQL manual...\n');
    generateManualScript();
    return;
  }
  await testClient.end();
  console.log('OK: DB connection\n');

  // ── STEP 1: Ensure user_profiles exists ───────────────────────────────────
  console.log('STEP 1: Ensure user_profiles exists...');
  const upExists = await tableExists('user_profiles');
  if (!upExists) {
    console.log('  user_profiles not found — creating base schema...');
    const ok = await execSql(BASE_SCHEMA_SQL, 'base schema');
    if (!ok) {
      console.log('  Base schema failed. Generez SQL manual...\n');
      generateManualScript();
      return;
    }
    console.log('  OK: base schema applied');
  } else {
    console.log('  OK: user_profiles exists');

    // Cleanup diagnostic tables so they get re-created cleanly
    await execSql(
      `DROP TABLE IF EXISTS diagnostic_sessions CASCADE;
       DROP TABLE IF EXISTS diagnostic_exercises CASCADE;`,
      'cleanup diagnostics',
    );
  }
  console.log();

  // ── STEP 2: Apply migrations ───────────────────────────────────────────────
  const tableMap: Record<string, string> = {
    '20260607000000_launch_foundation.sql': 'topic_mastery',
    '20260608000000_onboarding_diagnostic.sql': 'diagnostic_sessions',
  };

  for (const migName of MIGRATIONS) {
    const checkTable = tableMap[migName];
    const exists = checkTable ? await tableExists(checkTable) : false;

    if (exists) {
      console.log(`STEP 2: ${migName}`);
      console.log(`  OK: Already applied (${checkTable} exists) -- skip\n`);
      continue;
    }

    console.log(`STEP 2: Applying ${migName}...`);
    const p = join('supabase/migrations', migName);

    if (!existsSync(p)) {
      console.log(`  WARNING: File not found: ${p} -- skip\n`);
      continue;
    }

    const sql = readFileSync(p, 'utf-8');
    const ok = await execSql(sql, migName);

    if (!ok) {
      console.log('\n  Migration failed. Generez SQL manual ca fallback...\n');
      generateManualScript();
      return;
    }

    console.log('  OK: Applied\n');
  }

  // ── STEP 3: Verify ────────────────────────────────────────────────────────
  console.log('STEP 3: Verificare...');
  const verifyClient = await makeClient();
  if (!verifyClient) {
    console.log('  WARNING: Cannot verify -- continuing');
  } else {
    try {
      const { rows } = await verifyClient.query(`
        SELECT
          (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public') AS total_tables,
          (SELECT COUNT(*) FROM topic_mastery)          AS tm_count,
          (SELECT COUNT(*) FROM diagnostic_exercises)   AS de_count
      `);
      const r = rows[0];
      console.log(`  OK: Total tables:          ${r.total_tables}`);
      console.log(`  OK: topic_mastery rows:     ${r.tm_count}`);
      console.log(`  OK: diagnostic_exercises:   ${r.de_count}`);

      const deCount = parseInt(r.de_count, 10);
      await verifyClient.end();

      // ── STEP 4: Generate pool ─────────────────────────────────────────────
      console.log();
      if (deCount < 50) {
        const hasKey = !!process.env.ANTHROPIC_API_KEY;
        if (!hasKey) {
          console.log('STEP 4: Pool generation -- ANTHROPIC_API_KEY not set');
          console.log('  Add ANTHROPIC_API_KEY to .env.local then run:');
          console.log('  npm run diagnostic:generate-pool\n');
        } else {
          console.log(`STEP 4: Pool are ${deCount} exercitii -- generez (target: 100+)...`);
          console.log('  (estimat 5-10 min, cost ~$0.10-0.30)\n');
          const ok = await runNpmScript('diagnostic:generate-pool');
          console.log(ok
            ? '\n  OK: Pool generat cu succes'
            : '\n  WARNING: Pool generation esuat -- ruleaza manual: npm run diagnostic:generate-pool',
          );
        }
      } else {
        console.log(`STEP 4: Pool are deja ${deCount} exercitii -- skip\n`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  WARNING: Verify error: ${msg.substring(0, 200)}`);
      try { await verifyClient.end(); } catch { /* ignore */ }
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n===========================================================');
  console.log('   SETUP COMPLET');
  console.log('===========================================================\n');
  console.log('Raman 2 actiuni manuale (~15 min total):');
  console.log('  1. Setup Google OAuth:  cat SETUP_GOOGLE_OAUTH.md');
  console.log('  2. Setup Posthog:       cat SETUP_POSTHOG.md\n');
  console.log('  Sau deschide direct in browser:');
  console.log(`  OAuth:   https://supabase.com/dashboard/project/${PROJECT_REF}/auth/providers`);
  console.log('  Posthog: https://eu.posthog.com/signup\n');
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error('\nFATAL:', msg);
  process.exit(1);
});
