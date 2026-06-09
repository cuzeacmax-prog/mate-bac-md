/**
 * ETAPA 63 — TEST DE ACCEPTARE: evaluarea răspunsurilor mișcă concept_mastery.
 *
 * Pe userul de audit existent (etapa60-acceptance@test.local) simulează 3 încercări
 * prin ACELAȘI cod ca /api/chat (lib/evaluare/evaluate + lib/mastery/evidence):
 *  1. corectă-determinist  (exercițiu cu link 'strict-bijectiv', răspuns mono-parte)
 *  2. greșită-determinist  (același mecanism, răspuns deliberat greșit)
 *  3. evaluată-de-judecător (exercițiu FĂRĂ link strict → Haiku, task judge_answer)
 *
 * Pentru fiecare: rândul concept_mastery ÎNAINTE/DUPĂ cu EMA exactă
 * (mastery_nou = mastery_vechi + 0.3·(țintă − mastery_vechi)), verificată la 1e-9.
 * Regula judecătorului: mastery se mișcă DOAR dacă verdictul are confidence ≥ 0.8.
 *
 *   npx tsx --env-file=.env.local scripts/verify/etapa63-acceptance.ts
 */
import { randomUUID } from 'node:crypto';
import { createServiceClient } from '../../src/lib/supabase/service';
import { recordConceptEvidence, MASTERY_ALPHA } from '../../src/lib/mastery/evidence';
import { evaluateAttempt, getOfficialAnswer } from '../../src/lib/evaluare/evaluate';
import { compareAnswers, normalizeMathExpression } from '../../src/lib/evaluare/compare';

const EMAIL = 'etapa60-acceptance@test.local';
const EPS = 1e-9;

interface Ex { id: string; statement: string }

function fail(msg: string): never {
  console.error(`✗ EȘEC: ${msg}`);
  process.exit(1);
}

async function masteryFor(svc: ReturnType<typeof createServiceClient>, uid: string, conceptId: string) {
  const { data } = await svc
    .from('concept_mastery')
    .select('mastery, evidence_count')
    .eq('user_id', uid)
    .eq('concept_id', conceptId)
    .maybeSingle();
  return {
    mastery: (data?.mastery as number | undefined) ?? 0,
    evidence: (data?.evidence_count as number | undefined) ?? 0,
    exists: !!data,
  };
}

/** un concept (id+slug) legat de exercițiu prin exercise_concept_link */
async function conceptOf(svc: ReturnType<typeof createServiceClient>, exerciseId: string) {
  const { data } = await svc
    .from('exercise_concept_link')
    .select('concept_id, concepts(slug)')
    .eq('exercise_id', exerciseId)
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const slug = (data.concepts as unknown as { slug: string } | null)?.slug;
  return slug ? { id: data.concept_id as string, slug } : null;
}

