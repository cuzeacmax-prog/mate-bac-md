/**
 * ETAPA 60 PAS 3 — TEST CU ASSERT pentru frontier_concepts (nu ochiometric).
 *
 * Scenariu sintetic (user auth creat ad-hoc, șters la final):
 *  - X = g12-formula-leibniz-newton: TOATE prerechizitele lui X primesc mastery 0.7
 *    → X TREBUIE să apară în frontieră (mastery 0, prereq toate ≥0.6).
 *  - Z = g12-integrala-nedefinita: primește mastery 0.7
 *    → Z NU trebuie să apară (mastery ≥ 0.6).
 *  - Y = g12-volumul-corpului-de-rotatie: un prerechizit al lui Y (ne-partajat cu X)
 *    primește mastery 0.2, restul 0.7 → Y NU trebuie să apară (prereq sub prag).
 *  - Invariante pe TOATE rândurile întoarse: mastery < 0.6 și prereq_total = prereq_ok.
 *
 *   npx tsx --env-file=.env.local scripts/verify/frontier-test.ts
 */
import { createServiceClient } from '../../src/lib/supabase/service';

const X = 'g12-formula-leibniz-newton';
// Y se alege dinamic din candidați: primul cu ≥1 prerechizit ne-partajat cu X.
const Y_CANDIDATES = [
  'g12-volumul-corpului-de-rotatie',
  'g12-volumul-piramidei',
  'g12-aria-sferei-si-calotei-sferice',
  'g12-binomul-lui-newton',
  'g11-determinant-de-ordinul-3',
];
const Z = 'g12-integrala-nedefinita';
const GRADE = 12;

// fail prin throw (nu process.exit) ca finally-ul să poată șterge userul sintetic.
function fail(msg: string): never { throw new Error('ASSERT FAILED: ' + msg); }

async function main() {
  const svc = createServiceClient();

  // user sintetic
  const { data: created, error: cuErr } = await svc.auth.admin.createUser({
    email: `etapa60-frontier-${Date.now()}@test.local`,
    email_confirm: true,
  });
  if (cuErr || !created.user) { console.error('createUser:', cuErr?.message); process.exit(1); }
  const uid = created.user.id;
  console.log('user sintetic:', uid);

  try {
    // id-uri + prerechizite (from_concept = dependent, to_concept = prerechizit)
    const { data: cs } = await svc.from('concepts').select('id, slug').in('slug', [X, Z, ...Y_CANDIDATES]);
    const bySlug = new Map((cs ?? []).map((c) => [c.slug as string, c.id as string]));
    if (!bySlug.has(X) || !bySlug.has(Z)) fail(`concepte lipsă: ${[...bySlug.keys()].join(',')}`);

    const prereqsOf = async (id: string): Promise<string[]> => {
      const { data } = await svc.from('concept_edges').select('to_concept').eq('from_concept', id);
      return (data ?? []).map((r) => r.to_concept as string);
    };
    const prX = await prereqsOf(bySlug.get(X)!);
    const setX = new Set(prX);

    // alege Y: primul candidat cu ≥1 prerechizit ne-partajat cu X (și diferit de Z)
    let Y = '', prY: string[] = [], blocked: string | undefined;
    for (const cand of Y_CANDIDATES) {
      const id = bySlug.get(cand);
      if (!id) continue;
      const pr = await prereqsOf(id);
      const b = pr.find((p) => !setX.has(p) && p !== bySlug.get(Z) && p !== bySlug.get(X));
      if (pr.length > 0 && b) { Y = cand; prY = pr; blocked = b; break; }
    }
    if (!Y || !blocked) fail('niciun candidat Y cu prerechizit ne-partajat cu X — extinde lista');
    console.log(`X=${X} (prereq ${prX.length}), Y=${Y} (prereq ${prY.length}), prerechizit blocat: ${blocked}`);

    // inserează mastery sintetic
    const rows = [
      ...prX.map((id) => ({ user_id: uid, concept_id: id, mastery: 0.7, evidence_count: 1, source: ['diagnostic'] })),
      ...prY.filter((id) => id !== blocked && !setX.has(id))
        .map((id) => ({ user_id: uid, concept_id: id, mastery: 0.7, evidence_count: 1, source: ['diagnostic'] })),
      { user_id: uid, concept_id: blocked, mastery: 0.2, evidence_count: 1, source: ['diagnostic'] },
      { user_id: uid, concept_id: bySlug.get(Z)!, mastery: 0.7, evidence_count: 1, source: ['diagnostic'] },
    ];
    const { error: insErr } = await svc.from('concept_mastery').upsert(rows, { onConflict: 'user_id,concept_id' });
    if (insErr) fail('insert mastery: ' + insErr.message);

    // frontiera completă (limit mare → set integral, aserțiuni exacte)
    const { data: frontier, error: fErr } = await svc.rpc('frontier_concepts', {
      p_user_id: uid, p_grade: GRADE, p_limit: 5000,
    });
    if (fErr) fail('rpc frontier_concepts: ' + fErr.message);
    const slugs = new Set((frontier ?? []).map((r: { slug: string }) => r.slug));
    console.log(`frontiera: ${slugs.size} concepte`);

    // ASSERT 1: X apare
    if (!slugs.has(X)) fail(`${X} trebuia să fie în frontieră (toate prerechizitele ≥0.6)`);
    // ASSERT 2: Y nu apare
    if (slugs.has(Y)) fail(`${Y} NU trebuia să fie în frontieră (are prerechizit cu mastery 0.2)`);
    // ASSERT 3: Z nu apare
    if (slugs.has(Z)) fail(`${Z} NU trebuia să fie în frontieră (mastery 0.7)`);
    // ASSERT 4: invariante pe toate rândurile
    for (const r of frontier ?? []) {
      if (!(r.mastery < 0.6)) fail(`rând cu mastery ≥0.6 în frontieră: ${r.slug} (${r.mastery})`);
      if (Number(r.prereq_total) !== Number(r.prereq_ok)) fail(`rând cu prerechizite nesatisfăcute: ${r.slug} (${r.prereq_ok}/${r.prereq_total})`);
      if (r.grade_level > GRADE) fail(`rând peste clasa elevului: ${r.slug} (g${r.grade_level})`);
    }
    // ASSERT 5 (ETAPA 64): ordonarea pune conceptele cu exerciții SERVIBILE înainte
    // (servable = verificat CAS ∪ sursă-oficială cu link strict-bijectiv)
    const arr = (frontier ?? []) as Array<{ slug: string; servable_exercises: number }>;
    const firstNoServable = arr.findIndex((r) => Number(r.servable_exercises) === 0);
    const lastServable = arr.map((r, i) => (Number(r.servable_exercises) > 0 ? i : -1)).reduce((a, b) => Math.max(a, b), -1);
    if (firstNoServable !== -1 && lastServable > firstNoServable)
      fail(`ordonare greșită: concept cu exerciții servibile după unul fără (idx ${lastServable} > ${firstNoServable})`);

    console.log('✅ TOATE aserțiunile au trecut: X în frontieră, Y blocat de prerechizit slab, Z exclus prin mastery, invariante + ordonare OK.');
  } finally {
    await svc.auth.admin.deleteUser(uid);
    console.log('user sintetic șters.');
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
