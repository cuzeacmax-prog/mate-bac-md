/**
 * ETAPA 14 — TEST DE ACCEPTARE: daily challenge determinist + streak.
 *
 * Pe userul de audit (etapa60-acceptance@test.local), cu zile SINTETICE:
 *  1. Daily-ul pe ziua D1 are 1–3 exerciții SERVIBILE de pe frontieră;
 *     recitirea în aceeași zi întoarce EXACT aceleași exerciții.
 *  2. Completarea daily-ului pe D1 și D2 (consecutive) → streak = 2.
 *  3. D3 sărită, completare pe D4 → streak = 1 (seria s-a rupt).
 *  4. streak_log are exact rândurile zilelor completate (RLS user-owned).
 *
 *   npx tsx --env-file=.env.local scripts/verify/etapa14-acceptance.ts
 */
import { createServiceClient } from '../../src/lib/supabase/service';
import {
  getOrCreateDailyChallenge,
  recordDailyAttempt,
  computeStreak,
} from '../../src/lib/daily/daily';

const EMAIL = 'etapa60-acceptance@test.local';
const D1 = '2026-06-01';
const D2 = '2026-06-02';
const D4 = '2026-06-04'; // D3 (2026-06-03) e sărită deliberat

function fail(msg: string): never {
  console.error(`✗ EȘEC: ${msg}`);
  process.exit(1);
}

async function completeDay(
  svc: ReturnType<typeof createServiceClient>,
  uid: string,
  date: string
): Promise<void> {
  const daily = await getOrCreateDailyChallenge(svc, uid, 12, date);
  if (!daily) fail(`daily-ul pe ${date} nu s-a putut construi (frontieră fără conținut servibil?)`);
  if (daily.exercises.length < 1 || daily.exercises.length > 3) {
    fail(`daily-ul pe ${date} are ${daily.exercises.length} exerciții (așteptat 1–3)`);
  }
  console.log(`  ${date}: ${daily.exercises.length} exerciții — ${daily.exercises.map((e) => `${e.concept_slug}(${e.tier}${e.has_figure ? ',figură' : ''})`).join(', ')}`);
  let lastCompleted = false;
  for (const ex of daily.exercises) {
    const state = await recordDailyAttempt(svc, uid, date, ex.exercise_id, true);
    if (!state) fail(`recordDailyAttempt a eșuat pe ${date}/${ex.exercise_id}`);
    lastCompleted = state.completed;
  }
  if (!lastCompleted) fail(`daily-ul pe ${date} nu s-a marcat completat după toate încercările`);
}

async function main() {
  const svc = createServiceClient();
  const { data: list } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const user = list?.users.find((u) => u.email === EMAIL);
  if (!user) fail(`userul de audit ${EMAIL} nu există — rulează întâi etapa60-acceptance`);
  const uid = user.id;
  console.log(`user de audit: ${uid}`);

  // repetabilitate: curăță daily + streak ale scriptului
  await svc.from('daily_challenges').delete().eq('user_id', uid);
  await svc.from('streak_log').delete().eq('user_id', uid);

  // ── 1) determinismul zilei: recitirea întoarce aceleași exerciții ──────────
  const a = await getOrCreateDailyChallenge(svc, uid, 12, D1);
  const b = await getOrCreateDailyChallenge(svc, uid, 12, D1);
  if (!a || !b) fail('daily-ul D1 nu s-a construit');
  const idsA = a.exercises.map((e) => e.exercise_id).join(',');
  const idsB = b.exercises.map((e) => e.exercise_id).join(',');
  if (idsA !== idsB) fail(`aceeași zi a întors exerciții diferite:\n  ${idsA}\n  ${idsB}`);
  console.log(`\n[1] determinism D1 ✓ — aceleași ${a.exercises.length} exerciții la recitire`);

  // toate exercițiile alese trebuie să fie servibile
  const ids = a.exercises.map((e) => e.exercise_id);
  const { data: servable } = await svc.from('exercise_servable').select('exercise_id').in('exercise_id', ids);
  if ((servable?.length ?? 0) !== ids.length) {
    fail(`doar ${servable?.length}/${ids.length} exerciții din daily sunt servibile`);
  }
  console.log('    toate exercițiile din daily sunt SERVIBILE ✓');

  // ── 2) două zile consecutive → streak = 2 ─────────────────────────────────
  console.log('\n[2] completare zile consecutive:');
  await completeDay(svc, uid, D1);
  const s1 = await computeStreak(svc, uid, D1);
  if (s1 !== 1) fail(`streak după D1 = ${s1}, așteptat 1`);
  await completeDay(svc, uid, D2);
  const s2 = await computeStreak(svc, uid, D2);
  if (s2 !== 2) fail(`streak după D2 = ${s2}, așteptat 2`);
  console.log(`    streak(D1)=1 ✓, streak(D2)=2 ✓`);

  // ── 3) o zi sărită → streak = 1 ───────────────────────────────────────────
  console.log('\n[3] D3 sărită, completare D4:');
  await completeDay(svc, uid, D4);
  const s4 = await computeStreak(svc, uid, D4);
  if (s4 !== 1) fail(`streak după D4 (cu D3 sărită) = ${s4}, așteptat 1`);
  console.log(`    streak(D4)=1 ✓ — seria s-a rupt corect`);

  // ── 4) rândurile streak_log ──────────────────────────────────────────────
  const { data: rows } = await svc
    .from('streak_log')
    .select('activity_date, exercises_count')
    .eq('user_id', uid)
    .order('activity_date');
  const dates = (rows ?? []).map((r) => r.activity_date as string);
  console.log(`\n── streak_log: ${dates.join(', ')} ──`);
  if (dates.join(',') !== [D1, D2, D4].join(',')) {
    fail(`streak_log are zilele greșite: ${dates.join(',')} (așteptat ${[D1, D2, D4].join(',')})`);
  }

  console.log('\n✅ ETAPA 14 acceptată: daily determinist + servibil, streak 2 pe zile consecutive, rupt la zi sărită, streak_log corect.');
}
main().catch((e) => { console.error(e); process.exit(1); });
