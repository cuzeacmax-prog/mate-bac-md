/**
 * check-migration.ts — Verifică dacă migrarea solution_methods e aplicată
 * și dacă e posibil o aplică automat via Management API
 *
 * Rulează: tsx --env-file=.env.local scripts/seed/check-migration.ts
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const token = process.env.SUPABASE_ACCESS_TOKEN;  // optional personal token
const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!url || !key) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL sau SUPABASE_SERVICE_ROLE_KEY lipsesc');
  process.exit(1);
}

// Extract project ref din URL
const projectRef = url.replace('https://', '').split('.')[0];
console.log(`📋 Project ref: ${projectRef}`);

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function checkTableExists(): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('solution_methods')
      .select('id')
      .limit(1);

    if (!error) return true;
    // "relation ... does not exist" = 42P01
    if (error.code === '42P01' || error.message?.includes('does not exist')) return false;
    // Alte erori — tabela există dar altceva e greșit
    console.log(`  ⚠️  Eroare neașteptată: ${error.message} (code: ${error.code})`);
    return false;
  } catch {
    return false;
  }
}

async function applyViaMgmtApi(): Promise<boolean> {
  if (!token) return false;

  console.log('\n🔧 Încearcă aplicare via Management API...');
  const sqlFile = join(process.cwd(), 'supabase/migrations/20260603000000_solution_methods.sql');
  const sql = readFileSync(sqlFile, 'utf-8');

  try {
    const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    });

    if (res.ok) {
      console.log('  ✅ Migration aplicată via Management API!');
      return true;
    } else {
      const body = await res.text();
      console.log(`  ❌ Management API error: ${res.status} ${body.slice(0, 200)}`);
      return false;
    }
  } catch (e) {
    console.log(`  ❌ Management API request failed: ${e instanceof Error ? e.message : e}`);
    return false;
  }
}

async function applyViaPg(): Promise<boolean> {
  if (!dbUrl) return false;
  console.log('\n🔧 Încearcă aplicare via pg directă...');

  try {
    // Dynamic import to handle optional dependency
    const { default: pg } = await import('pg' as string) as any;
    const client = new pg.Client({ connectionString: dbUrl });
    await client.connect();

    const sqlFile = join(process.cwd(), 'supabase/migrations/20260603000000_solution_methods.sql');
    const sql = readFileSync(sqlFile, 'utf-8');
    await client.query(sql);
    await client.end();
    console.log('  ✅ Migration aplicată via pg!');
    return true;
  } catch (e: any) {
    if (e?.code === '42P07') {
      console.log('  ⏭️  Tabela există deja (pg: 42P07)');
      return true;
    }
    console.log(`  ❌ pg error: ${e.message || e}`);
    return false;
  }
}

async function main() {
  console.log('\n══════════════════════════════════════════════');
  console.log('CHECK MIGRATION — solution_methods');
  console.log('══════════════════════════════════════════════\n');

  // 1. Verifică tabela
  console.log('🔍 Verificare tabela solution_methods...');
  const exists = await checkTableExists();
  console.log(exists ? '  ✅ Tabela EXISTĂ' : '  ❌ Tabela NU există');

  if (exists) {
    // Count rows
    const { count } = await supabase
      .from('solution_methods')
      .select('*', { count: 'exact', head: true });
    console.log(`  📊 Rânduri existente: ${count ?? 0}`);
    process.exit(0);
  }

  // 2. Încearcă aplicare automată
  console.log('\n📋 Tabela lipsește. Încearcă aplicare automată...');

  let applied = false;

  // Opțiunea A: Management API cu access token
  applied = await applyViaMgmtApi();

  // Opțiunea B: pg direct (dacă există SUPABASE_DB_URL)
  if (!applied) {
    applied = await applyViaPg();
  }

  if (applied) {
    // Verifică din nou
    await new Promise(r => setTimeout(r, 1000));
    const existsNow = await checkTableExists();
    if (existsNow) {
      console.log('\n✅ Migrare aplicată cu succes! Rulează acum: npm run seed:scenarii');
      process.exit(0);
    }
  }

  // 3. Nu s-a putut aplica automat
  console.log('\n❌ Nu s-a putut aplica automat.');
  console.log('═══════════════════════════════════════════════');
  console.log('ACȚIUNE MANUALĂ NECESARĂ (1 minut):');
  console.log('');
  console.log('1. Deschide: https://app.supabase.com/project/zrudijfezfjshpdymtst/sql/new');
  console.log('   (sau Supabase Studio → SQL Editor)');
  console.log('');
  console.log('2. Copiază și rulează SQL din:');
  console.log('   supabase/migrations/20260603000000_solution_methods.sql');
  console.log('');
  console.log('3. Click "Run" (Ctrl+Enter)');
  console.log('');
  console.log('4. Revino și rulează: npm run seed:scenarii');
  console.log('═══════════════════════════════════════════════');
  process.exit(1);
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
