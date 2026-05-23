import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL sau SUPABASE_SERVICE_ROLE_KEY lipsă');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const OUTPUT_DIR = path.join(process.cwd(), 'backups');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const OUTPUT_FILE = path.join(OUTPUT_DIR, `library-${TIMESTAMP}.json`);

const PAGE_SIZE = 100;

async function fetchAll(table: string): Promise<object[]> {
  const rows: object[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(from, from + PAGE_SIZE - 1)
      .order('created_at', { ascending: true });

    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data || data.length === 0) break;

    rows.push(...data);
    console.log(`  ${table}: ${rows.length} rânduri`);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return rows;
}

async function main() {
  console.log(`\n📦 Export bibliotecă → ${OUTPUT_FILE}\n`);

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const backup = {
    exported_at: new Date().toISOString(),
    tables: {} as Record<string, object[]>,
  };

  for (const table of ['tikz_templates', 'solved_exercises', 'gap_analysis']) {
    console.log(`📋 Fetching ${table}…`);
    try {
      backup.tables[table] = await fetchAll(table);
    } catch (e) {
      console.warn(`  ⚠️ ${e instanceof Error ? e.message : e}`);
      backup.tables[table] = [];
    }
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(backup, null, 2), 'utf8');

  const totalRows = Object.values(backup.tables).reduce((s, t) => s + t.length, 0);
  const sizeMb = (fs.statSync(OUTPUT_FILE).size / 1024 / 1024).toFixed(2);

  console.log(`\n✅ Export complet:`);
  console.log(`   Fișier: ${OUTPUT_FILE}`);
  console.log(`   Dimensiune: ${sizeMb} MB`);
  console.log(`   Total rânduri: ${totalRows}`);
  for (const [t, rows] of Object.entries(backup.tables)) {
    console.log(`   ${t}: ${rows.length}`);
  }
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });
