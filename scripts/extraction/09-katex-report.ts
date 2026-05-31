/**
 * 09-katex-report.ts — ETAPA 8b: scanează TOT conținutul și raportează formulele care dau
 * eroare KaTeX REALĂ (comenzi inventate / typo-uri), din formule_latex[] ȘI din proză
 * (definitie/conditii/exemplu, via segmentarea math comună). Export în katex_error_report.
 *
 * Rulează:  npm run extract:katex-report
 *           (sau: tsx --env-file=.env.local scripts/extraction/09-katex-report.ts)
 *
 * READ-ONLY față de `concepts` și `concept_content_proposals` — doar le citește. Scrie DOAR
 * în tabela-diagnostic katex_error_report (TRUNCATE + reinserare).
 */

import { createClient } from '@supabase/supabase-js';
import katex from 'katex';
import { segmentMath } from '../../src/lib/content-math';

function makeClient(url: string, key: string) { return createClient(url, key); }

function katexError(tex: string): string | null {
  try { katex.renderToString(tex, { throwOnError: true, strict: false }); return null; }
  catch (e) { return e instanceof Error ? e.message.replace(/^KaTeX parse error:\s*/, '') : 'eroare KaTeX'; }
}

interface ErrRow { concept_id: string; grade_level: number; concept_name: string; source: string; raw: string; error: string }

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Lipsesc NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
  const supabase = makeClient(url, key);

  console.log('📥 Citesc concept_content_proposals + concepts …');
  type Row = { concept_id: string; definitie: string | null; formule_latex: unknown; conditii: string | null; exemplu: string | null; concepts: { name: string; grade_level: number } };
  const rows: Row[] = [];
  for (let f = 0; ; f += 1000) {
    const { data, error } = await supabase
      .from('concept_content_proposals')
      .select('concept_id, definitie, formule_latex, conditii, exemplu, concepts!inner(name, grade_level)')
      .range(f, f + 999);
    if (error) throw new Error(`Citire: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...(data as unknown as Row[]));
    if (data.length < 1000) break;
  }
  console.log(`   → ${rows.length} concepte.`);

  // Validează formule_latex[] + bucățile math din proză.
  const errs: ErrRow[] = [];
  let totFormule = 0, totProse = 0;
  for (const r of rows) {
    const base = { concept_id: r.concept_id, grade_level: r.concepts.grade_level, concept_name: r.concepts.name };
    const formule = Array.isArray(r.formule_latex) ? (r.formule_latex as string[]) : [];
    for (const fx of formule) { totFormule++; const e = katexError(fx); if (e) errs.push({ ...base, source: 'formule_latex', raw: fx, error: e }); }
    for (const [field, txt] of [['definitie', r.definitie], ['conditii', r.conditii], ['exemplu', r.exemplu]] as const) {
      for (const seg of segmentMath(txt ?? '')) {
        if (seg.type !== 'math') continue;
        totProse++;
        const e = katexError(seg.value);
        if (e) errs.push({ ...base, source: field, raw: seg.value, error: e });
      }
    }
  }

  // TRUNCATE + insert în tabela-diagnostic.
  console.log(`🧹 Golesc katex_error_report …`);
  const { error: delErr } = await supabase.from('katex_error_report').delete().not('id', 'is', null);
  if (delErr) throw new Error(`Golire: ${delErr.message}`);
  for (let i = 0; i < errs.length; i += 500) {
    const { error } = await supabase.from('katex_error_report').insert(errs.slice(i, i + 500));
    if (error) throw new Error(`Insert [${i}]: ${error.message}`);
  }

  // Raport.
  const concepts = new Set(errs.map((e) => e.concept_id));
  const byGrade = new Map<number, number>();
  for (const e of errs) byGrade.set(e.grade_level, (byGrade.get(e.grade_level) ?? 0) + 1);
  console.log('\n──────── RAPORT ERORI KaTeX ────────');
  console.log(`Formule verificate:   ${totFormule} (formule_latex) + ${totProse} (proză)`);
  console.log(`Erori reale:          ${errs.length}  ·  concepte afectate: ${concepts.size}`);
  console.log(`Pe clasă: ${[...byGrade.entries()].sort((a, b) => a[0] - b[0]).map(([g, n]) => `cl.${g}:${n}`).join(' · ')}`);
  console.log(`Inserate în katex_error_report: ${errs.length}`);
  console.log('\nPrimele 25:');
  for (const e of errs.slice(0, 25)) console.log(`  cl.${e.grade_level} · ${e.concept_name} · [${e.source}] ${e.raw.slice(0, 50)} → ${e.error.slice(0, 40)}`);
  console.log('\n✅ Export în katex_error_report. `concepts` / `concept_content_proposals`: neatinse.');
  console.log('   Vezi în DB: select grade_level, concept_name, source, raw, error from katex_error_report order by grade_level, concept_name;');
}

main().catch((err: unknown) => { console.error('\n💥 Eroare fatală:', (err as Error)?.message ?? err); process.exit(1); });
