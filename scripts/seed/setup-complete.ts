/**
 * scripts/seed/setup-complete.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Script combinat: verifică migrarea → dacă e OK, rulează importul de scenarii
 *
 * Rulează:
 *   npm run setup:db
 *   — sau —
 *   tsx --env-file=.env.local scripts/seed/setup-complete.ts
 *
 * Logică:
 *   1. Verifică dacă tabela solution_methods există
 *   2. Dacă NU există → afișează instrucțiuni manuale clare cu link direct
 *   3. Dacă există → rulează import-scenarii (44 scenarii cu embeddings Gemini)
 *   4. Raport final
 *
 * Cost: ~$0 (Gemini Embedding free tier)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createClient } from '@supabase/supabase-js';
import { generateEmbedding } from '../../src/lib/embeddings/gemini';
import { EXTRACTED_SCENARIOS } from './scenarii-md-extracted';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!url || !key) {
  console.error('❌ Lipsesc variabile de mediu: NEXT_PUBLIC_SUPABASE_URL sau SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const projectRef = url.replace('https://', '').split('.')[0];

// ── 1. Verifică tabela ────────────────────────────────────────────────────────

async function checkTableExists(): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('solution_methods')
      .select('id')
      .limit(1);

    if (!error) return true;
    if (error.code === 'PGRST205' || error.code === '42P01' || error.message?.includes('does not exist')) return false;
    // Alt tip de eroare — tabela există, dar altceva nu merge
    console.warn(`  ⚠️  Eroare neașteptată la verificare: ${error.message} (${error.code})`);
    return false;
  } catch {
    return false;
  }
}

// ── 2. Afișează instrucțiuni dacă migrarea lipsește ───────────────────────────

function printMigrationInstructions(): void {
  console.log('\n' + '═'.repeat(60));
  console.log('⚠️  MIGRARE NECESARĂ — solution_methods nu există în DB');
  console.log('═'.repeat(60));
  console.log('\nDurată: ~1 minut. Pași:');
  console.log('');
  console.log('1. 🌐 Deschide link-ul direct:');
  console.log(`   https://app.supabase.com/project/${projectRef}/sql/new`);
  console.log('');
  console.log('2. 📋 Copiază SQL-ul din fișier:');
  console.log('   supabase/migrations/20260603000000_solution_methods.sql');
  console.log('');
  console.log('3. ▶️  Click "Run" (sau Ctrl+Enter)');
  console.log('');
  console.log('4. ✅ Verifică mesajul: "Success. No rows returned."');
  console.log('');
  console.log('5. 🔄 Rulează din nou:');
  console.log('   npm run setup:db');
  console.log('');
  console.log('📖 Instrucțiuni complete: APPLY_MANUAL.md');
  console.log('═'.repeat(60));
}

// ── 3. Import scenarii ────────────────────────────────────────────────────────

async function runImport(): Promise<{ success: number; skipped: number; failed: number }> {
  const results = { success: 0, skipped: 0, failed: 0 };
  const errors: string[] = [];
  const startTime = Date.now();

  console.log(`\n📦 Import ${EXTRACTED_SCENARIOS.length} scenarii BAC MD...`);
  console.log('');

  // Distribuție
  const byGrade = EXTRACTED_SCENARIOS.reduce((acc, s) => {
    acc[s.grade_level] = (acc[s.grade_level] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  for (const g of Object.keys(byGrade).sort()) {
    console.log(`  Clasa ${g}: ${byGrade[+g]} scenarii`);
  }
  console.log('');

  for (let i = 0; i < EXTRACTED_SCENARIOS.length; i++) {
    const s = EXTRACTED_SCENARIOS[i];
    const prefix = `[${String(i + 1).padStart(2, '0')}/${EXTRACTED_SCENARIOS.length}]`;
    process.stdout.write(`${prefix} ${s.exercise_type.padEnd(35)} `);

    try {
      // Idempotent: skip dacă există
      const { data: existing } = await supabase
        .from('solution_methods')
        .select('id')
        .eq('exercise_type', s.exercise_type)
        .maybeSingle();

      if (existing) {
        console.log('⏭️  skip');
        results.skipped++;
        continue;
      }

      // Generează embedding
      const embeddingText = [
        s.exercise_type_label,
        s.method_name,
        s.description,
        s.steps.map((st: { title: string }) => st.title).join('. '),
        s.examples.map((e: { problem: string }) => e.problem).join('. '),
      ].filter(Boolean).join(' | ');

      const embedding = await generateEmbedding(embeddingText);

      // Insert
      const { error } = await supabase.from('solution_methods').insert({
        exercise_type:       s.exercise_type,
        exercise_type_label: s.exercise_type_label,
        method_name:         s.method_name,
        region:              'MD',
        grade_level:         s.grade_level,
        topic:               s.topic,
        subtopic:            s.subtopic,
        description:         s.description,
        steps:               s.steps,
        notation_rules:      s.notation_rules,
        required_elements:   [],
        forbidden_shortcuts: [],
        examples:            s.examples,
        common_mistakes:     s.common_mistakes,
        required_tools:      s.required_tools ?? [],
        difficulty:          3,
        importance_score:    s.importance_score,
        validated:           s.validated,
        validated_by:        'Maxim (extrase din PDF Repere Metodologice 2024-2025)',
        embedding:           embedding,
      });

      if (error) throw new Error(error.message);

      console.log('✅');
      results.success++;

      // Pauză minimă (Gemini free tier: 1500 req/min)
      await new Promise(r => setTimeout(r, 100));

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`❌ ${msg.slice(0, 60)}`);
      results.failed++;
      errors.push(`${s.exercise_type}: ${msg}`);
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n' + '═'.repeat(60));
  console.log(`🏁 Import finalizat în ${duration}s`);
  console.log(`   ✅ Succes:  ${results.success}`);
  console.log(`   ⏭️  Skipped: ${results.skipped} (existau deja)`);
  console.log(`   ❌ Erori:   ${results.failed}`);

  if (errors.length > 0) {
    console.log('\nErori detaliate:');
    errors.forEach(e => console.log(`  - ${e}`));
  }

  return results;
}

// ── 4. Verificare post-import ─────────────────────────────────────────────────

async function verify(): Promise<void> {
  const { count } = await supabase
    .from('solution_methods')
    .select('*', { count: 'exact', head: true });

  const { data: byGrade } = await supabase
    .from('solution_methods')
    .select('grade_level')
    .order('grade_level');

  const gradeCounts: Record<number, number> = {};
  for (const row of byGrade ?? []) {
    gradeCounts[row.grade_level] = (gradeCounts[row.grade_level] || 0) + 1;
  }

  console.log('\n📊 Verificare DB:');
  console.log(`   Total: ${count ?? 0} metode`);
  for (const g of Object.keys(gradeCounts).sort()) {
    console.log(`   Clasa ${g}: ${gradeCounts[+g]}`);
  }

  console.log('\n🔗 Verifică în:');
  console.log('   → /admin/methodologies');
  console.log(`   → https://app.supabase.com/project/${projectRef}/editor`);
  console.log('   → SELECT COUNT(*) FROM solution_methods;');
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\n' + '═'.repeat(60));
  console.log('SETUP COMPLET — BAC MD Metodologii');
  console.log('═'.repeat(60));

  // 1. Verifică migrarea
  console.log('\n🔍 Verificare tabela solution_methods...');
  const exists = await checkTableExists();

  if (!exists) {
    printMigrationInstructions();
    process.exit(1);
  }

  console.log('  ✅ Tabela există');

  // 2. Rulează importul
  const results = await runImport();

  // 3. Verificare finală
  await verify();

  // 4. Concluzie
  if (results.failed > 0) {
    console.log(`\n⚠️  ${results.failed} scenarii nu au putut fi importate. Verifică erorile de mai sus.`);
    process.exit(1);
  } else if (results.success > 0) {
    console.log('\n✅ Import complet! RAG BAC MD este activ.');
  } else if (results.skipped === EXTRACTED_SCENARIOS.length) {
    console.log('\n✅ Toate scenariile existau deja. Nimic de importat.');
  }

  process.exit(0);
}

main().catch(err => {
  console.error('\n💥 Eroare fatală:', err instanceof Error ? err.message : err);
  process.exit(1);
});
