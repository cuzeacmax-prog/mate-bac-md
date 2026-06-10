/**
 * ETAPA 71 FAZA C — ACCEPTANȚĂ: manipulativele.
 *
 *  1. 6 cazuri POZITIVE cu verificare STRUCTURALĂ pe SVG-ul produs
 *     (zaruri{n:2,fete:[3,5]} → exact 2 zaruri cu 3+5 pipsuri etc.).
 *  2. 4 cazuri NEGATIVE — params ilegale respinse explicit.
 *  3. Lecție LIVE pe un concept de probabilitate → blocul manipulative apare.
 *
 *   npx tsx --env-file=.env.local scripts/verify/etapa71-manipulative-acceptance.ts
 */
import { renderManipulative, MANIPULATIVE_KINDS } from '../../src/lib/lesson/manipulatives';
import { parseLessonBlock, LessonBlockModelSchema, type LessonBlock } from '../../src/lib/lesson/blocks';
import { LESSON_SYSTEM_PROMPT, buildLessonUserMessage } from '../../src/lib/lesson/prompt';
import { callAIStreamArray } from '../../src/lib/ai/router';
import { getConceptAnchor } from '../../src/lib/concepts/anchor';
import { createServiceClient } from '../../src/lib/supabase/service';

function fail(msg: string): never { console.error(`✗ EȘEC: ${msg}`); process.exit(1); }
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