async function main() {
  const svc = createServiceClient();

  // userul de audit existent
  const { data: list } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const user = list?.users.find((u) => u.email === EMAIL);
  if (!user) fail(`userul de audit ${EMAIL} nu există — rulează întâi etapa60-acceptance`);
  const uid = user.id;
  console.log(`user de audit: ${uid}`);

  // ── alege un exercițiu DETERMINIST: link strict-bijectiv + răspuns mono-parte numeric ──
  const { data: strictLinks } = await svc
    .from('exercise_answer_link')
    .select('exercise_id, exercise_answers(answer_text), exercise_raw(id, statement)')
    .eq('match_confidence', 'strict-bijectiv')
    .limit(50);
  let detEx: Ex | null = null;
  let detOfficial = '';
  let detValue: string | null = null;
  for (const l of strictLinks ?? []) {
    const ans = (l.exercise_answers as unknown as { answer_text: string } | null)?.answer_text ?? '';
    const er = l.exercise_raw as unknown as { id: string; statement: string } | null;
    if (!er || /(^|[^a-zăâîșț])[a-e]\)\s/i.test(ans)) continue; // sare multi-parte
    // candidat de răspuns "al elevului" în formă diferită: valoarea normalizată
    const norm = normalizeMathExpression(ans);
    const verdict = compareAnswers(ans, norm);
    if (verdict.comparable && verdict.correct) {
      detEx = { id: er.id, statement: er.statement };
      detOfficial = ans;
      detValue = norm;
      break;
    }
  }
  if (!detEx || !detValue) fail('niciun exercițiu strict-bijectiv comparabil determinist găsit');
  const detConcept = await conceptOf(svc, detEx.id);
  if (!detConcept) fail(`exercițiul determinist ${detEx.id} nu are concept legat`);
  console.log(`\nexercițiu determinist: ${detEx.id}`);
  console.log(`  enunț: ${detEx.statement.slice(0, 90)}…`);
  console.log(`  răspuns oficial: ${detOfficial.slice(0, 60)}`);
  console.log(`  concept: ${detConcept.slug}`);

  // curăță încercările vechi ale scriptului (repetabilitate)
  await svc.from('exercise_attempts').delete().eq('user_id', uid).eq('session_type', 'chat_ancorat');

  // ════ 1) CORECTĂ-DETERMINIST ═══════════════════════════════════════════
  const conv1 = randomUUID();
  const before1 = await masteryFor(svc, uid, detConcept.id);
  const ev1 = await evaluateAttempt(svc, {
    userId: uid, conversationId: conv1,
    message: detValue,
    exercise: detEx,
  });
  if (!ev1) fail('încercarea 1 nu a fost detectată ca răspuns');
  if (ev1.method !== 'determinist') fail(`încercarea 1: method=${ev1.method}, așteptat determinist`);
  if (ev1.correct !== true) fail(`încercarea 1: correct=${ev1.correct}, așteptat true`);
  await recordConceptEvidence(svc, uid, [detConcept.slug], ev1.correct, 'chat');
  const after1 = await masteryFor(svc, uid, detConcept.id);
  const expected1 = before1.mastery + MASTERY_ALPHA * (1 - before1.mastery);
  console.log(`\n[1] CORECTĂ-DETERMINIST (răspuns elev: "${detValue}")`);
  console.log(`    mastery ÎNAINTE=${before1.mastery.toFixed(6)} → DUPĂ=${after1.mastery.toFixed(6)} (așteptat EMA=${expected1.toFixed(6)})`);
  console.log(`    evidence_count ${before1.evidence} → ${after1.evidence}`);
  if (Math.abs(after1.mastery - expected1) > EPS) fail('EMA încercarea 1 nu corespunde formulei');
  if (after1.evidence !== before1.evidence + 1) fail('evidence_count 1 nu a crescut cu 1');

  // ════ 2) GREȘITĂ-DETERMINIST ═══════════════════════════════════════════
  const conv2 = randomUUID();
  const before2 = await masteryFor(svc, uid, detConcept.id);
  const ev2 = await evaluateAttempt(svc, {
    userId: uid, conversationId: conv2,
    message: '99999',
    exercise: detEx,
  });
  if (!ev2) fail('încercarea 2 nu a fost detectată ca răspuns');
  if (ev2.method !== 'determinist') fail(`încercarea 2: method=${ev2.method}, așteptat determinist`);
  if (ev2.correct !== false) fail(`încercarea 2: correct=${ev2.correct}, așteptat false`);
  await recordConceptEvidence(svc, uid, [detConcept.slug], ev2.correct, 'chat');
  const after2 = await masteryFor(svc, uid, detConcept.id);
  const expected2 = before2.mastery + MASTERY_ALPHA * (0 - before2.mastery);
  console.log(`\n[2] GREȘITĂ-DETERMINIST (răspuns elev: "99999")`);
  console.log(`    mastery ÎNAINTE=${before2.mastery.toFixed(6)} → DUPĂ=${after2.mastery.toFixed(6)} (așteptat EMA=${expected2.toFixed(6)})`);
  console.log(`    evidence_count ${before2.evidence} → ${after2.evidence}`);
  if (Math.abs(after2.mastery - expected2) > EPS) fail('EMA încercarea 2 nu corespunde formulei');

  // ════ 3) EVALUATĂ-DE-JUDECĂTOR (exercițiu FĂRĂ link strict) ═════════════
  // alege un exercițiu verificat fără răspuns oficial neambiguu
  const { data: anyEx } = await svc
    .from('exercise_verification')
    .select('exercise_id, exercise_raw(id, statement)')
    .eq('verified', true)
    .limit(50);
  let judEx: Ex | null = null;
  let judConcept: { id: string; slug: string } | null = null;
  for (const v of anyEx ?? []) {
    const er = v.exercise_raw as unknown as { id: string; statement: string } | null;
    if (!er) continue;
    if (await getOfficialAnswer(svc, er.id)) continue; // vrem Nivel B pur
    const c = await conceptOf(svc, er.id);
    if (c) { judEx = { id: er.id, statement: er.statement }; judConcept = c; break; }
  }
  if (!judEx || !judConcept) fail('niciun exercițiu verificat fără link strict + cu concept găsit');
  console.log(`\nexercițiu judecător: ${judEx.id}`);
  console.log(`  enunț: ${judEx.statement.slice(0, 90)}…`);
  console.log(`  concept: ${judConcept.slug}`);

  const conv3 = randomUUID();
  const before3 = await masteryFor(svc, uid, judConcept.id);
  const ev3 = await evaluateAttempt(svc, {
    userId: uid, conversationId: conv3,
    message: 'răspunsul meu este 12345',
    exercise: judEx,
  });
  if (!ev3) fail('încercarea 3: judecătorul nu a întors verdict (verifică ANTHROPIC_API_KEY)');
  if (ev3.method !== 'judecator') fail(`încercarea 3: method=${ev3.method}, așteptat judecator`);
  console.log(`\n[3] JUDECĂTOR (răspuns elev: "12345"): correct=${ev3.correct} confidence=${ev3.confidence.toFixed(2)} motiv="${ev3.motiv}"`);
  await recordConceptEvidence(svc, uid, [judConcept.slug], ev3.correct, 'chat');
  const after3 = await masteryFor(svc, uid, judConcept.id);
  if (ev3.correct === null) {
    // confidence < 0.8 → mastery NEatins, doar expunere
    if (Math.abs(after3.mastery - before3.mastery) > EPS) fail('mastery s-a mișcat deși verdictul e sub prag');
    console.log(`    mastery NEatins (confidence sub prag): ${before3.mastery.toFixed(6)} → ${after3.mastery.toFixed(6)}; evidence ${before3.evidence} → ${after3.evidence}`);
  } else {
    const target = ev3.correct ? 1 : 0;
    const expected3 = before3.mastery + MASTERY_ALPHA * (target - before3.mastery);
    console.log(`    mastery ÎNAINTE=${before3.mastery.toFixed(6)} → DUPĂ=${after3.mastery.toFixed(6)} (așteptat EMA=${expected3.toFixed(6)})`);
    if (Math.abs(after3.mastery - expected3) > EPS) fail('EMA încercarea 3 nu corespunde formulei');
  }
  if (after3.evidence !== before3.evidence + 1) fail('evidence_count 3 nu a crescut cu 1');

  // încercările persistate (audit)
  const { data: attempts } = await svc
    .from('exercise_attempts')
    .select('exercise_id, is_correct, user_answer, session_type, metadata')
    .eq('user_id', uid)
    .eq('session_type', 'chat_ancorat')
    .order('attempted_at', { ascending: true });
  console.log(`\n── exercise_attempts persistate: ${attempts?.length ?? 0} ──`);
  for (const a of attempts ?? []) {
    const meta = a.metadata as { method?: string; confidence?: number };
    console.log(`  ${a.exercise_id} corect=${a.is_correct} metoda=${meta.method} conf=${meta.confidence} răspuns="${a.user_answer}"`);
  }
  if ((attempts?.length ?? 0) !== 3) fail(`așteptat 3 încercări persistate, găsite ${attempts?.length}`);

  console.log('\n✅ ETAPA 63 acceptată: determinist corect/greșit + judecător, EMA exactă, prag confidence respectat, încercări persistate.');
}
main().catch((e) => { console.error(e); process.exit(1); });
