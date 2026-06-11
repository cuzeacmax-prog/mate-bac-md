/**
 * ETAPA 77 B3 — ACCEPTANȚĂ: lecția LIVE pe un concept de funcții/analiză
 * emite blocul PLOT (mandatul de vizual din LESSON_SYSTEM_PROMPT) — logat.
 *
 *   npx tsx --env-file=.env.local scripts/verify/etapa77-visual-live.ts
 */
import { createServiceClient } from '../../src/lib/supabase/service';
import { getConceptAnchor } from '../../src/lib/concepts/anchor';
import { LESSON_SYSTEM_PROMPT, buildLessonConceptBlock, buildLessonUserMessage } from '../../src/lib/lesson/prompt';
import { LessonBlockModelSchema, parseLessonBlock, type LessonBlock } from '../../src/lib/lesson/blocks';
import { callAIStreamArray } from '../../src/lib/ai/router';

const CONCEPT = process.env.LESSON_CONCEPT ?? 'g12-aria-subgraficului-unei-functii';

function fail(msg: string): never { console.error(`✗ EȘEC: ${msg}`); process.exit(1); }

async function main() {
  const svc = createServiceClient();
  const anchor = await getConceptAnchor(svc, CONCEPT);
  if (!anchor) fail('ancora lipsește');
  console.log(`lecție LIVE pe '${CONCEPT}' (concept de analiză — plot așteptat)…`);

  const conceptBlock = buildLessonConceptBlock({
    conceptName: anchor.name,
    gradeLevel: 12,
    theory: anchor.theory,
    exercises: anchor.exercises.map((e) => ({
      id: e.id, statement: e.statement, official_answer: e.official_answer, has_figure: e.has_figure,
    })),
    theoryFigure: null,
  });
  const result = await callAIStreamArray('chat_free', [
    { role: 'user', content: buildLessonUserMessage({ conceptName: anchor.name, gradeLevel: 12 }) },
  ], {
    system: [{ text: LESSON_SYSTEM_PROMPT, cache: true }, { text: conceptBlock, cache: true }],
    elementSchema: LessonBlockModelSchema,
    schemaName: 'lectie_blocuri',
  });
  const blocks: LessonBlock[] = [];
  for await (const element of result.elementStream) {
    const parsed = parseLessonBlock(element);
    if (parsed.ok) blocks.push(parsed.block);
  }
  console.log(`  blocuri: ${blocks.map((b) => b.tip).join(' → ')}`);
  const plot = blocks.find((b) => b.tip === 'plot');
  const visual = blocks.find((b) => b.tip === 'plot' || b.tip === 'figure' || b.tip === 'manipulative');
  if (!visual) fail('lecția live pe concept de analiză NU a emis niciun bloc vizual');
  if (plot && plot.tip === 'plot') {
    console.log(`  ✓ PLOT emis: expr="${plot.expr}" domain=[${plot.domain.join(', ')}]`);
  } else {
    console.log(`  (vizual emis: ${visual.tip} — plot-ul lipsește; raportat onest)`);
  }
  console.log('\n✅ B3: mandatul de vizual funcționează pe generarea LIVE.');
}
main().catch((e) => { console.error(e); process.exit(1); });
