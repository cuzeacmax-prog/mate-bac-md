import * as fs from 'fs';
import * as path from 'path';

const MIGRATIONS_DIR = path.join(__dirname, '../../supabase/migrations');

const FILES_TO_APPLY = [
  '20260602050000_fix_embedding_dimension.sql',
  '20260602100000_match_exercises_rpc.sql',
  '20260602200000_grants_for_service_role.sql',
];

console.log('');
console.log('══════════════════════════════════════════════════════');
console.log('  Instrucțiuni aplicare migrări Supabase              ');
console.log('══════════════════════════════════════════════════════');
console.log('');
console.log('Deschide Supabase Studio → SQL Editor și execută în ORDINE:');
console.log('');

for (const file of FILES_TO_APPLY) {
  const filePath = path.join(MIGRATIONS_DIR, file);
  const exists = fs.existsSync(filePath);
  const content = exists ? fs.readFileSync(filePath, 'utf8') : '-- FIȘIER LIPSĂ';
  console.log(`── ${file} ${exists ? '✅' : '❌ LIPSĂ'}`);
  console.log('');
  console.log('```sql');
  console.log(content.trim());
  console.log('```');
  console.log('');
}

console.log('══════════════════════════════════════════════════════');
console.log('  Verificare după aplicare:');
console.log('');
console.log('  SELECT id, statement, topic,');
console.log('         octet_length(embedding::text) > 10 AS has_embedding');
console.log('  FROM solved_exercises');
console.log('  ORDER BY created_at DESC LIMIT 5;');
console.log('');
console.log('  SELECT routine_name FROM information_schema.routines');
console.log("  WHERE routine_name = 'match_exercises';");
console.log('══════════════════════════════════════════════════════');
