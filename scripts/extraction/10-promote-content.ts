/**
 * 10-promote-content.ts — ETAPA 9: promovează conținutul BUN în concepts.body.
 *
 * Rulează:  npm run extract:promote-content
 *           (sau: tsx --env-file=.env.local scripts/extraction/10-promote-content.ts)
 *
 * EXCLUDE (rămân de re-extras din Repere): conceptele din katex_error_report (erori KaTeX reale)
 *   ∪ cele cu confidence='low' în concept_content_proposals.
 * Pentru EXCLUSE: body NU se scrie; needs_reextraction=true, status='extras'.
 * Pentru BUNE: body = compus curat (definitie + formule_latex + conditii + exemplu, LaTeX EXACT,
 *   NU re-procesat), content_origin='manual', needs_reextraction=false,
 *   status='verificat' dacă confidence='high', altfel 'extras' (medium).
 *
 * Idempotent. NU atinge concept_content_proposals / solution_methods / diagnostic_exercises.
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';
import pLimit from 'p-limit';

function makeClient(url: string, key: string) { return createClient(url, key); }
const asStrArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/** body markdown consistent; LaTeX-ul rămâne EXACT ca în proposals (formulele în $$, fără re-escapare). */
function buildBody(definitie: string, formule: string[], conditii: string, exemplu: string): string {
  const parts: string[] = [];
  if (definitie.trim()) parts.push(definitie.trim());
  if (formule.length) parts.push('**Formule**\n\n' + formule.map((f) => `$$\n${f}\n$$`).join('\n\n'));
  if (conditii.trim()) parts.push('**Condiții**\n\n' + conditii.trim());
  if (exemplu.trim()) parts.push('**Exemplu**\n\n' + exemplu.trim());
  return parts.join('\n\n');
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Lipsesc NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
  const supabase = makeClient(url, key);

  // 1. Setul de EXCLUS = katex_error_report ∪ low-confidence.
  console.log('📥 Calculez setul de EXCLUS (erori KaTeX ∪ low-confidence) …');
  const exclude = new Set<string>();
  {
    const { data, error } = await supabase.from('katex_error_report').select('concept_id');
    if (error) throw new Error(`katex_error_report: ${error.message}`);
    for (const r of data ?? []) if (r.concept_id) exclude.add(r.concept_id as string);
  }
  let lowCount = 0;
  for (let f = 0; ; f += 1000) {
    const { data, error } = await supabase.from('concept_content_proposals').select('concept_id').eq('confidence', 'low').range(f, f + 999);
    if (error) throw new Error(`low proposals: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const r of data) { exclude.add(r.concept_id as string); lowCount++; }
    if (data.length < 1000) break;
  }
  console.log(`   → exclud ${exclude.size} concepte (din ${lowCount} low + erori KaTeX).`);

  // 2. Citește toate propunerile de conținut.
  console.log('📥 Citesc concept_content_proposals …');
  interface Prop { concept_id: string; definitie: string | null; formule_latex: unknown; conditii: string | null; exemplu: string | null; confidence: string }
  const props: Prop[] = [];
  for (let f = 0; ; f += 1000) {
    const { data, error } = await supabase.from('concept_content_proposals').select('concept_id, definitie, formule_latex, conditii, exemplu, confidence').range(f, f + 999);
    if (error) throw new Error(`proposals: ${error.message}`);
    if (!data || data.length === 0) break;
    props.push(...(data as Prop[]));
    if (data.length < 1000) break;
  }
  console.log(`   → ${props.length} propuneri.`);

  // 3. Update per concept (concurrency).
  const limit = pLimit(10);
  let promoted = 0, excluded = 0, fails = 0;
  await Promise.all(props.map((p) => limit(async () => {
    let patch: Record<string, unknown>;
    if (exclude.has(p.concept_id)) {
      patch = { body: null, content_origin: null, needs_reextraction: true, status: 'extras' };
    } else {
      const body = buildBody(p.definitie ?? '', asStrArr(p.formule_latex), p.conditii ?? '', p.exemplu ?? '');
      patch = { body, content_origin: 'manual', needs_reextraction: false, status: p.confidence === 'high' ? 'verificat' : 'extras' };
    }
    const { error } = await supabase.from('concepts').update(patch).eq('id', p.concept_id);
    if (error) { fails++; if (fails <= 5) console.error(`  ❌ ${p.concept_id}: ${error.message}`); }
    else if (exclude.has(p.concept_id)) excluded++; else promoted++;
  })));
  if (fails > 0) throw new Error(`${fails} update-uri eșuate.`);
  console.log(`✓ Promovate: ${promoted} · Excluse (flag re-extracție): ${excluded}`);

  // 4. VERIFICARE din DB reală.
  const [bodyNonEmpty, verificat, extras, needsReext, totalConcepts] = await Promise.all([
    supabase.from('concepts').select('*', { count: 'exact', head: true }).not('body', 'is', null).neq('body', ''),
    supabase.from('concepts').select('*', { count: 'exact', head: true }).eq('status', 'verificat'),
    supabase.from('concepts').select('*', { count: 'exact', head: true }).eq('status', 'extras'),
    supabase.from('concepts').select('*', { count: 'exact', head: true }).eq('needs_reextraction', true),
    supabase.from('concepts').select('*', { count: 'exact', head: true }),
  ]);
  // distribuție content_origin
  const originDist: Record<string, number> = {};
  for (let f = 0; ; f += 1000) {
    const { data, error } = await supabase.from('concepts').select('content_origin').range(f, f + 999);
    if (error) throw new Error(`origin: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const r of data) { const o = (r.content_origin as string | null) ?? '(null)'; originDist[o] = (originDist[o] ?? 0) + 1; }
    if (data.length < 1000) break;
  }

  console.log('\n──────── VERIFICARE (din DB reală) ────────');
  console.log(`Total concepte:            ${totalConcepts.count}`);
  console.log(`Cu body non-gol:           ${bodyNonEmpty.count}`);
  console.log(`status='verificat':        ${verificat.count}`);
  console.log(`status='extras':           ${extras.count}`);
  console.log(`needs_reextraction=true:   ${needsReext.count}   (așteptat ${exclude.size})`);
  console.log(`content_origin: ${Object.entries(originDist).map(([k, v]) => `${k}=${v}`).join(' · ')}`);
  console.log('\n✅ concept_content_proposals / solution_methods / diagnostic_exercises: neatinse.');
  if (needsReext.count !== exclude.size) console.error(`⚠️  needs_reextraction (${needsReext.count}) ≠ exclude (${exclude.size}) — verifică.`);
}

main().catch((err: unknown) => { console.error('\n💥 Eroare fatală:', (err as Error)?.message ?? err); process.exit(1); });
