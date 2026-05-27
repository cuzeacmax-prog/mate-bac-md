/**
 * ETAPA 10 FIX — apply-etapa10.ts
 *
 * Aplică migrarea ETAPA 10 automat, cu cleanup pentru tabele parțiale.
 * Încearcă metodele în ordine:
 *   1. supabase db query --linked (via SUPABASE_ACCESS_TOKEN sau --db-url)
 *   2. pg direct (DATABASE_URL sau SUPABASE_DB_PASSWORD + pooler URL)
 *   3. Generează APPLY_ETAPA10_MANUAL.sql + instrucțiuni clare
 */

import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync, spawnSync } from 'child_process';

// ── env ─────────────────────────────────────────────────────────────────────
const DB_PASSWORD        = process.env.SUPABASE_DB_PASSWORD ?? '';
const DATABASE_URL       = process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL ?? '';
const ACCESS_TOKEN       = process.env.SUPABASE_ACCESS_TOKEN ?? '';
const PROJECT_REF        = 'zrudijfezfjshpdymtst';
const POOLER_HOST        = 'aws-1-eu-central-2.pooler.supabase.com';
const POOLER_USER        = `postgres.${PROJECT_REF}`;

const ROOT = join(__dirname, '../..');

function resolveDbUrl(): string | null {
  if (DATABASE_URL) return DATABASE_URL;
  if (DB_PASSWORD)  return `postgresql://${POOLER_USER}:${encodeURIComponent(DB_PASSWORD)}@${POOLER_HOST}:5432/postgres`;
  return null;
}

// ── SQL blocks ───────────────────────────────────────────────────────────────
const CLEANUP_SQL = `
-- ═══════════════════════════════════════════════════
-- CLEANUP: elimină tabele parțial create din ETAPA 10
-- ═══════════════════════════════════════════════════
DROP TABLE IF EXISTS email_list           CASCADE;
DROP TABLE IF EXISTS analytics_events     CASCADE;
DROP TABLE IF EXISTS push_subscriptions   CASCADE;
DROP TABLE IF EXISTS notifications_log    CASCADE;
DROP TABLE IF EXISTS referrals            CASCADE;
DROP TABLE IF EXISTS payment_attempts     CASCADE;
DROP TABLE IF EXISTS subscriptions        CASCADE;
DROP TABLE IF EXISTS mock_bac_attempts    CASCADE;
DROP TABLE IF EXISTS daily_challenges     CASCADE;
DROP TABLE IF EXISTS streak_log           CASCADE;
DROP TABLE IF EXISTS exercise_attempts    CASCADE;
DROP TABLE IF EXISTS topic_mastery        CASCADE;

DROP TRIGGER   IF EXISTS trg_generate_referral_code     ON user_profiles;
DROP TRIGGER   IF EXISTS trg_topic_mastery_updated_at   ON topic_mastery;
DROP FUNCTION  IF EXISTS generate_referral_code()       CASCADE;
DROP FUNCTION  IF EXISTS update_topic_mastery_updated_at() CASCADE;
`;

const USER_PROFILES_SQL = `
-- ═══════════════════════════════════════════════════
-- ENSURE: user_profiles complet
-- ═══════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS user_profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT,
  full_name   TEXT,
  avatar_url  TEXT,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON user_profiles TO service_role;
GRANT SELECT, UPDATE ON user_profiles TO authenticated;

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own profile"    ON user_profiles;
CREATE POLICY "Users see own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users update own profile" ON user_profiles;
CREATE POLICY "Users update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS \$\$
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
\$\$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

INSERT INTO public.user_profiles (id, email, full_name, avatar_url)
SELECT id, email,
  raw_user_meta_data->>'full_name',
  raw_user_meta_data->>'avatar_url'
FROM auth.users
ON CONFLICT (id) DO NOTHING;
`;

const VERIFY_SQL = `
SELECT
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public')::int AS total_tables,
  (SELECT COUNT(*) FROM user_profiles WHERE referral_code IS NOT NULL)::int           AS users_with_referral,
  (SELECT COUNT(*) FROM topic_mastery)::int                                            AS topic_mastery_rows;
`;