async function main() {
  console.log(`── pozitive (verificare structurală pe SVG) ──`);

  // 1. zaruri{n:2, fete:[3,5]} → 2 pătrate rotunjite + 3+5=8 pipsuri
  const z = renderManipulative('zaruri', { n: 2, fete: [3, 5] });
  if (!z.ok) fail(`zaruri valide respinse: ${z.error}`);
  const diceRects = count(z.svg, /<rect[^>]*rx="12"/g);
  const pips = count(z.svg, /<circle[^>]*r="6"[^>]*fill="currentColor"/g);
  if (diceRects !== 2) fail(`zaruri: ${diceRects} pătrate ≠ 2`);
  if (pips !== 8) fail(`zaruri: ${pips} pipsuri ≠ 3+5=8`);
  console.log(`  ✓ zaruri{n:2,fete:[3,5]}: 2 zaruri, 8 pipsuri (3+5)`);

  // 2. persoane{n:4, evidentiati:[1,3]} → 4 capete, 2 cu accent
  const p = renderManipulative('persoane', { n: 4, evidentiati: [1, 3], ordonat: true });
  if (!p.ok) fail(`persoane valide respinse: ${p.error}`);
  const heads = count(p.svg, /<circle[^>]*r="13"/g);
  const accented = count(p.svg, /stroke="var\(--manip-accent[^"]*"/g);
  if (heads !== 4) fail(`persoane: ${heads} capete ≠ 4`);
  if (accented < 4) fail(`persoane: evidențiații 1 și 3 trebuie accentuați (cap+corp ×2 = ≥4 elemente accent, găsite ${accented})`);
  if (!p.svg.includes('ordinea contează')) fail('persoane ordonat fără mențiunea ordinii');
  console.log(`  ✓ persoane{n:4,evidentiati:[1,3],ordonat}: 4 persoane, pozițiile 1 și 3 accentuate`);

  // 3. urna cu 3 roșii + 2 albe, una extrasă
  const u = renderManipulative('urna', { bile: [{ culoare: 'rosii', n: 3 }, { culoare: 'albe', n: 2 }], extrase: ['rosii'] });
  if (!u.ok) fail(`urna validă respinsă: ${u.error}`);
  const balls = count(u.svg, /<circle[^>]*r="14"/g);
  if (balls !== 6) fail(`urna: ${balls} cercuri ≠ 5 bile + 1 extrasă`);
  if (!u.svg.includes('R = rosii (3)')) fail('urna: legenda lipsă');
  console.log(`  ✓ urna{rosii:3,albe:2,extrase:[rosii]}: 5 bile + 1 extrasă, legendă`);

  // 4. bare-fractii{numitor:8, evidentiate:3} → 8 celule, 3 umplute, eticheta 3/8
  const b = renderManipulative('bare-fractii', { numitor: 8, evidentiate: 3 });
  if (!b.ok) fail(`bare valide respinse: ${b.error}`);
  const cells = count(b.svg, /<rect/g);
  const filled = count(b.svg, /fill="var\(--manip-accent[^"]*"/g);
  if (cells !== 8) fail(`bare: ${cells} celule ≠ 8`);
  if (filled !== 3) fail(`bare: ${filled} umplute ≠ 3`);
  if (!b.svg.includes('3/8')) fail('bare: eticheta 3/8 lipsă');
  console.log(`  ✓ bare-fractii{8,3}: 8 celule, 3 evidențiate, eticheta 3/8`);

  // 5. dreapta-numerica cu puncte și interval
  const d = renderManipulative('dreapta-numerica', { min: -2, max: 8, puncte: [3], intervale: [{ de_la: 0, pana_la: 5 }] });
  if (!d.ok) fail(`dreapta validă respinsă: ${d.error}`);
  if (!d.svg.includes('>3<')) fail('dreapta: punctul 3 fără etichetă');
  if (count(d.svg, /opacity="0.25"/g) < 1) fail('dreapta: intervalul evidențiat lipsă');
  console.log(`  ✓ dreapta-numerica{-2..8, punct 3, interval [0,5]}`);

  // 6. venn cu intersecția evidențiată
  const v = renderManipulative('venn', { eticheta_a: 'A', eticheta_b: 'B', zone: ['AB'] });
  if (!v.ok) fail(`venn valid respins: ${v.error}`);
  if (count(v.svg, /<circle[^>]*r="86"/g) !== 2) fail('venn: trebuie 2 cercuri');
  if (count(v.svg, /<path[^>]*fill="var\(--manip-accent[^"]*"/g) !== 1) fail('venn: intersecția nu e evidențiată');
  console.log(`  ✓ venn{A,B,zone:[AB]}: 2 cercuri, intersecția accentuată`);

  console.log(`\n── negative (params ilegale respinse) ──`);
  const negatives: Array<[string, unknown, string]> = [
    ['zaruri', { n: 50, fete: [1] }, 'n peste limită'],
    ['zaruri', { n: 1, fete: [9] }, 'față ilegală 9'],
    ['urna', { bile: [{ culoare: 'rosii', n: 25 }] }, 'peste 20 de bile'],
    ['persoane', { n: 3, evidentiati: [7] }, 'evidențiat peste n'],
  ];
  for (const [kind, params, why] of negatives) {
    const r = renderManipulative(kind, params);
    if (r.ok) fail(`params ilegale ACCEPTATE (${why}): ${kind} ${JSON.stringify(params)}`);
    console.log(`  ✓ respins ${kind} (${why}): ${r.error}`);
  }
  console.log(`\nmanipulative funcționale: ${MANIPULATIVE_KINDS.length}/8`);
  // toate cele 8 randează cu params minime valide
  const smoke: Array<[string, unknown]> = [
    ['zaruri', { n: 1, fete: [6] }], ['monede', { n: 2 }], ['urna', { bile: [{ culoare: 'albe', n: 2 }] }],
    ['persoane', { n: 2 }], ['carti', { n: 3 }], ['dreapta-numerica', { min: 0, max: 5 }],
    ['bare-fractii', { numitor: 4, evidentiate: 1 }], ['venn', { eticheta_a: 'A', eticheta_b: 'B' }],
  ];
  for (const [kind, params] of smoke) {
    const r = renderManipulative(kind, params);
    if (!r.ok || !r.svg.includes('<svg')) fail(`${kind} nu randează cu params minime: ${'error' in r ? r.error : ''}`);
  }
  console.log('  ✓ toate cele 8 kinds randează SVG valid cu params minime');

  // ── lecție LIVE pe probabilitate → blocul manipulative apare ──────────────
  const CONCEPT = process.env.LESSON_CONCEPT ?? 'g12-probabilitatea-clasica-a-unui-eveniment';
  console.log(`\n── lecție live pe '${CONCEPT}' ──`);
  const svc = createServiceClient();
  const anchor = await getConceptAnchor(svc, CONCEPT);
  if (!anchor) fail('ancora lipsește');
  const userMessage = buildLessonUserMessage({
    conceptName: anchor.name,
    gradeLevel: 12,
    theory: anchor.theory,
    exercises: anchor.exercises.map((e) => ({
      id: e.id, statement: e.statement, official_answer: e.official_answer, has_figure: e.has_figure,
    })),
    theoryFigure: null,
  });
  const result = await callAIStreamArray('chat_free', [{ role: 'user', content: userMessage }], {
    system: [{ text: LESSON_SYSTEM_PROMPT, cache: true }],
    elementSchema: LessonBlockModelSchema,
    schemaName: 'lectie_blocuri',
  });
  const blocks: LessonBlock[] = [];
  for await (const element of result.elementStream) {
    const parsed = parseLessonBlock(element);
    if (parsed.ok) blocks.push(parsed.block);
  }
  console.log(`  blocuri: ${blocks.map((b) => b.tip).join(' → ')}`);
  const manip = blocks.filter((b) => b.tip === 'manipulative');
  if (manip.length === 0) fail('lecția de probabilitate NU a invocat niciun manipulativ');
  for (const m of manip) {
    const r = renderManipulative((m as { kind: string }).kind, (m as { params: unknown }).params);
    console.log(`  manipulative invocat: kind=${(m as { kind: string }).kind} params=${JSON.stringify((m as { params: unknown }).params).slice(0, 100)} → ${r.ok ? `SVG ${r.svg.length} chars` : `RESPINS: ${r.error}`}`);
  }
  if (!manip.some((m) => renderManipulative((m as { kind: string }).kind, (m as { params: unknown }).params).ok)) {
    fail('niciun manipulativ invocat nu trece validarea');
  }

  console.log('\n✅ ETAPA 71 FAZA C acceptată: 6 pozitive structurale + 4 negative + 8/8 smoke + lecția live invocă manipulative valide.');
}
main().catch((e) => { console.error(e); process.exit(1); });
