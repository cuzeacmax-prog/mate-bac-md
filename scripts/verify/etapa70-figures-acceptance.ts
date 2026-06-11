/**
 * ETAPA 70 FAZA B — ACCEPTANȚĂ: figuri de teorie + plot validat.
 *
 *  1. Registrul theory-figures: ≥30 concepte, fiecare randează SVG valid;
 *     lista completă (slug → descriere) tipărită pentru REVIZUIREA UMANĂ.
 *  2. Plot valid → SVG cu curbă; expresii malițioase → respinse EXPLICIT.
 *  3. Lecție LIVE pe un concept cu figură în registru → blocul figure
 *     kind='theory' apare în stream (modelul CERE figura, sistemul o servește).
 *
 *   npx tsx --env-file=.env.local scripts/verify/etapa70-figures-acceptance.ts
 */
import { THEORY_FIGURES } from '../../src/lib/lesson/theory-figures/registry';
import { validatePlotExpr, renderPlotSVG } from '../../src/lib/lesson/plot';
import { parseLessonBlock, LessonBlockModelSchema, type LessonBlock } from '../../src/lib/lesson/blocks';
import { LESSON_SYSTEM_PROMPT, buildLessonConceptBlock, buildLessonUserMessage } from '../../src/lib/lesson/prompt';
import { callAIStreamArray } from '../../src/lib/ai/router';
import { getConceptAnchor } from '../../src/lib/concepts/anchor';
import { createServiceClient } from '../../src/lib/supabase/service';

function fail(msg: string): never { console.error(`✗ EȘEC: ${msg}`); process.exit(1); }

async function main() {
  // ── 1) registrul ───────────────────────────────────────────────────────────
  const entries = Object.entries(THEORY_FIGURES);
  console.log(`── registrul figurilor de teorie: ${entries.length} concepte (REVIZUIRE UMANĂ) ──`);
  if (entries.length < 30) fail(`registrul are ${entries.length} < 30 concepte`);
  for (const [slug, e] of entries) {
    const svg = e.render();
    if (!svg.includes('<svg') || !svg.includes('viewBox')) fail(`SVG invalid pentru ${slug}`);
    if (svg.length < 300) fail(`SVG suspect de gol pentru ${slug} (${svg.length} chars)`);
    console.log(`  ${slug} → ${e.descriere}`);
  }
  console.log(`  toate cele ${entries.length} figuri randează SVG valid ✓`);

  // ── 2) plot: valid + malițios ──────────────────────────────────────────────
  console.log('\n── plot validat ──');
  const good: Array<[string, [number, number], number[]?]> = [
    ['x^2 - 3*x + 1', [-2, 4], [1]],
    ['sin(x)', [0, 6.283], [3.1416]],
    ['sqrt(x) + ln(x)', [0.1, 9]],
    ['(x^2 - 1)/(x - 2)', [-4, 6]],
  ];
  for (const [expr, domain, marked] of good) {
    const r = renderPlotSVG(expr, domain, marked);
    if (!r.ok) fail(`plot valid respins: ${expr} → ${r.error}`);
    if (!r.svg.includes('<path')) fail(`plot fără curbă: ${expr}`);
    console.log(`  ✓ '${expr}' pe [${domain}] → SVG ${r.svg.length} chars`);
  }
  const evil = [
    'constructor',
    'x.constructor',
    'import("fs")',
    'f(x) = x^2',
    'y + 2',
    'simplify("x")',
    'x; 2',
    'det([1,2])',
    'x == 2 ? 1 : 0',
  ];
  for (const expr of evil) {
    const r = validatePlotExpr(expr);
    if (r.ok) fail(`expresie malițioasă ACCEPTATĂ: ${expr}`);
    console.log(`  ✓ respins: '${expr}' (${r.error})`);
  }

  // ── 3) lecția LIVE include figura canonică ─────────────────────────────────
  const CONCEPT = process.env.LESSON_CONCEPT ?? 'g12-piramida';
  if (!THEORY_FIGURES[CONCEPT]) fail(`conceptul de test ${CONCEPT} nu e în registru`);
  console.log(`\n── lecție live pe '${CONCEPT}' (modelul trebuie să CEARĂ figura canonică) ──`);
  const svc = createServiceClient();
  const anchor = await getConceptAnchor(svc, CONCEPT);
  if (!anchor) fail('ancora conceptului lipsește');
  // ETAPA 75 A: structura de producție — contextul conceptului e bloc system cache-uit
  const conceptBlock = buildLessonConceptBlock({
    conceptName: anchor.name,
    gradeLevel: 12,
    theory: anchor.theory,
    exercises: anchor.exercises.map((e) => ({
      id: e.id, statement: e.statement, official_answer: e.official_answer, has_figure: e.has_figure,
    })),
    theoryFigure: { slug: CONCEPT, descriere: THEORY_FIGURES[CONCEPT].descriere },
  });
  const userMessage = buildLessonUserMessage({ conceptName: anchor.name, gradeLevel: 12 });
  const result = await callAIStreamArray('chat_free', [{ role: 'user', content: userMessage }], {
    system: [{ text: LESSON_SYSTEM_PROMPT, cache: true }, { text: conceptBlock, cache: true }],
    elementSchema: LessonBlockModelSchema,
    schemaName: 'lectie_blocuri',
  });
  const blocks: LessonBlock[] = [];
  for await (const element of result.elementStream) {
    const parsed = parseLessonBlock(element);
    if (parsed.ok) blocks.push(parsed.block);
    else console.log(`  (bloc respins de validator: ${parsed.error})`);
  }
  console.log(`  blocuri valide: ${blocks.length} (${blocks.map((b) => b.tip).join(' → ')})`);
  const theoryFig = blocks.find((b) => b.tip === 'figure' && b.kind === 'theory');
  if (!theoryFig) fail('lecția NU conține blocul figure kind=theory deși registrul îl are');
  const slug = (theoryFig as { theory_slug?: string }).theory_slug;
  if (slug !== CONCEPT) fail(`theory_slug greșit: ${slug} ≠ ${CONCEPT}`);
  const svg = THEORY_FIGURES[CONCEPT].render();
  console.log(`  ✓ figure kind=theory theory_slug=${slug} — figura servibilă (${svg.length} chars SVG)`);

  console.log('\n✅ ETAPA 70 FAZA B acceptată: registru ≥30 revizuibil, plot validat+respins, lecția cere figura canonică.');
}
main().catch((e) => { console.error(e); process.exit(1); });
