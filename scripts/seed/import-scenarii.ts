/**
 * scripts/seed/import-scenarii.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Import 44 scenarii BAC MD în Supabase + generare embeddings Gemini
 *
 * IMPORTANT: NU rula automat. Rulează MANUAL după ce ai aplicat migrarea DB:
 *   npm run seed:scenarii
 *
 * Cost: ~$0 (Gemini Embedding free tier)
 * Durată estimată: 1-2 minute (44 embeddings × ~1s fiecare)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createClient } from '@supabase/supabase-js';
import { generateEmbedding } from '../../src/lib/embeddings/gemini';
import { EXTRACTED_SCENARIOS } from './scenarii-md-extracted';

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error('❌ Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  console.log('\n🌱 Import scenarii BAC MD — PORNIT');
  console.log(`📋 ${EXTRACTED_SCENARIOS.length} scenarii de importat\n`);

  // Distribuție per clasă
  const byGrade = EXTRACTED_SCENARIOS.reduce((acc, s) => {
    acc[s.grade_level] = (acc[s.grade_level] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);

  console.log('Distribuție:');
  for (const g of Object.keys(byGrade).sort()) {
    console.log(`   Clasa ${g}: ${byGrade[+g]} scenarii`);
  }

  // Distribuție per topic
  const byTopic = EXTRACTED_SCENARIOS.reduce((acc, s) => {
    acc[s.topic] = (acc[s.topic] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('\nPer topic:');
  for (const t of Object.keys(byTopic).sort()) {
    console.log(`   ${t}: ${byTopic[t]}`);
  }
  console.log('');

  let success = 0;
  let failed = 0;
  let skipped = 0;
  const errors: string[] = [];
  const startTime = Date.now();

  for (let i = 0; i < EXTRACTED_SCENARIOS.length; i++) {
    const s = EXTRACTED_SCENARIOS[i];
    console.log(`[${i + 1}/${EXTRACTED_SCENARIOS.length}] ${s.exercise_type} (cl.${s.grade_level})`);

    try {
      // 1. Verifică dacă există deja (idempotent)
      const { data: existing } = await supabase
        .from('solution_methods')
        .select('id')
        .eq('exercise_type', s.exercise_type)
        .maybeSingle();

      if (existing) {
        console.log(`  ⏭️  SKIP — există deja (id: ${existing.id})`);
        skipped++;
        continue;
      }

      // 2. Generează embedding din combinarea textelor relevante
      const embeddingText = [
        s.exercise_type_label,
        s.method_name,
        s.description,
        s.steps.map(st => st.title).join('. '),
        s.examples.map(e => e.problem).join('. '),
      ].filter(Boolean).join(' | ');

      console.log(`  🧠 Generare embedding...`);
      const embedding = await generateEmbedding(embeddingText);

      // 3. Insert în DB
      console.log(`  💾 Insert în DB...`);
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

      console.log(`  ✅ OK`);
      success++;

      // Pauză minimă între requests Gemini (free tier: 1500 req/min)
      await new Promise(r => setTimeout(r, 100));

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ❌ Eroare: ${msg}`);
      failed++;
      errors.push(`${s.exercise_type}: ${msg}`);
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n' + '═'.repeat(60));
  console.log(`🏁 Import finalizat în ${duration}s`);
  console.log(`   ✅ Succes:  ${success}`);
  console.log(`   ⏭️  Skipped: ${skipped} (existau deja)`);
  console.log(`   ❌ Erori:   ${failed}`);

  if (errors.length > 0) {
    console.log('\nErori detaliate:');
    errors.forEach(e => console.log(`  - ${e}`));
  }

  console.log('\nVerifică în:');
  console.log('  → /admin/methodologies (UI admin)');
  console.log('  → Supabase Studio → Table solution_methods');
  console.log('  → SELECT COUNT(*) FROM solution_methods;');
}

main().catch(err => {
  console.error('\n💥 Eroare fatală:', err instanceof Error ? err.message : err);
  process.exit(1);
});
