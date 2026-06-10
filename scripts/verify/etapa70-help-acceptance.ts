/**
 * ETAPA 70 FAZA D — ACCEPTANȚĂ: chips-urile de ajutor și ponderea evidenței.
 *
 * Pe userul de audit, același exercițiu determinist (răspuns oficial,
 * link strict-bijectiv), trei scenarii cu mastery resetat la 0 între ele:
 *   A) corect FĂRĂ ajutor      → ΔEMA = α·(1−0)        = 0.30
 *   B) corect CU indiciu       → ΔEMA = α·0.5·(1−0)    = 0.15  (exact A/2)
 *   C) corect DUPĂ rezolvare   → ΔEMA = 0              (capitulare onestă)
 * Assert: A/B = exact 2:1; C = 0; metadata.helped=true pe încercarea B.
 * Replica fluxului din /api/chat: getHelpKindsUsed → evaluateAttempt(helped)
 * → recordConceptEvidence(weight=helpWeight) — ACELEAȘI funcții ca ruta.
 *
 *   npx tsx --env-file=.env.local scripts/verify/etapa70-help-acceptance.ts
 */
import { createServiceClient } from '../../src/lib/supabase/service';
import { evaluateAttempt } from '../../src/lib/evaluare/evaluate';
import { recordHelpUsage, getHelpKindsUsed, helpWeight, type HelpKind } from '../../src/lib/evaluare/help';
import { recordConceptEvidence, MASTERY_ALPHA, HELPED_WEIGHT } from '../../src/lib/mastery/evidence';

const EMAIL = 'etapa60-acceptance@test.local';
const CONCEPT = 'g12-conul-circular-drept';
const EXERCISE_ID = '4431b809-da7a-4961-8cfc-ab485883742a'; // con: r=5, h=12 → G=13 cm (oficial)
const CORRECT_ANSWER = '13';

function fail(msg: string): never { console.error(`✗ EȘEC: ${msg}`); process.exit(1); }
const fx = (v: number) => v.toFixed(6);

async function main() {
  const svc = createServiceClient();
  const { data: list } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const user = list?.users.find((u) => u.email === EMAIL);
  if (!user) fail('userul de audit lipsește');
  console.log(`user de audit: ${user.id}`);

  const { data: ex } = await svc.from('exercise_raw').select('id, statement').eq('id', EXERCISE_ID).single();
  if (!ex) fail('exercițiul determinist lipsește');
  const { data: conceptRow } = await svc.from('concepts').select('id').eq('slug', CONCEPT).single();
  if (!conceptRow) fail('conceptul lipsește');

  const resetMastery = () =>
    svc.from('concept_mastery').delete().eq('user_id', user.id).eq('concept_id', conceptRow.id);
  const masteryOf = async (): Promise<number> => {
    const { data } = await svc.from('concept_mastery').select('mastery')
      .eq('user_id', user.id).eq('concept_id', conceptRow.id).maybeSingle();
    return (data?.mastery as number | undefined) ?? 0;
  };

  /** replica fluxului /api/chat pentru un răspuns corect, cu/fără chip folosit */
  async function scenario(label: string, convId: string, help: HelpKind | null): Promise<number> {
    await resetMastery();
    if (help) await recordHelpUsage(svc, user.id, convId, EXERCISE_ID, help, 1);
    const kinds = await getHelpKindsUsed(svc, user.id, convId, EXERCISE_ID);
    const evaluation = await evaluateAttempt(svc, {
      userId: user.id,
      conversationId: convId,
      message: CORRECT_ANSWER,
      exercise: { id: ex.id as string, statement: ex.statement as string },
      helped: kinds.length > 0,
    });
    if (!evaluation || evaluation.correct !== true) fail(`${label}: răspunsul oficial nu a fost evaluat corect (${JSON.stringify(evaluation)})`);
    if (evaluation.method !== 'determinist') fail(`${label}: evaluarea nu e deterministă`);
    const weight = helpWeight(kinds);
    await recordConceptEvidence(svc, user.id, [CONCEPT], true, 'chat', weight);
    const delta = await masteryOf();
    console.log(`  ${label}: ajutor=${help ?? 'niciunul'}, weight=${weight}, ΔEMA=${fx(delta)}`);
    return delta;
  }

  const ts = Date.now();
  const deltaA = await scenario('[A] corect fără ajutor', `audit70d-A-${ts}`, null);
  const deltaB = await scenario('[B] corect cu indiciu', `audit70d-B-${ts}`, 'hint');
  const deltaC = await scenario('[C] corect după rezolvarea arătată', `audit70d-C-${ts}`, 'solution');

  const expectA = MASTERY_ALPHA * 1;
  const expectB = MASTERY_ALPHA * HELPED_WEIGHT;
  if (fx(deltaA) !== fx(expectA)) fail(`ΔA=${fx(deltaA)} ≠ ${fx(expectA)}`);
  if (fx(deltaB) !== fx(expectB)) fail(`ΔB=${fx(deltaB)} ≠ ${fx(expectB)}`);
  if (fx(deltaA) !== fx(2 * deltaB)) fail(`raportul ΔA:ΔB nu e EXACT 2:1 (${fx(deltaA)} vs ${fx(deltaB)})`);
  if (fx(deltaC) !== fx(0)) fail(`ΔC=${fx(deltaC)} ≠ 0 (rezolvarea arătată trebuia să nu miște mastery)`);
  console.log(`\nraport ΔA:ΔB = ${fx(deltaA)}:${fx(deltaB)} = exact 2:1 ✓; ΔC = 0 ✓`);

  // câmpul helped=true în evidența încercării B (exercise_attempts.metadata)
  const { data: attB } = await svc
    .from('exercise_attempts')
    .select('metadata, is_correct')
    .eq('user_id', user.id)
    .eq('exercise_id', EXERCISE_ID)
    .contains('metadata', { conversation_id: `audit70d-B-${ts}` })
    .not('is_correct', 'is', null)
    .maybeSingle();
  if (!attB) fail('încercarea B nu e persistată');
  if ((attB.metadata as { helped?: boolean }).helped !== true) fail('metadata.helped ≠ true pe încercarea cu indiciu');
  console.log('metadata.helped=true pe încercarea cu indiciu ✓');

  console.log('\n✅ ETAPA 70 FAZA D acceptată: 2:1 exact, capitularea nu mișcă mastery, helped persistat în evidență.');
}
main().catch((e) => { console.error(e); process.exit(1); });
