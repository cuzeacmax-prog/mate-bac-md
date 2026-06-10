/**
 * ETAPA 71 FAZA B — ACCEPTANȚĂ: harta cunoașterii.
 *
 *  1. Stările nodurilor din getKnowledgeMap = EXACT cele derivate independent
 *     din concept_mastery + frontier_concepts prin regula documentată
 *     (recalculată AICI literal, nu importată — altfel testul ar fi circular).
 *     Assert pe ≥20 noduri; toate cele 4 stări prezente.
 *  2. Lentila „test mâine": user_focus activ → daily-ul (dată sintetică) se
 *     construiește DOAR din conceptele focusului (assert).
 *
 *   npx tsx --env-file=.env.local scripts/verify/etapa71-map-acceptance.ts
 */
import { createServiceClient } from '../../src/lib/supabase/service';
import { getKnowledgeMap } from '../../src/lib/map/state';
import { getOrCreateDailyChallenge } from '../../src/lib/daily/daily';

const EMAIL = 'etapa60-acceptance@test.local';
const MASTERY_THRESHOLD = 0.6; // regula literală (ETAPA 68), nu importată

function fail(msg: string): never { console.error(`✗ EȘEC: ${msg}`); process.exit(1); }

async function main() {
  const svc = createServiceClient();
  const { data: list } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const user = list?.users.find((u) => u.email === EMAIL);
  if (!user) fail('userul de audit lipsește');
  console.log(`user de audit: ${user.id}`);

  // precondiție pentru „toate cele 4 stări": un concept de pe hartă stăpânit.
  // (userul de audit e resetat des de alte scripturi — upsert determinist)
  const { data: pir } = await svc.from('concepts').select('id').eq('slug', 'g12-tetraedru').single();
  if (!pir) fail('conceptul-ancoră lipsește');
  await svc.from('concept_mastery').upsert(
    {
      user_id: user.id,
      concept_id: pir.id,
      mastery: 0.85,
      evidence_count: 3,
      last_evidence_at: new Date().toISOString(),
      source: ['diagnostic'],
    },
    { onConflict: 'user_id,concept_id' }
  );

  // ── 1) stările hărții vs derivarea independentă ───────────────────────────
  const map = await getKnowledgeMap(svc, user.id, 12);
  const allNodes = map.domains.flatMap((d) => d.nodes);
  console.log(`domenii: ${map.domains.length}, noduri totale: ${allNodes.length}`);
  if (allNodes.length < 20) fail('sub 20 de noduri pe hartă');

  const { data: masteryRows } = await svc
    .from('concept_mastery').select('concept_id, mastery').eq('user_id', user.id);
  const masteryById = new Map((masteryRows ?? []).map((m) => [m.concept_id as string, Number(m.mastery)]));
  const { data: frontier } = await svc.rpc('frontier_concepts', { p_user_id: user.id, p_grade: 12, p_limit: 500 });
  const frontierIds = new Set(((frontier ?? []) as Array<{ concept_id: string }>).map((r) => r.concept_id));

  let checked = 0;
  const seenStates = new Set<string>();
  for (const n of allNodes) {
    const m = masteryById.get(n.id) ?? 0;
    const expected =
      m >= MASTERY_THRESHOLD ? 'stapanit'
      : m > 0 ? 'in-lucru'
      : frontierIds.has(n.id) ? 'disponibil'
      : 'blocat';
    if (n.status !== expected) {
      fail(`starea diferă pentru ${n.slug}: hartă=${n.status}, derivat=${expected} (mastery=${m}, frontieră=${frontierIds.has(n.id)})`);
    }
    checked++;
    seenStates.add(n.status);
  }
  console.log(`✓ ${checked} noduri verificate, stările identice cu derivarea independentă`);
  for (const s of ['blocat', 'disponibil', 'in-lucru', 'stapanit']) {
    if (!seenStates.has(s)) fail(`starea '${s}' lipsește din test`);
  }
  const perDomain = map.domains.map((d) =>
    `${d.module}: ${d.nodes.length} (b=${d.counts.blocat}, d=${d.counts.disponibil}, l=${d.counts['in-lucru']}, s=${d.counts.stapanit})`
  );
  for (const line of perDomain) console.log(`  ${line}`);
  console.log('✓ toate cele 4 stări prezente');

  // ── 2) lentila „test mâine" filtrează daily-ul ────────────────────────────
  // focus = conceptele servibile de pe frontieră din Modulul V (piramide)
  const domV = map.domains.find((d) => d.module === 'Modulul V');
  if (!domV) fail('Modulul V lipsește de pe hartă');
  const focusConcepts = domV.nodes.filter((n) => n.servable > 0);
  if (focusConcepts.length === 0) fail('Modulul V nu are concepte servibile');
  await svc.from('user_focus').upsert(
    {
      user_id: user.id,
      concept_ids: focusConcepts.map((n) => n.id),
      label: 'Poliedre (acceptanță)',
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
    },
    { onConflict: 'user_id' }
  );
  const testDate = '2026-07-01'; // dată sintetică — nu atinge daily-ul real
  await svc.from('daily_challenges').delete().eq('user_id', user.id).eq('challenge_date', testDate);
  const daily = await getOrCreateDailyChallenge(svc, user.id, 12, testDate);
  if (!daily || daily.exercises.length === 0) fail('daily-ul cu focus nu s-a construit');
  const focusSlugs = new Set(focusConcepts.map((n) => n.slug));
  for (const ex of daily.exercises) {
    if (!focusSlugs.has(ex.concept_slug)) {
      fail(`daily-ul conține concept din afara focusului: ${ex.concept_slug}`);
    }
  }
  console.log(`✓ daily cu focus (${testDate}): ${daily.exercises.length} exerciții, toate din focus (${daily.exercises.map((e) => e.concept_slug).join(', ')})`);

  // fără focus → daily-ul aceleași zile ar fi putut alege și din alte module
  await svc.from('user_focus').delete().eq('user_id', user.id);
  console.log('✓ focus curățat după test');

  console.log('\n✅ ETAPA 71 FAZA B acceptată: stările hărții = derivarea din mastery (toate 4 prezente), lentila test-mâine filtrează daily-ul.');
}
main().catch((e) => { console.error(e); process.exit(1); });
