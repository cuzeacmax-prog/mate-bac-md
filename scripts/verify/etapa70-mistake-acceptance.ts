/**
 * ETAPA 70 FAZA C — ACCEPTANȚĂ: mașina de stări la greșeală.
 *
 * Pe userul de audit, cu o lecție sintetică persistată (concept REAL cu pool
 * servibil), secvența greșit → greșit → similar-corect produce EXACT:
 *   greșeala 1: EMA scade (α=0.3 spre 0), răspunsul are indiciu, FĂRĂ corecta;
 *   greșeala 2: EMA scade iar; corecta + micro-recap + rezolvare + SIMILAR;
 *   răscumpărarea corectă (răspuns oficial, determinist): EMA urcă PLIN.
 * Bonus FAZA D (jumătatea): corect după indiciu pe quiz-ul 2 → pas EMA ×0.5.
 *
 *   npx tsx --env-file=.env.local scripts/verify/etapa70-mistake-acceptance.ts
 */
import { createServiceClient } from '../../src/lib/supabase/service';
import { processQuizAnswer, processRedemption, getSimilarExercise } from '../../src/lib/lesson/mistake';
import { MASTERY_ALPHA } from '../../src/lib/mastery/evidence';

const EMAIL = 'etapa60-acceptance@test.local';
const CONCEPT = 'g12-piramida';

function fail(msg: string): never { console.error(`✗ EȘEC: ${msg}`); process.exit(1); }
const fx = (v: number) => v.toFixed(6);

