/**
 * ETAPA 79 FAZA C3 — ACCEPTANȚĂ diagnostic v2 (simulare cap-coadă).
 * Verifică, pe logica REALĂ a serverului (next/submit), că:
 *  - CAT-ul converge (oprire în 6-8, dificultatea se adaptează spre abilitate);
 *  - itemii v2 (free) se servesc și se notează DETERMINIST cu compareAnswers;
 *  - itemii generați NU se servesc pe topicele acoperite de v2 (active=false);
 *  - mastery-ul se scrie prin maparea topic→concepte (slug-urile EXISTĂ în DB).
 *
 *   tsx --env-file=.env.local scripts/verify/etapa79-diagnostic-v2-acceptance.ts
 */
import { createServiceClient } from "../../src/lib/supabase/service";
import { nextDifficulty, shouldStop, type DiagnosticAttempt } from "../../src/lib/diagnostic/adaptive";
import { getConceptSlugsForTopic } from "../../src/lib/diagnostic/topic-concept-map";
import { compareAnswers } from "../../src/lib/evaluare/compare";

const GRADE = 12;
const ABILITY = 3; // „elevul" simulat: corect pe dificultate ≤ 3

async function main() {
  const svc = createServiceClient();
  let ok = true;
  const assert = (c: boolean, m: string) => { console.log(`  ${c ? "✓" : "✗"} ${m}`); if (!c) ok = false; };
  console.log("\n════════ FAZA C3 — diagnostic v2 (simulare cap-coadă) ════════");

  // ── serving = replica next/route (active=true, grade, difficulty) ──
  const history: DiagnosticAttempt[] = [];
  const used = new Set<string>();
  let servedFree = 0, servedDisabledOnCovered = 0;
  const topicsSeen = new Set<string>();

  for (let step = 0; step < 8; step++) {
    if (history.length > 0 && shouldStop(history)) break;
    const target = nextDifficulty(history);
    const { data: pool } = await svc.from("diagnostic_exercises")
      .select("id, topic_id, difficulty, item_kind, correct_answer, correct_letter, active, source_tag")
      .eq("grade_level", GRADE).eq("difficulty", target).eq("active", true);
    const avail = (pool ?? []).filter((e) => !used.has(e.id));
    if (avail.length === 0) { console.log(`  · d${target}: pool gol (ar cădea pe FALLBACK în produs)`); break; }
    const ex = avail[Math.floor(Math.random() * avail.length)];
    used.add(ex.id); topicsSeen.add(ex.topic_id);
    if (ex.active === false) servedDisabledOnCovered++; // n-ar trebui niciodată
    if (ex.item_kind === "free") servedFree++;

    // notare (replica submit): free → compareAnswers; mcq → literă
    const wantCorrect = ex.difficulty <= ABILITY;
    let isCorrect: boolean;
    if (ex.item_kind === "free") {
      const studentAns = wantCorrect ? ex.correct_answer! : `${ex.correct_answer}999`; // greșit deliberat
      const v = compareAnswers(ex.correct_answer ?? "", studentAns);
      isCorrect = v.comparable && v.correct;
    } else {
      isCorrect = wantCorrect; // simulează litera corectă/greșită
    }
    history.push({ exercise_id: ex.id, difficulty: ex.difficulty, topic_id: ex.topic_id, is_correct: isCorrect, time_spent_seconds: 20 });
    console.log(`  pas ${step + 1}: d${ex.difficulty} [${ex.item_kind}/${ex.source_tag ?? "fallback"}] ${ex.topic_id} → ${isCorrect ? "corect" : "greșit"}`);
  }

  // ── aserțiuni CAT ──
  assert(history.length >= 5 && history.length <= 8, `CAT s-a oprit în 5-8 itemi (${history.length})`);
  assert(shouldStop(history), "shouldStop=true la final (convergență)");
  const diffs = history.map((h) => h.difficulty);
  assert(new Set(diffs).size >= 2, `dificultatea s-a adaptat (valori: ${diffs.join(",")})`);
  const last3 = diffs.slice(-3);
  assert(Math.max(...last3) - Math.min(...last3) <= 1, `ultima fereastră stabilizată în jurul abilității (${last3.join(",")})`);

  // ── v2 servit + generați NU pe topice acoperite ──
  assert(servedFree >= 1, `cel puțin un item v2 (free) servit (${servedFree})`);
  assert(servedDisabledOnCovered === 0, "niciun item dezactivat servit");

  const { data: covered } = await svc.from("diagnostic_exercises").select("topic_id").eq("source_tag", "oficial-v2");
  const coveredTopics = [...new Set((covered ?? []).map((c) => c.topic_id))];
  const { count: genActiveOnCovered } = await svc.from("diagnostic_exercises")
    .select("*", { count: "exact", head: true })
    .eq("item_kind", "mcq").is("source_tag", null).eq("active", true).in("topic_id", coveredTopics);
  assert((genActiveOnCovered ?? 0) === 0, `0 itemi generați ACTIVI pe topicele acoperite de v2 (${coveredTopics.join(", ")})`);

  // ── mastery: maparea topic→concepte rezolvă la slug-uri EXISTENTE ──
  let mapOk = true;
  for (const t of topicsSeen) {
    const slugs = getConceptSlugsForTopic(t);
    if (slugs.length === 0) continue; // topic nemapat → no-op (acceptat)
    const { data: exist } = await svc.from("concepts").select("slug").in("slug", slugs);
    const found = new Set((exist ?? []).map((c) => c.slug));
    for (const s of slugs) if (!found.has(s)) { mapOk = false; console.log(`    slug inexistent: ${s}`); }
  }
  assert(mapOk, "mastery: toate slug-urile mapate ale topicelor servite EXISTĂ în concepts (recordConceptEvidence va scrie corect)");

  // ── grading free determinist: corect ↔ greșit ──
  const fv = await svc.from("diagnostic_exercises").select("correct_answer").eq("item_kind", "free").limit(1).single();
  if (fv.data?.correct_answer) {
    const a = fv.data.correct_answer;
    assert(compareAnswers(a, a).correct === true, `grading free: răspuns identic → corect (${a.slice(0, 24)})`);
    assert(compareAnswers(a, `${a}123`).correct !== true, "grading free: răspuns greșit → incorect");
  }

  console.log(`\n${ok ? "✅ C3 OK — CAT converge, v2 servit+notat determinist, generați excluși pe topice acoperite, mastery mapat" : "❌ C3 a picat"}`);
  process.exit(ok ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
