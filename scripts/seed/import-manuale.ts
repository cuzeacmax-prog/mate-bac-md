/**
 * scripts/seed/import-manuale.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Import scenarii BAC MD extrase din manualele oficiale Achiri (cl. 10-12).
 *
 * Surse:
 *   Clasa 12: 31 scenarii COMPLETE (Achiri XII 2017, Ed. Prut) — cu steps, examples etc.
 *   Clasa 11: 30 scenarii NOI (stubs din index YAML) — completare ulterioară în /admin
 *   Clasa 10: 33 scenarii (stubs din mega_index) — 12 pot exista deja, skip automat
 *
 * Rulează: npm run seed:manuale
 * Cost:    ~$0 (Gemini Embedding free tier)
 * Durata:  ~3-5 minute (94 embeddings)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createClient } from '@supabase/supabase-js';
import { generateEmbedding } from '../../src/lib/embeddings/gemini';
import * as fs from 'fs';
import * as path from 'path';

interface NormalizedScenario {
  exercise_type: string;
  exercise_type_label: string;
  method_name: string;
  grade_level: number;
  topic: string;
  subtopic: string | null;
  description: string;
  steps: Array<{ step: number; title: string; content: string }>;
  notation_rules: Record<string, string>;
  examples: Array<{ problem: string; solution: string; answer: string; page?: number }>;
  common_mistakes: Array<{ mistake: string; correction: string }>;
  required_tools: string[] | null;
  importance_score: number;
  validated: boolean;
  validated_by: string | null;
  source?: { book: string; edition: string; page?: number; section?: string } | null;
}

async function main() {
  // ── Setup ────────────────────────────────────────────────────────────────
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error('❌ Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  console.log('\n🌱 IMPORT MANUALE OFICIALE BAC MD — START');
  console.log('═'.repeat(60));

  // ── Citire JSON-uri normalizate ────────────────────────────────────────
  const baseDir = path.join(process.cwd(), 'scripts/seed/manuale-extracted');
  const allScenarios: NormalizedScenario[] = [];

  for (const grade of ['clasa-10', 'clasa-11', 'clasa-12']) {
    const filePath = path.join(baseDir, grade, 'normalized.json');
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  ${grade}/normalized.json lipsește — skip`);
      continue;
    }
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8')) as NormalizedScenario[];
    console.log(`📚 ${grade}: ${data.length} scenarii`);
    allScenarios.push(...data);
  }

  console.log(`\n📊 Total scenarii detectate: ${allScenarios.length}`);

  // ── Verificare duplicate față de DB ──────────────────────────────────
  const { data: existing, error: existErr } = await supabase
    .from('solution_methods')
    .select('exercise_type');

  if (existErr) {
    console.error('❌ Nu pot citi DB-ul existent:', existErr.message);
    process.exit(1);
  }

  const existingTypes = new Set((existing || []).map(e => e.exercise_type));
  console.log(`📋 Scenarii deja in DB: ${existingTypes.size}`);

  const toImport = allScenarios.filter(s => !existingTypes.has(s.exercise_type));
  const skipCount = allScenarios.length - toImport.length;

  console.log(`🆕 Scenarii NOI de importat: ${toImport.length}`);
  console.log(`⏭️  Duplicate skipped: ${skipCount}`);

  if (toImport.length === 0) {
    console.log('\n✅ Toate scenariile există deja in DB. Nimic de importat.');
    return;
  }

  // ── Distribuție per clasă ─────────────────────────────────────────────
  const byGrade = toImport.reduce((acc, s) => {
    acc[s.grade_level] = (acc[s.grade_level] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);
  console.log('\nDistribuție scenarii noi:');
  for (const g of Object.keys(byGrade).sort()) {
    console.log(`   Clasa ${g}: ${byGrade[+g]}`);
  }
  console.log('');

  // ── Import loop ────────────────────────────────────────────────────────
  let success = 0;
  let failed = 0;
  const errors: string[] = [];
  const startTime = Date.now();

  for (let i = 0; i < toImport.length; i++) {
    const s = toImport[i];
    console.log(`[${i + 1}/${toImport.length}] ${s.exercise_type} (cl.${s.grade_level}, score=${s.importance_score})`);

    try {
      // Generare text pentru embedding
      const embeddingText = [
        s.exercise_type_label,
        s.method_name,
        s.description,
        s.steps.length > 0 ? s.steps.map(st => st.title).join('. ') : '',
        s.examples.length > 0 ? s.examples.slice(0, 2).map(e => e.problem).join('. ') : '',
      ].filter(Boolean).join(' | ');

      console.log(`  🧠 Generare embedding...`);
      const embedding = await generateEmbedding(embeddingText);

      // Construire description îmbogățit cu sursa
      let enrichedDescription = s.description;
      if (s.source) {
        enrichedDescription += ` [Sursa: ${s.source.book}, editia ${s.source.edition}${s.source.page ? ', pag. ' + s.source.page : ''}]`;
      }

      console.log(`  💾 Insert in DB...`);
      const { error } = await supabase.from('solution_methods').insert({
        exercise_type:       s.exercise_type,
        exercise_type_label: s.exercise_type_label,
        method_name:         s.method_name,
        region:              'MD',
        grade_level:         s.grade_level,
        topic:               s.topic,
        subtopic:            s.subtopic || null,
        description:         enrichedDescription,
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
        validated_by:        s.validated_by,
        embedding:           embedding,
      });

      if (error) throw new Error(error.message);

      console.log(`  ✅ OK`);
      success++;

      // Pauza intre requesturi Gemini (free tier: 1500 req/min)
      await new Promise(r => setTimeout(r, 100));

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ❌ Eroare: ${msg}`);
      failed++;
      errors.push(`${s.exercise_type}: ${msg}`);
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  const totalNow = existingTypes.size + success;

  console.log('\n' + '═'.repeat(60));
  console.log(`🏁 IMPORT FINALIZAT in ${duration}s`);
  console.log(`   ✅ Succes:  ${success}`);
  console.log(`   ⏭️  Skipped: ${skipCount} (existau deja)`);
  console.log(`   ❌ Erori:   ${failed}`);
  console.log(`   📊 Total scenarii in DB acum: ${totalNow}`);

  if (errors.length > 0) {
    console.log('\n❌ Erori detaliate:');
    errors.forEach(e => console.log('   -', e));
  }

  console.log('\n📌 URMATORII PASI:');
  console.log('   1. Verifica in /admin/methodologies — scenariile noi sunt marcate validated: false');
  console.log('   2. Completeaza manual steps + examples pentru cl.10 si cl.11 (stubs)');
  console.log('   3. Marcheaza validated: true dupa verificare');
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
