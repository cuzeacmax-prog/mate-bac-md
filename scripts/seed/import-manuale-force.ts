/**
 * scripts/seed/import-manuale-force.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * ETAPA 7.3 — Re-import FORCE UPDATE din normalized.json
 *
 * PROBLEMA rezolvată:
 *   Import V1 (import-manuale.ts) făcea SKIP pe scenariile existente.
 *   Rezultat: 45 scenarii în DB cu conținut trunchiat (1 exemplu, 1 greșeală).
 *   normalized.json (clasa-12) conține 4-11 exemple și 5-10 greșeli per scenariu.
 *
 * STRATEGIE:
 *   - UPDATE dacă exercise_type există în DB (NU SKIP)
 *   - INSERT dacă e nou
 *   - Embedding regenerat cu text COMPLET (steps + examples + title)
 *   - IDEMPOTENT — poate fi re-rulat oricând
 *
 * Rulează: npm run seed:manuale-force
 * Cost:    ~$0 (Gemini Embedding free tier)
 * Durată:  ~3-5 minute (94 embeddings)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createClient } from '@supabase/supabase-js';
import { generateEmbedding } from '../../src/lib/embeddings/gemini';
import * as fs from 'fs';
import * as path from 'path';

interface ManualScenario {
  exercise_type:       string;
  exercise_type_label: string;
  method_name:         string;
  grade_level:         number;
  topic:               string;
  subtopic?:           string | null;
  description:         string;
  steps:               Array<{ step: number; title: string; content: string }>;
  notation_rules:      Record<string, string>;
  examples:            Array<{ problem: string; solution: string; answer: string; page?: number }>;
  common_mistakes:     Array<{ mistake: string; correction: string }>;
  required_elements?:  string[];
  forbidden_shortcuts?: string[];
  required_tools?:     string[] | null;
  importance_score?:   number;
  difficulty?:         number;
  validated?:          boolean;
  validated_by?:       string | null;
  source?:             Record<string, unknown> | null;
}

async function main() {
  // ── Setup ────────────────────────────────────────────────────────────────
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error('❌ Missing env vars: NEXT_PUBLIC_SUPABASE_URL și/sau SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  console.log('\n🚀 IMPORT FORCE UPDATE — Re-import din normalized.json');
  console.log('   Strategie: UPDATE existing (NU skip) + INSERT new');
  console.log('═'.repeat(62));

  // ── Citire normalized.json ────────────────────────────────────────────
  const baseDir = path.join(process.cwd(), 'scripts/seed/manuale-extracted');
  const allScenarios: ManualScenario[] = [];

  for (const grade of ['clasa-10', 'clasa-11', 'clasa-12']) {
    const filePath = path.join(baseDir, grade, 'normalized.json');
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  Lipsă: ${filePath} — skip`);
      continue;
    }
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as ManualScenario[];
    const stat = fs.statSync(filePath);
    console.log(`📚 ${grade}: ${data.length} scenarii (${(stat.size / 1024).toFixed(1)} KB)`);
    allScenarios.push(...data);
  }

  // ── Statistici conținut ──────────────────────────────────────────────
  const withContent = allScenarios.filter(s => s.examples.length > 0 || s.steps.length > 0);
  const stubs = allScenarios.filter(s => s.examples.length === 0 && s.steps.length === 0);
  console.log(`\n📊 Total scenarii: ${allScenarios.length}`);
  console.log(`   ✅ Cu conținut complet: ${withContent.length}`);
  console.log(`   ⚠️  Stubs (fără steps/examples): ${stubs.length}`);

  // ── Verificare DB existent ──────────────────────────────────────────
  const { data: existing, error: existErr } = await supabase
    .from('solution_methods')
    .select('exercise_type');

  if (existErr) {
    console.error('❌ Nu pot citi DB:', existErr.message);
    process.exit(1);
  }

  const existingSet = new Set((existing || []).map(e => e.exercise_type));
  const toUpdate = allScenarios.filter(s => existingSet.has(s.exercise_type));
  const toInsert = allScenarios.filter(s => !existingSet.has(s.exercise_type));

  console.log(`\n📋 DB curent: ${existingSet.size} scenarii`);
  console.log(`   🔄 De UPDATE: ${toUpdate.length}`);
  console.log(`   🆕 De INSERT: ${toInsert.length}`);
  console.log('');

  // ── Import loop ────────────────────────────────────────────────────
  let created = 0;
  let updated = 0;
  let failed = 0;
  const errors: string[] = [];
  const startTime = Date.now();

  for (let i = 0; i < allScenarios.length; i++) {
    const s = allScenarios[i];
    const isUpdate = existingSet.has(s.exercise_type);

    console.log(`\n[${i + 1}/${allScenarios.length}] ${s.exercise_type} (cl.${s.grade_level})`);
    console.log(`   Conținut: ${s.steps.length} etape | ${s.examples.length} exemple | ${s.common_mistakes.length} greșeli | ${Object.keys(s.notation_rules).length} notation rules`);
    console.log(`   Status: ${isUpdate ? '🔄 UPDATE' : '🆕 CREATE'}`);

    try {
      // ── Generare embedding text COMPLET ──────────────────────────────
      const embeddingParts: string[] = [
        s.exercise_type_label,
        s.method_name,
        s.description,
      ];

      // Adaugă titlurile etapelor
      if (s.steps.length > 0) {
        embeddingParts.push(s.steps.map(st => `${st.title}: ${st.content}`).join('. '));
      }

      // Adaugă problemele din exemple (primele 3, pentru lungime embedding)
      if (s.examples.length > 0) {
        embeddingParts.push(s.examples.slice(0, 3).map(ex => ex.problem).join('. '));
      }

      // Adaugă notation rules (cheile și valorile)
      if (Object.keys(s.notation_rules).length > 0) {
        embeddingParts.push(Object.entries(s.notation_rules).map(([k, v]) => `${k}: ${v}`).join(', '));
      }

      const embeddingText = embeddingParts.filter(Boolean).join(' | ').substring(0, 8000);
      console.log(`   🧠 Embedding (${embeddingText.length} chars)...`);

      const embedding = await generateEmbedding(embeddingText);

      // ── Construire record ─────────────────────────────────────────────
      const record: Record<string, unknown> = {
        exercise_type:       s.exercise_type,
        exercise_type_label: s.exercise_type_label,
        method_name:         s.method_name,
        region:              'MD',
        grade_level:         s.grade_level,
        topic:               s.topic,
        subtopic:            s.subtopic ?? null,
        description:         s.description,
        steps:               s.steps,
        notation_rules:      s.notation_rules,
        required_elements:   s.required_elements ?? [],
        forbidden_shortcuts: s.forbidden_shortcuts ?? [],
        examples:            s.examples,
        common_mistakes:     s.common_mistakes,
        required_tools:      s.required_tools ?? null,
        importance_score:    s.importance_score ?? 5,
        difficulty:          s.difficulty ?? 3,
        validated:           s.validated !== undefined ? s.validated : (s.examples.length > 0),
        validated_by:        s.validated_by ?? (s.examples.length > 0 ? 'Maxim (manuale oficiale BAC MD - re-import)' : null),
        embedding,
      };

      if (isUpdate) {
        // UPDATE — înlocuiește conținutul existent cu conținut complet
        const { error } = await supabase
          .from('solution_methods')
          .update(record)
          .eq('exercise_type', s.exercise_type);

        if (error) throw new Error(error.message);
        console.log(`   ✅ UPDATED (${s.examples.length} exemple, ${s.common_mistakes.length} greșeli)`);
        updated++;
      } else {
        // INSERT — scenariu nou
        const { error } = await supabase
          .from('solution_methods')
          .insert(record);

        if (error) throw new Error(error.message);
        console.log(`   ✅ CREATED`);
        created++;
      }

      // Rate limit Gemini (free tier: 1500 req/min — safe la 500ms)
      await new Promise(r => setTimeout(r, 500));

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`   ❌ EROARE: ${msg}`);
      failed++;
      errors.push(`${s.exercise_type}: ${msg}`);
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  const totalInDb = existingSet.size + created;

  console.log('\n' + '═'.repeat(62));
  console.log(`🏁 IMPORT FORCE UPDATE FINALIZAT în ${duration}s`);
  console.log('═'.repeat(62));
  console.log(`   🆕 Created (scenarii noi): ${created}`);
  console.log(`   🔄 Updated (conținut îmbogățit): ${updated}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📊 Total scenarii în DB acum: ${totalInDb}`);

  if (errors.length > 0) {
    console.log('\n❌ Erori detaliate:');
    errors.forEach(e => console.log('   -', e));
  }

  console.log('\n📌 VERIFICARE ÎN SUPABASE SQL EDITOR:');
  console.log(`   SELECT exercise_type,`);
  console.log(`          jsonb_array_length(examples) as nr_exemple,`);
  console.log(`          jsonb_array_length(common_mistakes) as nr_greseli,`);
  console.log(`          jsonb_array_length(steps) as nr_etape`);
  console.log(`   FROM solution_methods`);
  console.log(`   ORDER BY nr_exemple DESC LIMIT 20;`);

  console.log('\n📌 PAȘI URMĂTORI:');
  console.log('   1. Verifică /admin/methodologies — fiecare scenariu cl.12 să aibă 3+ exemple');
  console.log('   2. Completează manual steps + examples pentru cl.10 și cl.11 (stubs)');
  console.log('   3. Marchează validated: true după verificare');
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
