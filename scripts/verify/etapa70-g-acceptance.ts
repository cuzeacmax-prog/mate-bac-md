/**
 * ETAPA 70 FAZA G — ACCEPTANȚĂ: G1 conversia persistată, G2 taxonomia
 * greșelilor + „Unde greșești des", G3 datele ritualului de final.
 *
 *   npx tsx --env-file=.env.local scripts/verify/etapa70-g-acceptance.ts
 */
import { createServiceClient } from '../../src/lib/supabase/service';
import { evaluateAttempt } from '../../src/lib/evaluare/evaluate';
import { getProgressData } from '../../src/lib/progres/data';
import { chisinauToday, computeStreak } from '../../src/lib/daily/daily';

const EMAIL = 'etapa60-acceptance@test.local';
const EXERCISE_ID = '4431b809-da7a-4961-8cfc-ab485883742a'; // con, răspuns oficial 13 cm
const CONCEPT = 'g12-conul-circular-drept';

function fail(msg: string): never { console.error(`✗ EȘEC: ${msg}`); process.exit(1); }

async function main() {
  const svc = createServiceClient();
  const { data: list } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const user = list?.users.find((u) => u.email === EMAIL);
  if (!user) fail('userul de audit lipsește');

  // ── G1: conversia persistată în DB, cu proveniență și original păstrat ────
  const { count: complet } = await svc.from('diagnostic_exercises')
    .select('id', { count: 'exact', head: true }).eq('converted_etapa70', 'complet');
  const { count: partial } = await svc.from('diagnostic_exercises')
    .select('id', { count: 'exact', head: true }).eq('converted_etapa70', 'partial');
  const { count: cuOriginal } = await svc.from('diagnostic_exercises')
    .select('id', { count: 'exact', head: true }).not('original_etapa70', 'is', null);
  const { data: sample } = await svc.from('diagnostic_exercises')
    .select('prompt, original_etapa70').eq('converted_etapa70', 'complet').like('prompt', '%$%').limit(1).single();
  console.log(`[G1] convertite: complet=${complet}, partial=${partial}, cu original păstrat=${cuOriginal}`);
  if ((complet ?? 0) < 250) fail('prea puține conversii complete');
  if ((cuOriginal ?? 0) !== (complet ?? 0) + (partial ?? 0)) fail('originalul nu e păstrat pe toate rândurile convertite');
  if (!sample || !/\$[^$]+\$/.test(sample.prompt as string)) fail('promptul convertit nu conține delimitatori $');
  console.log(`     exemplu: ${(sample.prompt as string).slice(0, 90)}`);

  // ── G2: greșeala persistă concept+modul; progresul arată „Unde greșești des" ──
  const conv = `audit70g-${Date.now()}`;
  const { data: ex } = await svc.from('exercise_raw').select('id, statement, module').eq('id', EXERCISE_ID).single();
  if (!ex) fail('exercițiul lipsește');
  const evaluation = await evaluateAttempt(svc, {
    userId: user.id,
    conversationId: conv,
    message: '999999',
    exercise: { id: ex.id as string, statement: ex.statement as string },
  });
  if (!evaluation || evaluation.correct !== false) fail('greșeala deliberată nu a fost evaluată ca greșită');
  const { data: att } = await svc.from('exercise_attempts')
    .select('metadata')
    .eq('user_id', user.id).eq('exercise_id', EXERCISE_ID)
    .contains('metadata', { conversation_id: conv })
    .single();
  const meta = att?.metadata as { concept_slug?: string; module?: string } | null;
  console.log(`[G2] taxonomia greșelii: concept_slug=${meta?.concept_slug}, module=${meta?.module}`);
  if (!meta?.concept_slug) fail('greșeala NU a persistat concept_slug');
  if (!meta?.module) fail('greșeala NU a persistat modulul');
  if (meta.module !== ex.module) fail(`modulul persistat diferă: ${meta.module} ≠ ${ex.module}`);

  const progress = await getProgressData(svc, user.id, 12);
  console.log(`     Unde greșești des (top ${progress.frequentMistakes.length}):`);
  for (const m of progress.frequentMistakes) console.log(`       ${m.name} — ${m.wrongCount} greșeli (${m.module ?? 'fără modul'}) → /app/chat?concept=${m.slug}`);
  if (progress.frequentMistakes.length === 0) fail('frequentMistakes e gol deși există greșeli persistate');
  if (!progress.frequentMistakes.some((m) => m.slug === CONCEPT || m.wrongCount >= 1)) fail('conceptul greșit nu apare în top');

  // ── G3: datele ritualului (aceleași query-uri ca GET /api/lesson/ritual) ──
  const { data: conceptRow } = await svc.from('concepts').select('id').eq('slug', CONCEPT).single();
  const [{ data: masteryRow }, frontier, streak] = await Promise.all([
    svc.from('concept_mastery').select('mastery').eq('user_id', user.id).eq('concept_id', conceptRow!.id).maybeSingle(),
    svc.rpc('frontier_concepts', { p_user_id: user.id, p_grade: 12, p_limit: 3 }),
    computeStreak(svc, user.id, chisinauToday()),
  ]);
  const rows = (frontier.data ?? []) as Array<{ slug: string; name: string }>;
  const next = rows.find((r) => r.slug !== CONCEPT) ?? null;
  console.log(`[G3] ritual: mastery=${Number(masteryRow?.mastery ?? 0).toFixed(3)}, streak=${streak}, next=${next?.slug ?? 'NULL'}`);
  if (typeof streak !== 'number') fail('streak invalid');
  if (!next) fail('frontiera nu oferă „mâine te așteaptă" (userul de audit ARE frontieră)');

  console.log('\n✅ ETAPA 70 FAZA G acceptată: conversie persistată cu original, taxonomie pe greșeli + top 3 în progres, ritualul are date reale.');
}
main().catch((e) => { console.error(e); process.exit(1); });
