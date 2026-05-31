/**
 * 18-place-topic.ts — ETAPA 19: plasare constrânsă pe TEMĂ (la clasa unde TRĂIEȘTE tema).
 *
 * Rulează:  npm run place:topic
 *
 * Pentru fiecare modul al culegerii (≠ VII, care e MIXT), candidații = conceptele al căror
 * name/subtopic/module se potrivește (ILIKE, ORICE clasă) cuvintelor temei. Top-3 semantic DOAR în
 * acel set → exercise_concept_link cu method='topic_constrained'. Reutilizează embeddings (zero cost).
 * NU șterge seturile vechi (semantic_all, constrained_g12) — le comparăm.
 *
 * NU atinge concepts/concept_edges/exercise_raw/exercise_verification. Doar exercise_concept_link.
 */

import { createClient } from '@supabase/supabase-js';
import pLimit from 'p-limit';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE = path.join(__dirname, '_ex_embeddings.json');
const METHOD = 'topic_constrained';
const TOP_K = 3;
const CONCURRENCY = 8;

// Mapare culegere (clasa 12) → cuvintele temei (ILIKE). Modulul VII = MIXT → NU se constrânge.
const MODULE_PATTERNS: Record<string, string[]> = {
  'Modulul I':    ['primitiv', 'integrala nedefinit'],
  'Modulul II':   ['integrala definit', 'arie', 'volum'],
  'Modulul III':  ['combinator', 'permutar', 'aranjament', 'combinar', 'binom', 'factorial'],
  'Modulul IV':   ['probabilit', 'statistic', 'financiar', 'dobând', 'medi'],
  'Modulul V':    ['piramid', 'poliedr', 'tetraedr', 'prism'],
  'Modulul VI':   ['con', 'cilindr', 'sfer', 'corp de rotati'],
  'Modulul VIII': ['polinom', 'bezout'],
};
const INTEGRAL_KW = ['primitiv', 'integral']; // pentru precizia pe temă Mod I/II