function loadMigration(): string {
  return readFileSync(
    join(ROOT, 'supabase/migrations/20260607000000_launch_foundation.sql'),
    'utf-8'
  );
}

// ── Metodă 1: supabase db query --linked ────────────────────────────────────
function runSupabaseQuery(sql: string, description: string): boolean {
  const tmpFile = join(ROOT, 'scripts/db/_tmp_query.sql');
  try {
    writeFileSync(tmpFile, sql, 'utf-8');

    const env: Record<string, string> = { ...process.env as Record<string, string> };
    if (ACCESS_TOKEN) env['SUPABASE_ACCESS_TOKEN'] = ACCESS_TOKEN;

    const result = spawnSync(
      'npx',
      ['supabase', 'db', 'query', '--linked', '--file', tmpFile],
      { cwd: ROOT, env, encoding: 'utf-8', timeout: 60000 }
    );

    if (existsSync(tmpFile)) unlinkSync(tmpFile);

    if (result.status === 0) {
      console.log(`   ✅ ${description}`);
      if (result.stdout?.trim()) console.log(`   ${result.stdout.trim()}`);
      return true;
    } else {
      const err = (result.stderr ?? '').slice(0, 300);
      console.error(`   ❌ ${err}`);
      return false;
    }
  } catch (err: any) {
    if (existsSync(tmpFile)) try { unlinkSync(tmpFile); } catch {}
    console.error(`   ❌ spawn error: ${err.message}`);
    return false;
  }
}