async function main() {
  const svc = createServiceClient();
  const { data: list } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const user = list?.users.find((u) => u.email === EMAIL);
  if (!user) fail('userul de audit lipsește');
  console.log(`user de audit: ${user.id}`);

  const { data: conceptRow } = await svc.from('concepts').select('id').eq('slug', CONCEPT).single();
  if (!conceptRow) fail(`conceptul ${CONCEPT} lipsește`);
  const masteryOf = async (): Promise<number> => {
    const { data } = await svc
      .from('concept_mastery').select('mastery')
      .eq('user_id', user.id).eq('concept_id', conceptRow.id).maybeSingle();
    return (data?.mastery as number | undefined) ?? 0;
  };

  // ── lecția sintetică persistată (aceeași formă ca /api/lesson/start) ──────
  const lessonBlocks = [
    { tip: 'intro', titlu: 'Piramida', ideea_mare: 'Corpul cu vârf și bază poligonală.' },
    { tip: 'step', titlu_scurt: 'Volumul', corp: 'Volumul piramidei este o treime din produsul ariei bazei cu înălțimea.', formula: 'V = \\frac{A_b \\cdot h}{3}' },
    {
      tip: 'quiz', intrebare: 'Cum se calculează volumul piramidei?',
      optiuni: { a: '$A_b \\cdot h$', b: '$A_b \\cdot h / 3$', c: '$A_b \\cdot h / 2$', d: '$2 A_b h$' },
      corecta: 'b',
      indiciu: 'Piramida ocupă a treia parte din prisma cu aceeași bază și înălțime.',
      rezolvare: ['Aria bazei se înmulțește cu înălțimea.', 'Produsul se împarte la 3.'],
    },
    {
      tip: 'quiz', intrebare: 'Înălțimea piramidei cade în…',
      optiuni: { a: 'centrul bazei (la piramida regulată)', b: 'orice vârf', c: 'mijlocul unei muchii', d: 'afara bazei mereu' },
      corecta: 'a',
      indiciu: 'La piramida regulată, piciorul înălțimii e centrul poligonului.',
      rezolvare: ['La piramida regulată, VO cade în centrul bazei.'],
    },
    { tip: 'recap', puncte: ['Volumul piramidei este a treia parte din prismă.'] },
  ];

  // similarul trebuie să aibă RĂSPUNS OFICIAL mono-parte (evaluare determinhoristă);
  // seed-ul depinde de messageId → reinserez până nimerește un astfel de exercițiu
  let messageId = '';
  let convId = '';
  let official = '';
  let similarId = '';
  const MULTIPART_RE = /(^|[^a-zăâîșț])[a-e]\)\s/i;
  for (let attempt = 0; attempt < 20; attempt++) {
    const { data: conv } = await svc.from('conversations')
      .insert({ user_id: user.id, title: `[audit 70C] Lecție: ${CONCEPT}` })
      .select('id').single();
    if (!conv) fail('conversation insert');
    const { data: saved } = await svc.from('messages')
      .insert({ conversation_id: conv.id, role: 'assistant', content: JSON.stringify({ lesson: true, concept: CONCEPT, blocks: lessonBlocks }) })
      .select('id').single();
    if (!saved) fail('message insert');

    const sim = await getSimilarExercise(svc, CONCEPT, `${saved.id}:q1`);
    if (sim) {
      const { data: link } = await svc.from('exercise_answer_link')
        .select('exercise_answers(answer_text)')
        .eq('exercise_id', sim.exercise_id).eq('match_confidence', 'strict-bijectiv').maybeSingle();
      const a = link?.exercise_answers as unknown as { answer_text: string } | { answer_text: string }[] | null;
      const row = Array.isArray(a) ? a[0] : a;
      if (row?.answer_text && !MULTIPART_RE.test(row.answer_text)) {
        messageId = saved.id as string;
        convId = conv.id as string;
        official = row.answer_text;
        similarId = sim.exercise_id;
        break;
      }
    }
    await svc.from('conversations').delete().eq('id', conv.id); // cascade pe messages
  }
  if (!messageId) fail('nu am găsit o lecție cu similar determinist evaluabil în 20 încercări');
  console.log(`lecție sintetică: message=${messageId} conv=${convId}`);
  console.log(`similar determinist: ${similarId} (răspuns oficial: ${official.slice(0, 40)}…)`);

  // ── 1) greșeala 1: indiciu, fără corecta, EMA scade exact ──────────────────
  const m0 = await masteryOf();
  const r1 = await processQuizAnswer(svc, user.id, messageId, 'q1', 'a');
  if (r1.status !== 200 || 'error' in r1.body) fail(`q1 greșit(1): ${JSON.stringify(r1.body)}`);
  const m1 = await masteryOf();
  const expect1 = m0 + MASTERY_ALPHA * (0 - m0);
  console.log(`\n[1] greșit(1): mastery ${fx(m0)} → ${fx(m1)} (așteptat ${fx(expect1)}), attempt=${r1.body.attempt}, masteryMoved=${r1.body.masteryMoved}`);
  if (fx(m1) !== fx(expect1)) fail('EMA la greșeala 1 nu e exactă');
  if (r1.body.attempt !== 1) fail('attempt ≠ 1');
  if (!r1.body.indiciu) fail('lipsește indiciul la greșeala 1');
  if (r1.body.corecta) fail('corecta a SCĂPAT la greșeala 1');
  if (r1.body.masteryMoved !== 'down') fail('masteryMoved ≠ down');
  console.log(`    indiciu: „${r1.body.indiciu}"`);

  // ── 2) greșeala 2: corecta + micro-recap + rezolvare + similar ─────────────
  const r2 = await processQuizAnswer(svc, user.id, messageId, 'q1', 'c');
  if (r2.status !== 200 || 'error' in r2.body) fail(`q1 greșit(2): ${JSON.stringify(r2.body)}`);
  const m2 = await masteryOf();
  const expect2 = m1 + MASTERY_ALPHA * (0 - m1);
  console.log(`[2] greșit(2): mastery ${fx(m1)} → ${fx(m2)} (așteptat ${fx(expect2)}), attempt=${r2.body.attempt}`);
  if (fx(m2) !== fx(expect2)) fail('EMA la greșeala 2 nu e exactă');
  if (r2.body.attempt !== 2) fail('attempt ≠ 2');
  if (r2.body.corecta !== 'b') fail('corecta lipsește/greșită la greșeala 2');
  if (!r2.body.microRecap || r2.body.microRecap.tip !== 'step') fail('micro-recap lipsește sau nu e ultimul step');
  if (!r2.body.rezolvare || r2.body.rezolvare.length < 1) fail('rezolvarea pas-cu-pas lipsește');
  if (!r2.body.similar) fail('similarul lipsește (conceptul ARE pool servibil)');
  if (r2.body.similar.exercise_id !== similarId) fail('similarul diferă de cel determinist');
  console.log(`    micro-recap: „${(r2.body.microRecap as { titlu_scurt: string }).titlu_scurt}", rezolvare: ${r2.body.rezolvare.length} pași, similar: ${r2.body.similar.exercise_id}`);

  // ── 3) răscumpărarea: similar-corect → EMA urcă PLIN exact ─────────────────
  const r3 = await processRedemption(svc, user.id, messageId, 'q1', similarId, official);
  if (r3.status !== 200 || 'error' in r3.body) fail(`redeem: ${JSON.stringify(r3.body)}`);
  const m3 = await masteryOf();
  const expect3 = m2 + MASTERY_ALPHA * (1 - m2);
  console.log(`[3] similar-corect: mastery ${fx(m2)} → ${fx(m3)} (așteptat ${fx(expect3)}), masteryMoved=${r3.body.masteryMoved}`);
  if (r3.body.correct !== true) fail(`răscumpărarea cu răspunsul oficial nu e corectă: ${JSON.stringify(r3.body)}`);
  if (fx(m3) !== fx(expect3)) fail('EMA la răscumpărare nu e exactă (trebuia pas PLIN)');
  if (r3.body.masteryMoved !== 'up-full') fail('masteryMoved ≠ up-full');

  // ── 4) FAZA D (bonus aici): corect DUPĂ indiciu → pas EMA înjumătățit ──────
  const r4a = await processQuizAnswer(svc, user.id, messageId, 'q2', 'b');
  if (r4a.status !== 200 || 'error' in r4a.body || r4a.body.correct) fail('q2 greșit(1) eșuat');
  const m4 = await masteryOf();
  const r4b = await processQuizAnswer(svc, user.id, messageId, 'q2', 'a');
  if (r4b.status !== 200 || 'error' in r4b.body || !r4b.body.correct) fail('q2 corect(2) eșuat');
  const m5 = await masteryOf();
  const expectHalf = m4 + MASTERY_ALPHA * 0.5 * (1 - m4);
  console.log(`[4] corect după indiciu: mastery ${fx(m4)} → ${fx(m5)} (așteptat ÎNJUMĂTĂȚIT ${fx(expectHalf)}), masteryMoved=${r4b.body.masteryMoved}`);
  if (fx(m5) !== fx(expectHalf)) fail('pasul EMA după indiciu NU e înjumătățit exact');
  if (r4b.body.masteryMoved !== 'up-halved') fail('masteryMoved ≠ up-halved');

  console.log('\n✅ ETAPA 70 FAZA C acceptată: greșit→greșit→similar-corect cu EMA exact; indiciul nu scapă corecta; ajutorul înjumătățește exact pasul.');
  console.log('   (lecția sintetică rămâne ca artefact de audit)');
}
main().catch((e) => { console.error(e); process.exit(1); });
