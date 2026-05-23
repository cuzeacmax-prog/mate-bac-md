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

const BACKUP_FILE = process.argv[2];
if (!BACKUP_FILE) {
  console.error('❌ Utilizare: npm run backup:import -- backups/library-TIMESTAMP.json');
  process.exit(1);
}

const filePath = path.isAbsolute(BACKUP_FILE) ? BACKUP_FILE : path.join(process.cwd(), BACKUP_FILE);
if (!fs.existsSync(filePath)) {
  console.error(`❌ Fișier inexistent: ${filePath}`);
  process.exit(1);
}

const UPSERT_TABLES = ['tikz_templates', 'solved_exercises'];
const SKIP_TABLES = ['gap_analysis'];
const CHUNK_SIZE = 50;

async function upsertChunked(table: string, rows: object[]): Promise<{ ok: number; err: number }> {
  let ok = 0;
  let err = 0;

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict: 'id' });
    if (error) {
      console.warn(`  ⚠️ Chunk ${i}–${i + chunk.length}: ${error.message}`);
      err += chunk.length;
    } else {
      ok += chunk.length;
    }
  }

  return { ok, err };
}

async function main() {
  console.log(`\n📥 Import din: ${filePath}\n`);

  const raw = fs.readFileSync(filePath, 'utf8');
  const backup = JSON.parse(raw) as { exported_at: string; tables: Record<string, object[]> };

  console.log(`🗓️  Backup din: ${backup.exported_at}\n`);

  for (const [table, rows] of Object.entries(backup.tables)) {
    if (SKIP_TABLES.includes(table)) {
      console.log(`⏭️  ${table}: omis (${rows.length} rânduri)`);
      continue;
    }

    if (!UPSERT_TABLES.includes(table)) {
      console.log(`⏭️  ${table}: tabel necunoscut, omis`);
      continue;
    }

    if (rows.length === 0) {
      console.log(`⬜ ${table}: gol, omis`);
      continue;
    }

    console.log(`📋 ${table}: ${rows.length} rânduri…`);
    const { ok, err } = await upsertChunked(table, rows);
    console.log(`   ✅ ${ok} upsert, ❌ ${err} erori`);
  }

  console.log('\n✅ Import complet.');
}

main().catch((e) => { console.error('❌', e.message); process.exit(1); });