interface Concept { id: string; name: string; subtopic: string; module: string; grade_level: number }
function matchesTopic(c: Concept, pats: string[]): boolean {
  const hay = `${c.name}\n${c.subtopic}\n${c.module}`.toLowerCase(); // ILIKE = case-insensitive, diacritic-sensitive
  return pats.some((p) => hay.includes(p.toLowerCase()));
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Lipsesc NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
  const supabase = createClient(url, key);

  if (!fs.existsSync(CACHE)) throw new Error(`Lipsește cache-ul de embeddings ${CACHE}. Rulează întâi place:exercises.`);
  const cache: Record<string, number[]> = JSON.parse(fs.readFileSync(CACHE, 'utf-8'));
  console.log(`📦 cache embeddings exerciții: ${Object.keys(cache).length}`);

  // Concepte (metadata) + exerciții.
  const concepts: Concept[] = [];
  for (let f = 0; ; f += 1000) {
    const { data, error } = await supabase.from('concepts').select('id, name, subtopic, module, grade_level')
      .not('embedding', 'is', null).range(f, f + 999);
    if (error) throw new Error(`concepts: ${error.message}`);
    if (!data || data.length === 0) break;
    concepts.push(...data.map((c) => ({ id: c.id as string, name: (c.name as string) ?? '', subtopic: (c.subtopic as string) ?? '', module: (c.module as string) ?? '', grade_level: (c.grade_level as number) ?? 0 })));
    if (data.length < 1000) break;
  }
  interface Ex { id: string; exercise_number: string; module: string | null; statement: string }
  const exercises: Ex[] = [];
  for (let f = 0; ; f += 1000) {
    const { data, error } = await supabase.from('exercise_raw').select('id, exercise_number, module, statement').range(f, f + 999);
    if (error) throw new Error(`exercise_raw: ${error.message}`);
    if (!data || data.length === 0) break;
    exercises.push(...data.map((e) => ({ id: e.id as string, exercise_number: (e.exercise_number as string) ?? '', module: (e.module as string | null) ?? null, statement: (e.statement as string) ?? '' })));
    if (data.length < 1000) break;
  }

  // Candidați + distribuția pe clasă, per modul (RAPORT 2).
  console.log('\n──────── CANDIDAȚI PE TEMĂ (din DB, ILIKE orice clasă) ────────');
  const candByModule = new Map<string, string[]>();
  for (const [mod, pats] of Object.entries(MODULE_PATTERNS)) {
    const cand = concepts.filter((c) => matchesTopic(c, pats));
    candByModule.set(mod, cand.map((c) => c.id));
    const dist = cand.reduce((m, c) => { m[c.grade_level] = (m[c.grade_level] ?? 0) + 1; return m; }, {} as Record<number, number>);
    const distStr = Object.keys(dist).map(Number).sort((a, b) => b - a).map((g) => `cl.${g}:${dist[g]}`).join(' ');
    const flag = cand.length === 0 ? '  ⚠ ZERO candidați (cuvinte greșite?)' : '';
    console.log(`  ${mod.padEnd(14)} candidați ${String(cand.length).padStart(3)} · ${distStr || '—'}${flag}`);
  }
  console.log('  Modulul VII    — MIXT → NU se constrânge (rămâne semantic_all).');

  // Match top-3 în setul de candidați al modulului.
  interface LinkRow { exercise_id: string; concept_id: string; similarity: number; rank: number; method: string }
  const links: LinkRow[] = [];
  const limit = pLimit(CONCURRENCY);
  const touched: string[] = [];
  let skippedNoCache = 0, skippedMixt = 0, skippedNoCand = 0;
  await Promise.all(exercises.map((e) => limit(async () => {
    if (!e.module || !(e.module in MODULE_PATTERNS)) { skippedMixt++; return; } // VII sau necunoscut
    if (!cache[e.id]) { skippedNoCache++; return; }
    const ids = candByModule.get(e.module) ?? [];
    if (ids.length === 0) { skippedNoCand++; return; }
    const { data, error } = await supabase.rpc('match_concepts_in_set', { query_embedding: JSON.stringify(cache[e.id]), match_count: TOP_K, ids });
    if (error) { console.error(`  ⚠ ${e.exercise_number}: ${error.message}`); return; }
    touched.push(e.id);
    (data as Array<{ concept_id: string; similarity: number }>).forEach((row, i) => {
      links.push({ exercise_id: e.id, concept_id: row.concept_id, similarity: row.similarity, rank: i + 1, method: METHOD });
    });
  })));
  console.log(`\n🔗 ${touched.length} exerciții plasate pe temă → ${links.length} propuneri · sărite: VII/necunoscut ${skippedMixt}, fără cache ${skippedNoCache}, fără candidați ${skippedNoCand}`);

  // Idempotent DOAR pe method='topic_constrained'.
  for (let i = 0; i < touched.length; i += 100) {
    const { error } = await supabase.from('exercise_concept_link').delete().eq('method', METHOD).in('exercise_id', touched.slice(i, i + 100));
    if (error) throw new Error(`Ștergere: ${error.message}`);
  }
  for (let i = 0; i < links.length; i += 500) {
    const { error } = await supabase.from('exercise_concept_link').insert(links.slice(i, i + 500));
    if (error) throw new Error(`Insert [${i}]: ${error.message}`);
  }

  // RAPORT pe modul: plasate + sim avg.
  console.log('\n──────── VERIFICARE (din DB reală, method=\'topic_constrained\') ────────');
  const exModule = new Map(exercises.map((e) => [e.id, e.module]));
  const conceptById = new Map(concepts.map((c) => [c.id, c]));
  const perModule = new Map<string, { placed: Set<string>; sims: number[] }>();
  for (const l of links) {
    const mod = exModule.get(l.exercise_id) ?? '?';
    const agg = perModule.get(mod) ?? { placed: new Set<string>(), sims: [] };
    if (l.rank === 1) { agg.placed.add(l.exercise_id); agg.sims.push(l.similarity); }
    perModule.set(mod, agg);
  }
  for (const mod of Object.keys(MODULE_PATTERNS)) {
    const agg = perModule.get(mod);
    if (!agg) { console.log(`  ${mod.padEnd(14)} — 0 plasate`); continue; }
    const avg = agg.sims.reduce((s, x) => s + x, 0) / Math.max(1, agg.sims.length);
    console.log(`  ${mod.padEnd(14)} plasate ${String(agg.placed.size).padStart(3)} · sim top-1 avg ${avg.toFixed(3)}`);
  }

  // RAPORT 3: precizia pe temă Mod I/II — % top-1 pe concept de integrală.
  for (const mod of ['Modulul I', 'Modulul II']) {
    const top1 = links.filter((l) => l.rank === 1 && exModule.get(l.exercise_id) === mod);
    const onIntegral = top1.filter((l) => { const c = conceptById.get(l.concept_id); return c && INTEGRAL_KW.some((k) => `${c.name}`.toLowerCase().includes(k)); }).length;
    const pct = top1.length ? (100 * onIntegral / top1.length).toFixed(1) : '—';
    console.log(`  ${mod}: top-1 pe concept de integrală ${onIntegral}/${top1.length} (${pct}%)`);
  }

  // RAPORT 4: eșantion 12 (top-1).
  const { data: sample } = await supabase.from('exercise_concept_link')
    .select('similarity, exercise_raw!inner(exercise_number, module, statement), concepts!inner(name, grade_level)')
    .eq('method', METHOD).eq('rank', 1).limit(12);
  console.log('\nEșantion (12 × enunț → noul top-1):');
  for (const s of (sample ?? []) as unknown as Array<{ similarity: number; exercise_raw: { exercise_number: string; module: string; statement: string }; concepts: { name: string; grade_level: number } }>) {
    const ex = s.exercise_raw;
    console.log(`  [${ex.module}] nr.${ex.exercise_number}: ${ex.statement.slice(0, 60)}`);
    console.log(`      → (cl.${s.concepts.grade_level}) ${s.concepts.name.slice(0, 50)}  (sim ${s.similarity.toFixed(3)})`);
  }
  console.log('\n✅ Doar exercise_concept_link (method=\'topic_constrained\'). Seturile vechi + restul: neatinse.');
}

main().catch((err: unknown) => { console.error('\n💥 Eroare fatală:', (err as Error)?.message ?? err); process.exit(1); });
