/**
 * ETAPA 75 C3 — ACCEPTANȚA rutării pe dificultate.
 *
 *  1. 10 mesaje de test ETICHETATE MANUAL (5 simple, 5 grele) → clasificatorul
 *     determinist trebuie 10/10;
 *  2. distribuția simple/hard pe mesajele REALE (role=user) din ultimele 14
 *     zile, raportată;
 *  3. maparea task-urilor per tier (free/hard → chat_hard etc.).
 *
 *   npx tsx scripts/verify/etapa75-routing-acceptance.ts
 */
import { classifyDifficulty, routeChatTask } from '../../src/lib/ai/difficulty';
import { createServiceClient } from '../../src/lib/supabase/service';

function fail(msg: string): never { console.error(`✗ EȘEC: ${msg}`); process.exit(1); }

// etichetate manual (eu, pe tipologia reală a mesajelor elevilor)
const LABELED: Array<{ text: string; slug?: string; expected: 'simple' | 'hard' }> = [
  // ── simple ────────────────────────────────────────────────────────────────
  { text: 'Cât face 2+2?', expected: 'simple' },
  { text: 'Ce înseamnă DVA?', expected: 'simple' },
  { text: 'Cum se calculează aria unui pătrat cu latura 5?', expected: 'simple' },
  { text: 'x = 7 e corect?', expected: 'simple' },
  { text: 'Mulțumesc, am înțeles! Mai dă-mi un exercițiu ușor.', expected: 'simple' },
  // ── hard ──────────────────────────────────────────────────────────────────
  { text: 'Demonstrați că șirul $a_n = \\frac{n+1}{n}$ este descrescător și mărginit.', expected: 'hard' },
  { text: 'Calculați $\\int_0^1 x e^{x^2} dx$ folosind schimbarea de variabilă.', slug: 'g12-integrala-definita', expected: 'hard' },
  { text: 'a) Determinați domeniul funcției $f(x) = \\ln(x^2 - 4)$; b) calculați limita la $+\\infty$; c) studiați monotonia.', expected: 'hard' },
  { text: 'Se dă piramida patrulateră regulată VABCD cu latura bazei 12 cm și înălțimea 8 cm. Calculați aria laterală, aria totală și volumul piramidei, apoi determinați măsura unghiului diedru dintre o față laterală și planul bazei.', expected: 'hard' },
  { text: 'Câte numere de 4 cifre distincte se pot forma cu cifrele 1-7? Folosiți aranjamente $A_7^4$ și justificați de ce nu sunt combinări.', expected: 'hard' },
];

async function main() {
  // ── 1) 10/10 pe setul etichetat ───────────────────────────────────────────
  let correct = 0;
  for (const m of LABELED) {
    const v = classifyDifficulty(m.text, m.slug ?? null);
    const ok = v.level === m.expected;
    if (ok) correct++;
    console.log(`  ${ok ? '✓' : '✗'} [${v.level}:${v.score}] (așteptat ${m.expected}) ${m.text.slice(0, 60)}`);
  }
  if (correct !== LABELED.length) fail(`${correct}/${LABELED.length} — clasificatorul greșește pe setul etichetat`);
  console.log(`✓ ${correct}/${LABELED.length} pe mesajele etichetate manual\n`);

  // ── 2) maparea task-urilor per tier ──────────────────────────────────────
  const cases: Array<[string, 'simple' | 'hard', string]> = [
    ['free', 'simple', 'chat_free'],
    ['free', 'hard', 'chat_hard'],
    ['premium', 'simple', 'chat_simple'],
    ['premium', 'hard', 'chat_hard'],
    ['admin', 'hard', 'chat_admin'],
  ];
  for (const [status, level, expected] of cases) {
    const got = routeChatTask(level, status);
    if (got !== expected) fail(`routeChatTask(${level}, ${status}) = ${got}, așteptat ${expected}`);
  }
  console.log('✓ maparea tier × dificultate → task corectă (5/5)\n');

  // ── 3) distribuția pe mesajele reale din ultimele 14 zile ────────────────
  const svc = createServiceClient();
  const since = new Date(Date.now() - 14 * 86400_000).toISOString();
  const { data: msgs } = await svc
    .from('messages')
    .select('content, role')
    .eq('role', 'user')
    .gte('created_at', since)
    .limit(2000);
  const real = (msgs ?? []).filter((m) => !!m.content && !(m.content as string).startsWith('Începe lecția'));
  let hard = 0;
  for (const m of real) {
    if (classifyDifficulty(m.content as string).level === 'hard') hard++;
  }
  const n = real.length || 1;
  console.log(
    `distribuția pe ${real.length} mesaje reale (14 zile): simple=${real.length - hard} (${Math.round(((real.length - hard) * 100) / n)}%) · hard=${hard} (${Math.round((hard * 100) / n)}%)`
  );
  console.log('\n✅ C3 acceptată: 10/10 etichetate + mapare task-uri + distribuția raportată.');
}
main().catch((e) => { console.error(e); process.exit(1); });
