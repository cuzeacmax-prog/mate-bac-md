/**
 * ETAPA 69 — ACCEPTANȚĂ: simularea BAC cap-coadă pe userul de audit.
 *
 *  1. Auditul pool-ului dictează structura (gaps marcate, ex. Modulul VIII).
 *  2. createExamAttempt → attempt persistat (mock_bac_attempts), set determinist.
 *  3. Răspunsuri MIXTE (oficiale = corecte; '999999' = greșite) → submit →
 *     scor exact (assert), punctaj pe module, mastery actualizat (source exam).
 *  4. Expirarea FORȚATĂ: started_at mutat cu 3h în urmă → submit respins,
 *     attempt închis cu expired:true.
 *
 *   npx tsx --env-file=.env.local scripts/verify/etapa69-acceptance.ts
 */
import { createServiceClient } from '../../src/lib/supabase/service';
import { auditExamPool, createExamAttempt, submitExamAttempt } from '../../src/lib/simulare/exam';

const EMAIL = 'etapa60-acceptance@test.local';

function fail(msg: string): never { console.error(`✗ EȘEC: ${msg}`); process.exit(1); }

async function main() {
  const svc = createServiceClient();
  const { data: list } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const user = list?.users.find((u) => u.email === EMAIL);
  if (!user) fail('userul de audit lipsește');
  console.log(`user de audit: ${user.id}`);

  // ── 1) auditul pool-ului ──────────────────────────────────────────────────
  const audit = await auditExamPool(svc);
  console.log('\n── structura dictată de pool ──');
  for (const m of audit.perModule) console.log(`  ${m.module}: disponibile=${m.available}, cotă=${m.quota}, alese=${m.pick}`);
  console.log(`  GAPS (marcate, nu fabricate): ${audit.gaps.join(', ') || '(niciunul)'}`);
  if (!audit.gaps.includes('Modulul VIII')) fail('Modulul VIII trebuia marcat ca gol');
  const planned = audit.perModule.reduce((s, m) => s + m.pick, 0);
  if (planned < 6) fail(`prea puține exerciții posibile: ${planned}`);

  // ── 2) attempt persistat ──────────────────────────────────────────────────
  const attempt = await createExamAttempt(svc, user.id, 12);
  console.log(`\nattempt: ${attempt.id}, ${attempt.items.length} exerciții, started_at=${attempt.started_at}`);
  if (attempt.items.length !== planned) fail(`items=${attempt.items.length} ≠ planificat=${planned}`);
  const { data: row } = await svc.from('mock_bac_attempts').select('id, is_completed').eq('id', attempt.id).single();
  if (!row || row.is_completed) fail('attempt-ul nu e persistat deschis');

  // ── 3) răspunsuri mixte → scor exact + mastery ───────────────────────────
  // răspunsurile oficiale, direct din linkurile stricte
  const ids = attempt.items.map((i) => i.exercise_id);
  const { data: links } = await svc
    .from('exercise_answer_link')
    .select('exercise_id, exercise_answers(answer_text)')
    .in('exercise_id', ids)
    .eq('match_confidence', 'strict-bijectiv');
  const official = new Map(
    (links ?? []).map((l) => {
      const a = l.exercise_answers as unknown as { answer_text: string } | { answer_text: string }[] | null;
      const row = Array.isArray(a) ? a[0] : a;
      return [l.exercise_id as string, row?.answer_text ?? ''];
    })
  );
  const answers: Record<string, string> = {};
  let correctGiven = 0;
  attempt.items.forEach((item, i) => {
    if (i % 2 === 0) { answers[item.exercise_id] = official.get(item.exercise_id) ?? '1'; correctGiven++; }
    else answers[item.exercise_id] = '999999';
  });
  console.log(`răspund: ${correctGiven} cu răspunsul oficial, ${attempt.items.length - correctGiven} greșit deliberat`);

  // mastery înainte pe TOATE conceptele itemilor — assertul pe source='exam'
  // nu mai poate fi sărit tăcut (ETAPA 70 FAZA 0b)
  const conceptSlugs = [...new Set(attempt.items.map((i) => i.concept_slug).filter((s): s is string => !!s))];
  if (conceptSlugs.length === 0) fail('niciun item nu are concept legat — evidența exam nu ar avea unde să se scrie');
  console.log(`concepte legate de itemii simulării: ${conceptSlugs.length} (${conceptSlugs.join(', ')})`);
  const masteryOf = async (slug: string) => {
    const { data: c } = await svc.from('concepts').select('id').eq('slug', slug).single();
    const { data: m } = await svc.from('concept_mastery').select('mastery, source').eq('user_id', user.id).eq('concept_id', c!.id).maybeSingle();
    return { mastery: (m?.mastery as number | undefined) ?? 0, source: (m?.source as string[] | undefined) ?? [] };
  };
  const firstConcept = attempt.items[0].concept_slug;
  const before = firstConcept ? await masteryOf(firstConcept) : null;

  const result = await submitExamAttempt(svc, user.id, attempt.id, answers);
  console.log(`\nrezultat: ${result.correct}/${result.total} corecte, ${result.unevaluated} fără verdict, expirat=${result.expired}`);
  for (const m of result.perModule) console.log(`  ${m.module}: ${m.correct}/${m.total}`);
  if (result.expired) fail('attempt-ul a expirat deși tocmai a început');
  if (result.total !== attempt.items.length) fail('total greșit');
  if (result.correct !== correctGiven) fail(`scor: ${result.correct} ≠ ${correctGiven} (răspunsurile oficiale trebuiau să fie corecte)`);
  if (!result.grade) fail('fără notă estimată');
  console.log(`  notă estimată: ${result.grade.low}–${result.grade.high} (acoperă ${result.grade.coveredModules.length} module)`);

  if (firstConcept && before) {
    const after = await masteryOf(firstConcept);
    console.log(`  mastery '${firstConcept}': ${before.mastery.toFixed(4)} → ${after.mastery.toFixed(4)}; surse=${after.source.join(',')}`);
    if (after.mastery <= before.mastery && before.mastery < 1) fail('mastery nu a crescut după răspuns corect la examen');
  }
  // TOATE conceptele itemilor evaluați trebuie să poarte sursa 'exam' —
  // itemii primesc evidență și la corect și la greșit (target 1/0)
  for (const slug of conceptSlugs) {
    const after = await masteryOf(slug);
    if (!after.source.includes('exam')) fail(`sursa 'exam' lipsește din concept_mastery pentru '${slug}' (surse: ${after.source.join(',') || 'niciuna'})`);
  }
  console.log(`  source='exam' prezent pe toate cele ${conceptSlugs.length} concepte ✓`);

  // attempt-ul finalizat persistat
  const { data: closed } = await svc.from('mock_bac_attempts').select('is_completed, total_score').eq('id', attempt.id).single();
  if (!closed?.is_completed || Number(closed.total_score) !== result.correct) fail('attempt-ul finalizat nu e persistat corect');

  // ── 4) expirarea forțată ──────────────────────────────────────────────────
  const att2 = await createExamAttempt(svc, user.id, 12);
  await svc.from('mock_bac_attempts')
    .update({ started_at: new Date(Date.now() - 3 * 3600_000).toISOString() })
    .eq('id', att2.id);
  const expiredResult = await submitExamAttempt(svc, user.id, att2.id, { [att2.items[0].exercise_id]: '5' });
  if (!expiredResult.expired) fail('submit-ul după deadline NU a fost respins');
  const { data: closed2 } = await svc.from('mock_bac_attempts').select('is_completed, detailed_feedback').eq('id', att2.id).single();
  const fb = closed2?.detailed_feedback as { expired?: boolean } | null;
  if (!closed2?.is_completed || !fb?.expired) fail('attempt-ul expirat nu e închis cu expired:true');
  console.log('\nexpirarea forțată: submit respins, attempt închis cu expired:true ✓');

  console.log('\n✅ ETAPA 69 acceptată: structura din pool cu gaps marcate, scor exact, mastery+source=exam, expirare server-side.');
}
main().catch((e) => { console.error(e); process.exit(1); });