// ── Metodă 2: pg direct ─────────────────────────────────────────────────────
async function runPg(sql: string, description: string, connStr: string): Promise<boolean> {
  try {
    const { default: pg } = await import('pg') as any;
    const client = new pg.Client({
      connectionString: connStr,
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();
    await client.query(sql);
    await client.end();
    console.log(`   ✅ ${description}`);
    return true;
  } catch (err: any) {
    console.error(`   ❌ pg: ${err.message}`);
    return false;
  }
}

async function verifyPg(connStr: string): Promise<void> {
  try {
    const { default: pg } = await import('pg') as any;
    const client = new pg.Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
    await client.connect();
    const { rows } = await client.query(VERIFY_SQL);
    await client.end();
    printVerify(rows[0]);
  } catch {}
}

// ── Metodă 3: fallback manual SQL ───────────────────────────────────────────
function generateManual(): void {
  const migration = loadMigration();
  const combined = [
    '-- ══════════════════════════════════════════════════════════════════════',
    '-- ETAPA 10 — Cleanup + Migration complet (paste ONCE în Supabase Studio)',
    '-- ══════════════════════════════════════════════════════════════════════',
    '',
    CLEANUP_SQL,
    '',
    USER_PROFILES_SQL,
    '',
    migration,
    '',
    '-- ══════════════════════════════════════════════════════════════════════',
    '-- VERIFICARE FINALĂ (ar trebui să returneze total_tables >= 20)',
    '-- ══════════════════════════════════════════════════════════════════════',
    VERIFY_SQL,
  ].join('\n');

  const outPath = join(ROOT, 'APPLY_ETAPA10_MANUAL.sql');
  writeFileSync(outPath, combined, 'utf-8');
  console.log(`\n   📄 Generat: APPLY_ETAPA10_MANUAL.sql`);
}

// ── helpers ──────────────────────────────────────────────────────────────────
function printVerify(row: any): void {
  console.log('');
  console.log('📊 VERIFICARE DB:');
  console.log(`   Total tabele public:  ${row.total_tables}`);
  console.log(`   Users cu referral:    ${row.users_with_referral}`);
  console.log(`   Topic mastery rows:   ${row.topic_mastery_rows}`);
}

function printManualInstructions(): void {
  console.log('');
  console.log('╔' + '═'.repeat(58) + '╗');
  console.log('║  ACȚIUNE NECESARĂ — 1 paste, ~10 secunde              ║');
  console.log('╚' + '═'.repeat(58) + '╝');
  console.log('');
  console.log('  1. Deschide:');
  console.log(`     https://supabase.com/dashboard/project/${PROJECT_REF}/sql/new`);
  console.log('');
  console.log('  2. Ctrl+A → Delete (golește editorul)');
  console.log('');
  console.log('  3. Copiază APPLY_ETAPA10_MANUAL.sql (din rădăcina proiectului)');
  console.log('');
  console.log('  4. Paste → Click "Run"');
  console.log('');
  console.log('  5. Verifică că ultimul SELECT returnează total_tables >= 20');
  console.log('');
  console.log('─'.repeat(60));
  console.log('');
  console.log('  SAU, pentru automatizare completă în viitor:');
  console.log('');
  console.log('  A) Rulează o dată:  ! npx supabase login');
  console.log('     Apoi:             npm run db:apply-etapa10');
  console.log('');
  console.log('  B) Adaugă în .env.local:');
  console.log('     SUPABASE_ACCESS_TOKEN=<token de la https://supabase.com/dashboard/account/tokens>');
  console.log('     Sau: SUPABASE_DB_PASSWORD=<parola DB din Supabase → Settings → Database>');
  console.log('');
}

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('');
  console.log('╔' + '═'.repeat(58) + '╗');
  console.log('║  ETAPA 10 — Apply migration automat cu cleanup         ║');
  console.log('╚' + '═'.repeat(58) + '╝');

  const migration = loadMigration();

  // ══════════════════════════════════════════════════════
  // METODĂ 1: supabase db query --linked
  // ══════════════════════════════════════════════════════
  console.log('\n📦 METODĂ 1: supabase db query --linked');
  console.log('─'.repeat(40));

  if (!ACCESS_TOKEN) {
    console.log('   ⚠️  SUPABASE_ACCESS_TOKEN lipsă — încearcă oricum (token cached?)');
  }

  const s1 = runSupabaseQuery(CLEANUP_SQL,     'Cleanup tabele parțiale');
  const s2 = runSupabaseQuery(USER_PROFILES_SQL, 'Ensure user_profiles');
  const s3 = runSupabaseQuery(migration,       'ETAPA 10 migration');

  if (s1 && s2 && s3) {
    runSupabaseQuery(VERIFY_SQL, 'Verificare finală');
    console.log('\n✅ ETAPA 10 aplicată complet via supabase CLI!\n');
    return;
  }

  console.log('   ⚠️  Metoda 1 eșuată → încearcă metoda 2...');

  // ══════════════════════════════════════════════════════
  // METODĂ 2: pg direct
  // ══════════════════════════════════════════════════════
  console.log('\n📦 METODĂ 2: pg direct');
  console.log('─'.repeat(40));

  const dbUrl = resolveDbUrl();
  if (dbUrl) {
    const p1 = await runPg(CLEANUP_SQL,      'Cleanup tabele parțiale', dbUrl);
    const p2 = await runPg(USER_PROFILES_SQL,'Ensure user_profiles',    dbUrl);
    const p3 = await runPg(migration,        'ETAPA 10 migration',      dbUrl);

    if (p1 && p2 && p3) {
      await verifyPg(dbUrl);
      console.log('\n✅ ETAPA 10 aplicată complet via pg direct!\n');
      return;
    }
    console.log('   ⚠️  pg direct eșuat → generează SQL manual...');
  } else {
    console.log('   SKIP — lipsesc DATABASE_URL / SUPABASE_DB_PASSWORD');
  }

  // ══════════════════════════════════════════════════════
  // METODĂ 3: fallback manual SQL
  // ══════════════════════════════════════════════════════
  console.log('\n📦 METODĂ 3: generare SQL manual (one-paste fallback)');
  console.log('─'.repeat(40));
  generateManual();
  printManualInstructions();
}

main().catch(err => {
  console.error('\n💥 FATAL:', err.message);
  process.exit(1);
});
