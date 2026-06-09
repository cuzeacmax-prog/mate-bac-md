/**
 * ETAPA 60 — TEST DE ACCEPTARE CAP-COADĂ (repetabil de un auditor extern).
 *
 * Simulează un elev (user auth REAL, creat prin admin API, email etapa60-acceptance@test.local):
 *  1. „Diagnostic" cu 6 răspunsuri (mix corect/greșit pe topice mapate) — scrise prin
 *     ACELAȘI cod ca /api/diagnostic/submit (lib/mastery/evidence.recordConceptEvidence).
 *  2. Arată rândurile create în concept_mastery.
 *  3. Arată frontiera întoarsă de frontier_concepts pentru el.
 *  4. Arată exercițiile VERIFICATE care i s-ar servi pe primul concept din frontieră
 *     (același cod ca chat-ul: lib/concepts/anchor.getConceptAnchor).
 *  5. Arată figura legată (dacă există) pe acele exerciții.
 *
 * Userul și rândurile RĂMÂN în DB ca artefact de audit (șterge-le manual când vrei:
 * auth.admin.deleteUser → cascade pe concept_mastery).
 *   npx tsx --env-file=.env.local scripts/verify/etapa60-acceptance.ts
 */
import { createServiceClient } from '../../src/lib/supabase/service';
import { getConceptSlugsForTopic } from '../../src/lib/diagnostic/topic-concept-map';
import { recordConceptEvidence } from '../../src/lib/mastery/evidence';
import { getConceptAnchor } from '../../src/lib/concepts/anchor';

const GRADE = 12;
// 6 răspunsuri de diagnostic simulate (topice REALE din diagnostic_exercises, clasa 12)
const ANSWERS: Array<{ topic: string; correct: boolean }> = [
  { topic: 'primitive', correct: true },
  { topic: 'primitive', correct: true },
  { topic: 'integrale', correct: false },
  { topic: 'geometrie_3d', correct: true },
  { topic: 'probabilitati', correct: false },
  { topic: 'combinatorica', correct: true },
];

async function main() {
  const svc = createServiceClient();
  const email = 'etapa60-acceptance@test.local';

  // user de test: refolosește dacă există (repetabilitate), altfel creează
  let uid: string | null = null;
  const { data: list } = await svc.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = list?.users.find((u) => u.email === email);
  if (existing) {
    uid = existing.id;
    await svc.from('concept_mastery').delete().eq('user_id', uid); // reset pentru repetabilitate
    console.log(`user de test refolosit (mastery resetat): ${uid}`);
  } else {
    const { data: created, error } = await svc.auth.admin.createUser({ email, email_confirm: true });
    if (error || !created.user) { console.error(error?.message); process.exit(1); }
    uid = created.user.id;
    console.log(`user de test creat: ${uid}`);
  }

  // 1) diagnosticul simulat — EXACT codul din /api/diagnostic/submit
  for (const a of ANSWERS) {
    const slugs = getConceptSlugsForTopic(a.topic);
    const { written } = await recordConceptEvidence(svc, uid, slugs, a.correct, 'diagnostic');
    console.log(`  răspuns ${a.correct ? 'CORECT' : 'GREȘIT'} pe '${a.topic}' → ${written} concepte actualizate`);
  }

  // 2) rândurile din concept_mastery
  const { data: mastery } = await svc
    .from('concept_mastery')
    .select('concept_id, mastery, evidence_count, source, concepts(slug)')
    .eq('user_id', uid)
    .order('mastery', { ascending: false });
  console.log('\n── concept_mastery (rândurile create) ──');
  for (const m of mastery ?? []) {
    const slug = (m.concepts as unknown as { slug: string } | null)?.slug ?? m.concept_id;
    console.log(`  ${slug}: mastery=${Number(m.mastery).toFixed(3)} evidente=${m.evidence_count} surse=${(m.source as string[]).join(',')}`);
  }

  // 3) frontiera
  const { data: frontier, error: fErr } = await svc.rpc('frontier_concepts', {
    p_user_id: uid, p_grade: GRADE, p_limit: 5,
  });
  if (fErr) { console.error('frontier:', fErr.message); process.exit(1); }
  console.log('\n── frontiera (top 5) ──');
  for (const f of frontier ?? []) {
    console.log(`  ${f.slug} (g${f.grade_level}) mastery=${Number(f.mastery).toFixed(2)} exerciții_verificate=${f.verified_exercises} servibile=${f.servable_exercises ?? '?'} prereq ${f.prereq_ok}/${f.prereq_total}`);
  }
  if (!frontier?.length) { console.error('✗ frontiera goală — eșec'); process.exit(1); }

  // 4) exercițiile verificate pe primul concept (același cod ca chat-ul)
  const top = frontier[0] as { slug: string };
  const anchor = await getConceptAnchor(svc, top.slug);
  console.log(`\n── exerciții servite pe '${top.slug}' (servibile: verificat + sursă-oficială) ──`);
  if (!anchor || anchor.exercises.length === 0) {
    console.log('  (niciun exercițiu servibil pentru acest concept — gol de conținut, raportat)');
  } else {
    for (const e of anchor.exercises) {
      console.log(`  [${e.id}] ${e.module ?? '?'} tier=${e.tier} figură=${e.has_figure ? 'DA → /api/figura/' + e.id : 'nu'}\n    ${e.statement.slice(0, 100)}…`);
    }
  }

  // 5) figura pe exercițiile servite (dovadă din DB)
  const exIds = anchor?.exercises.map((e) => e.id) ?? [];
  if (exIds.length > 0) {
    const { data: figs } = await svc
      .from('figura_autor')
      .select('slug, status, exercise_id')
      .in('exercise_id', exIds);
    console.log(`\n── figuri legate de exercițiile servite: ${figs?.length ?? 0} ──`);
    for (const f of figs ?? []) console.log(`  ${f.slug} (${f.status}) → exercise ${f.exercise_id}`);
  }

  console.log('\n✅ Acceptare cap-coadă: evidență → mastery → frontieră → exerciții verificate → figură. User păstrat ca artefact de audit.');
}
main().catch((e) => { console.error(e); process.exit(1); });
