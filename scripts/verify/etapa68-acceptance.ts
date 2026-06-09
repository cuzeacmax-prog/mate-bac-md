/**
 * ETAPA 68 — ACCEPTANȚĂ: agregatele paginii /app/progres = exact DB-ul.
 *
 * Pe userul de audit: getProgressData (ACEEAȘI funcție folosită de pagină)
 * vs query-uri SQL independente — assert pe fiecare cifră. Exit 0 obligatoriu.
 *
 *   npx tsx --env-file=.env.local scripts/verify/etapa68-acceptance.ts
 */
import { createServiceClient } from '../../src/lib/supabase/service';
import { getProgressData, MASTERY_THRESHOLD } from '../../src/lib/progres/data';
import { chisinauToday, computeStreak } from '../../src/lib/daily/daily';

const EMAIL = 'etapa60-acceptance@test.local';
const GRADE = 12;

function fail(msg: string): never { console.error(`✗ EȘEC: ${msg}`); process.exit(1); }
function assertEq(label: string, got: number, want: number) {
  if (got !== want) fail(`${label}: pagina zice ${got}, DB-ul zice ${want}`);
  console.log(`  ✓ ${label} = ${got}`);
}

async function main() {
  const svc = createServiceClient();
  const { data: list } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const user = list?.users.find((u) => u.email === EMAIL);
  if (!user) fail('userul de audit lipsește');
  console.log(`user de audit: ${user.id}`);

  const data = await getProgressData(svc, user.id, GRADE);
  console.log(`\npagina: ${data.domains.length} domenii, ${data.totals.total} concepte pe hartă`);

  // ── verificări independente ───────────────────────────────────────────────
  // 1) totalul conceptelor pe hartă = membership × concepts(grade=12), deduplicat pe (module, concept)
  const { data: memb } = await svc
    .from('concept_family_membership')
    .select('module, concept_id, concepts(id, grade_level)');
  const cells = new Set(
    (memb ?? [])
      .filter((r) => (r.concepts as unknown as { grade_level: number | null } | null)?.grade_level === GRADE)
      .map((r) => `${r.module}|${r.concept_id}`)
  );
  assertEq('concepte pe hartă (total)', data.totals.total, cells.size);

  // 2) stăpânite = mastery ≥ prag pe conceptele de pe hartă
  const { data: mast } = await svc
    .from('concept_mastery')
    .select('concept_id, mastery')
    .eq('user_id', user.id);
  const mastered = new Map((mast ?? []).map((m) => [m.concept_id as string, Number(m.mastery)]));
  let wantMastered = 0;
  let wantInProgress = 0;
  for (const cell of cells) {
    const cid = cell.split('|')[1];
    const m = mastered.get(cid);
    if (m === undefined) continue;
    if (m >= MASTERY_THRESHOLD) wantMastered++;
    else wantInProgress++;
  }
  assertEq('concepte stăpânite', data.totals.mastered, wantMastered);
  assertEq('concepte în lucru', data.totals.inProgress, wantInProgress);

  // 3) exerciții rezolvate = exercise_attempts ale userului
  const { count: attemptsCount } = await svc
    .from('exercise_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);
  assertEq('exerciții încercate', data.exercisesSolved, attemptsCount ?? 0);
  const { count: correctCount } = await svc
    .from('exercise_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_correct', true);
  assertEq('exerciții corecte', data.exercisesCorrect, correctCount ?? 0);

  // 4) streak identic cu sursa (ETAPA 14)
  const wantStreak = await computeStreak(svc, user.id, chisinauToday());
  assertEq('streak', data.streak, wantStreak);

  // 5) predicția: DOAR cu diagnostic terminat, ca interval
  const { data: diag } = await svc
    .from('diagnostic_sessions')
    .select('initial_bac_prediction')
    .eq('user_id', user.id)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (diag?.initial_bac_prediction != null) {
    if (!data.prediction) fail('diagnostic terminat dar pagina nu arată predicția');
    if (data.prediction.low >= data.prediction.high) fail('intervalul predicției e degenerat');
    console.log(`  ✓ predicția ca interval: ${data.prediction.low}–${data.prediction.high} (centru ${data.prediction.value})`);
  } else {
    if (data.prediction) fail('FĂRĂ diagnostic terminat dar pagina arată predicție');
    console.log('  ✓ fără diagnostic terminat → fără predicție (onest)');
  }

  // 6) ultimele activități ≤5, sortate desc
  if (data.recent.length > 5) fail(`recent are ${data.recent.length} > 5`);
  for (let i = 1; i < data.recent.length; i++) {
    if (data.recent[i - 1].at < data.recent[i].at) fail('activitățile nu sunt sortate desc');
  }
  console.log(`  ✓ ultimele activități: ${data.recent.length} (sortate desc)`);

  console.log('\n✅ ETAPA 68 acceptată: fiecare cifră de pe pagină = DB-ul, predicția doar ca interval cu diagnostic.');
}
main().catch((e) => { console.error(e); process.exit(1); });
