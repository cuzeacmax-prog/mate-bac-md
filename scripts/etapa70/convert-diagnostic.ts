/**
 * convert-diagnostic.ts — ETAPA 70 G1: aplică convertorul Unicode→LaTeX pe
 * cele 327 diagnostic_exercises și scrie ÎNAPOI în DB cu proveniență.
 *
 * - originalul se salvează în original_etapa70 (rollback fără pierdere);
 * - idempotent: la re-rulare convertește DIN original, nu din textul convertit;
 * - converted_etapa70 = 'complet' | 'partial' (au rămas notații neconvertite);
 * - raport: complet/parțial + 5 exemple înainte/după.
 *
 *   DRY_RUN=1 npx tsx --env-file=.env.local scripts/etapa70/convert-diagnostic.ts
 *            npx tsx --env-file=.env.local scripts/etapa70/convert-diagnostic.ts
 */
import { createServiceClient } from '../../src/lib/supabase/service';
import { unicodeToLatex } from '../../src/lib/content/unicode-latex';

const DRY = process.env.DRY_RUN === '1';

interface Row {
  id: string;
  prompt: string;
  correct_answer: string;
  distractors: Record<string, string> | null;
  explanation: string | null;
  original_etapa70: Record<string, unknown> | null;
}

async function main() {
  const svc = createServiceClient();
  const { data, error } = await svc
    .from('diagnostic_exercises')
    .select('id, prompt, correct_answer, distractors, explanation, original_etapa70')
    .limit(1000);
  if (error) throw error;
  const rows = (data ?? []) as Row[];
  console.log(`diagnostic_exercises: ${rows.length} rânduri${DRY ? ' (DRY RUN — nu scriu nimic)' : ''}`);

  let complet = 0;
  let partial = 0;
  let neschimbat = 0;
  const examples: Array<{ before: string; after: string }> = [];

  for (const row of rows) {
    // sursa = originalul dacă există (re-rulare), altfel textul curent
    const src = (row.original_etapa70 as Row | null) ?? row;
    const p = unicodeToLatex(src.prompt as string);
    const ca = unicodeToLatex(src.correct_answer as string);
    const ex = unicodeToLatex((src.explanation as string | null) ?? '');
    const dist: Record<string, string> = {};
    let distFull = true;
    for (const [k, v] of Object.entries((src.distractors as Record<string, string> | null) ?? {})) {
      const r = unicodeToLatex(v);
      dist[k] = r.out;
      distFull = distFull && r.full;
    }
    const full = p.full && ca.full && ex.full && distFull;
    const changed =
      p.out !== src.prompt || ca.out !== src.correct_answer ||
      ex.out !== ((src.explanation as string | null) ?? '') ||
      JSON.stringify(dist) !== JSON.stringify(src.distractors ?? {});

    if (!changed) {
      neschimbat++;
      continue;
    }
    if (full) complet++; else partial++;
    if (examples.length < 5 && /\$/.test(p.out)) {
      examples.push({ before: src.prompt as string, after: p.out });
    }

    if (!DRY) {
      const { error: upErr } = await svc
        .from('diagnostic_exercises')
        .update({
          prompt: p.out,
          correct_answer: ca.out,
          explanation: ex.out || null,
          distractors: dist,
          converted_etapa70: full ? 'complet' : 'partial',
          original_etapa70: row.original_etapa70 ?? {
            prompt: row.prompt,
            correct_answer: row.correct_answer,
            distractors: row.distractors,
            explanation: row.explanation,
          },
        })
        .eq('id', row.id);
      if (upErr) {
        console.error(`update ${row.id}: ${upErr.message}`);
        process.exit(1);
      }
    }
  }

  console.log(`\nconvertite COMPLET: ${complet}`);
  console.log(`convertite PARȚIAL (marcate, au rămas notații): ${partial}`);
  console.log(`neschimbate (fără notație de convertit): ${neschimbat}`);
  console.log('\n5 exemple înainte → după:');
  for (const e of examples) {
    console.log(`  ÎNAINTE: ${e.before.slice(0, 110)}`);
    console.log(`  DUPĂ   : ${e.after.slice(0, 110)}\n`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
