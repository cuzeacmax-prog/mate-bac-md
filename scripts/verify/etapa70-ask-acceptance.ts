/**
 * ETAPA 70 FAZA E — ACCEPTANȚĂ: chatul îngrădit în lecție.
 *
 *  1. Întrebare ÎN TEMĂ (pe conceptul lecției) → răspuns ca blocuri valide,
 *     MAXIM 3, doar tipuri permise (step/formula/example/table/plot).
 *  2. Întrebare OFF-TOPIC (fotbal) → refuz blând care trimite la pagina „Azi",
 *     fără să rezolve subiectul cerut.
 * ACELAȘI prompt + schema ca ruta /api/lesson/ask.
 *
 *   npx tsx --env-file=.env.local scripts/verify/etapa70-ask-acceptance.ts
 */
import { createServiceClient } from '../../src/lib/supabase/service';
import { getConceptAnchor } from '../../src/lib/concepts/anchor';
import { callAIStreamArray } from '../../src/lib/ai/router';
import { LessonBlockModelSchema, parseLessonBlock, type LessonBlock } from '../../src/lib/lesson/blocks';
import { ASK_GUARD_PROMPT, buildAskUserMessage } from '../../src/lib/lesson/prompt';

const CONCEPT = 'g12-piramida';
const MAX_BLOCKS = 3;
const ALLOWED = new Set(['step', 'formula', 'example', 'table', 'plot']);

function fail(msg: string): never { console.error(`✗ EȘEC: ${msg}`); process.exit(1); }

async function ask(theory: string, conceptName: string, question: string): Promise<LessonBlock[]> {
  const result = await callAIStreamArray(
    'chat_free',
    [{ role: 'user', content: buildAskUserMessage({ conceptName, theory, question }) }],
    { system: [{ text: ASK_GUARD_PROMPT, cache: true }], elementSchema: LessonBlockModelSchema, schemaName: 'raspuns_blocuri' }
  );
  const blocks: LessonBlock[] = [];
  for await (const element of result.elementStream) {
    if (blocks.length >= MAX_BLOCKS) break;
    const parsed = parseLessonBlock(element);
    if (parsed.ok && ALLOWED.has(parsed.block.tip)) blocks.push(parsed.block);
  }
  return blocks;
}

function textOf(blocks: LessonBlock[]): string {
  return JSON.stringify(blocks);
}

async function main() {
  const svc = createServiceClient();
  const anchor = await getConceptAnchor(svc, CONCEPT);
  if (!anchor) fail('ancora lipsește');

  // ── 1) în temă ─────────────────────────────────────────────────────────────
  const onTopic = await ask(anchor.theory, anchor.name, 'Ce este apotema piramidei și la ce o folosesc?');
  console.log(`[1] în temă: ${onTopic.length} blocuri (${onTopic.map((b) => b.tip).join(', ')})`);
  if (onTopic.length === 0) fail('întrebarea în temă nu a produs blocuri valide');
  if (onTopic.length > MAX_BLOCKS) fail(`peste limita de ${MAX_BLOCKS} blocuri`);
  for (const b of onTopic) if (!ALLOWED.has(b.tip)) fail(`tip nepermis: ${b.tip}`);
  const onText = textOf(onTopic).toLowerCase();
  if (!onText.includes('apotem')) fail('răspunsul în temă nu vorbește despre apotemă');

  // ── 2) off-topic → refuz blând + trimitere la „Azi" ───────────────────────
  const offTopic = await ask(anchor.theory, anchor.name, 'Cine a câștigat Liga Campionilor anul trecut și cu ce scor?');
  console.log(`[2] off-topic: ${offTopic.length} blocuri (${offTopic.map((b) => b.tip).join(', ')})`);
  if (offTopic.length === 0) fail('off-topic nu a produs niciun bloc (refuzul trebuie să fie un bloc step)');
  if (offTopic.length > MAX_BLOCKS) fail(`peste limita de ${MAX_BLOCKS} blocuri`);
  const offText = textOf(offTopic);
  if (!/Azi/.test(offText)) fail(`refuzul nu trimite la pagina „Azi": ${offText.slice(0, 300)}`);
  if (/Liga Campionilor.{0,40}(câștigat|scor|\d{1,2}\s*[-–:]\s*\d{1,2})/i.test(offText) && /Real|Barcelona|City|Bayern|PSG|Inter/i.test(offText)) {
    fail('modelul a răspuns la subiectul off-topic în loc să refuze');
  }
  console.log(`    refuz: ${offText.slice(0, 220)}…`);

  console.log('\n✅ ETAPA 70 FAZA E acceptată: răspuns în temă ca blocuri ≤3, off-topic refuzat blând cu trimitere la „Azi".');
}
main().catch((e) => { console.error(e); process.exit(1); });
