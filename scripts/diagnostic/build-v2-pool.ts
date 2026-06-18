/**
 * ETAPA 79 FAZA C — DIAGNOSTIC V2 din SURSĂ OFICIALĂ (decizia 3: plasă păstrată).
 *
 * C1: pool EXCLUSIV din exerciții servibile cu răspuns oficial: enunț scurt
 *     autonom (self_contained), răspuns UNIC verificabil determinist, mapat pe
 *     topicele din topic-concept-map. Dificultate = PROXY determinist (clasificatorul
 *     ETAPA 75 + clasa), documentat ca proxy pentru recalibrare empirică ulterioară.
 * C2: PLASA — topicele FĂRĂ itemi oficiali păstrează itemii generați etichetați
 *     'plasa-temporara'; topicele CU itemi oficiali → v2 pur (generați dezactivați).
 *
 * R5: răspunsul liber se verifică determinist cu compareAnswers (ETAPA 63); NICIUN
 * conținut generat de model pentru elevi (distractorii nu se fabrică).
 *
 *   tsx --env-file=.env.local scripts/diagnostic/build-v2-pool.ts [--write]
 */
import { createServiceClient } from "../../src/lib/supabase/service";
import { TOPIC_CONCEPT_MAP } from "../../src/lib/diagnostic/topic-concept-map";
import { evalLatexScalar, compareAnswers } from "../../src/lib/evaluare/compare";
import { hasUnrenderableMarkdown } from "../../src/lib/content/markdown-table";
import { classifyDifficulty } from "../../src/lib/ai/difficulty";

const TOPIC_GRADE: Record<string, number> = {
  algebra_ecuatii: 10, algebra_inecuatii: 10, siruri: 10, functii: 10, trigonometrie_baza: 10, logaritmi: 10, exponentiale: 10,
  limite: 11, derivate: 11, derivate_aplicatii: 11, polinoame: 11, ecuatii_log_exp: 11, inecuatii_log_exp: 11, siruri_avansate: 11,
  primitive: 12, integrale: 12, arii_volume: 12, geometrie_3d: 12, numere_complexe: 12, matrici_determinanti: 12, combinatorica: 12, probabilitati: 12,
};

function splitPieces(a: string): string[] {
  return a.replace(/\\\\|\\quad|\\qquad/g, ";").split(/;|,(?=\s*[A-Za-z]\w*\s*=)/).map((s) => s.trim()).filter(Boolean);
}
/** Răspuns UNIC verificabil determinist: o singură valoare comparabilă (numeric/simbolic). */
function uniqueAnswer(a: string): string | null {
  const pieces = splitPieces(a);
  const nums = pieces.filter((p) => evalLatexScalar(p) !== null);
  if (nums.length === 1) return nums[0];
  if (pieces.length === 1) { const v = compareAnswers(pieces[0], pieces[0]); if (v.comparable && v.correct) return pieces[0]; }
  return null;
}
/** Dificultate PROXY (1-5) — clasificatorul determinist ETAPA 75 (scor) + clasa. DOC: proxy, de recalibrat empiric. */
function difficultyProxy(statement: string, slug: string | null): number {
  const v = classifyDifficulty(statement, slug);
  return Math.min(5, Math.max(1, 1 + Math.round(v.score / 2)));
}

async function chunk<T>(arr: string[], f: (c: string[]) => Promise<T[]>): Promise<T[]> {
  const o: T[] = []; for (let i = 0; i < arr.length; i += 150) o.push(...await f(arr.slice(i, i + 150))); return o;
}

async function main() {
  const write = process.argv.includes("--write");
  const svc = createServiceClient();
  const slugToTopic = new Map<string, string>();
  for (const [topic, slugs] of Object.entries(TOPIC_CONCEPT_MAP)) for (const s of slugs) slugToTopic.set(s, topic);

  const { data: servable } = await svc.from("exercise_servable").select("exercise_id");
  const ids = (servable ?? []).map((s) => s.exercise_id as string);
  const raws = await chunk(ids, async (c) => (await svc.from("exercise_raw").select("id, statement, given_answer, self_contained").in("id", c)).data ?? []);
  const links = await chunk(ids, async (c) => (await svc.from("exercise_concept_link").select("exercise_id, rank, concepts(slug)").in("exercise_id", c).order("rank", { ascending: true })).data ?? []);
  const alinks = await chunk(ids, async (c) => (await svc.from("exercise_answer_link").select("exercise_id, answer_id").in("exercise_id", c).eq("match_confidence", "strict-bijectiv")).data ?? []);
  const verif = await chunk(ids, async (c) => (await svc.from("exercise_verification").select("exercise_id, computed_latex, verified").in("exercise_id", c).eq("verified", true)).data ?? []);
  const ansIds = [...new Set((alinks as { answer_id: string }[]).map((l) => l.answer_id))];
  const answers = await chunk(ansIds, async (c) => (await svc.from("exercise_answers").select("id, answer_text").in("id", c)).data ?? []);
  const ansById = new Map((answers as { id: string; answer_text: string | null }[]).map((a) => [a.id, a.answer_text ?? ""]));
  const offByEx = new Map<string, string>(); for (const l of alinks as { exercise_id: string; answer_id: string }[]) { const t = ansById.get(l.answer_id); if (t && !offByEx.has(l.exercise_id)) offByEx.set(l.exercise_id, t); }
  const verByEx = new Map<string, string>(); for (const v of verif as { exercise_id: string; computed_latex: string | null }[]) { if (v.computed_latex && !verByEx.has(v.exercise_id)) verByEx.set(v.exercise_id, v.computed_latex); }
  const slugsByEx = new Map<string, string[]>(); for (const l of links as { exercise_id: string; concepts: { slug: string } | null }[]) { const sl = l.concepts?.slug; if (!sl) continue; if (!slugsByEx.has(l.exercise_id)) slugsByEx.set(l.exercise_id, []); slugsByEx.get(l.exercise_id)!.push(sl); }

  interface V2 { id: string; topic: string; grade: number; difficulty: number; prompt: string; answer: string; source: string }
  const v2: V2[] = [];
  for (const r of raws as { id: string; statement: string | null; given_answer: string | null; self_contained: boolean }[]) {
    const st = r.statement ?? "";
    const off = offByEx.get(r.id) ?? verByEx.get(r.id) ?? (r.given_answer || undefined);
    if (!off || !r.self_contained) continue;
    const slugs = slugsByEx.get(r.id) ?? []; let topic: string | undefined, slug: string | null = null;
    for (const s of slugs) { const t = slugToTopic.get(s); if (t) { topic = t; slug = s; break; } }
    if (!topic) continue;
    if (st.length > 240 || hasUnrenderableMarkdown(st) || /complet(a[țt]i|[ăa]m)\s+tabelul|\\begin\{array\}|\|---/.test(st)) continue;
    const ua = uniqueAnswer(off); if (!ua) continue;
    v2.push({ id: r.id, topic, grade: TOPIC_GRADE[topic] ?? 12, difficulty: difficultyProxy(st, slug), prompt: st, answer: ua, source: offByEx.get(r.id) ? "strict-bijectiv" : verByEx.get(r.id) ? "cas-verificat" : "given_answer" });
  }

  const perTopic = new Map<string, number>(); const perDiff = new Map<number, number>();
  for (const x of v2) { perTopic.set(x.topic, (perTopic.get(x.topic) ?? 0) + 1); perDiff.set(x.difficulty, (perDiff.get(x.difficulty) ?? 0) + 1); }
  const covered = new Set(perTopic.keys());
  const allTopics = Object.keys(TOPIC_CONCEPT_MAP);
  const plasaTopics = allTopics.filter((t) => !covered.has(t));

  console.log(`\n════════ ETAPA 79 FAZA C — DIAGNOSTIC V2 (pool oficial + plasă) ════════`);
  console.log(`  itemi v2 (oficial, răspuns liber verificabil): ${v2.length}`);
  console.log(`  acoperire per topic:`);
  for (const [t, n] of [...perTopic.entries()].sort((a, b) => b[1] - a[1])) console.log(`     ${t.padEnd(22)} ${n}`);
  console.log(`  distribuție pe dificultate (proxy): ${[...perDiff.entries()].sort().map(([d, n]) => `d${d}:${n}`).join("  ")}`);
  console.log(`\n  topice ACOPERITE v2 (${covered.size}): ${[...covered].join(", ")}`);
  console.log(`  topice pe PLASĂ (${plasaTopics.length}, păstrează generații): ${plasaTopics.join(", ")}`);

  if (!write) { console.log(`\n(dry-run — fără --write nu se scrie)\n`); return; }

  // ── PERSISTARE v2 (idempotent) ──
  await svc.from("diagnostic_exercises").delete().eq("source_tag", "oficial-v2");
  const rows = v2.map((x) => ({
    grade_level: x.grade, topic_id: x.topic, difficulty: x.difficulty,
    prompt: x.prompt, correct_answer: x.answer, distractors: {}, correct_letter: "x",
    explanation: `Răspuns oficial (${x.source}); verificare determinist liberă (compareAnswers).`,
    item_kind: "free", source_tag: "oficial-v2", active: true, source_exercise_id: x.id,
  }));
  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await svc.from("diagnostic_exercises").insert(rows.slice(i, i + 100));
    if (error) console.error("  insert v2:", error.message);
  }

  // ── PLASA (C2) ──
  // topice acoperite → itemii generați (mcq, source_tag NULL) DEZACTIVAȚI
  const { error: e1 } = await svc.from("diagnostic_exercises").update({ active: false })
    .is("source_tag", null).eq("item_kind", "mcq").in("topic_id", [...covered]);
  if (e1) console.error("  disable generated:", e1.message);
  // restul generați → etichetați 'plasa-temporara' (rămân activi)
  const { error: e2 } = await svc.from("diagnostic_exercises").update({ source_tag: "plasa-temporara", active: true })
    .is("source_tag", null).eq("item_kind", "mcq").in("topic_id", plasaTopics);
  if (e2) console.error("  tag plasa:", e2.message);

  console.log(`\n✅ Persistat ${rows.length} itemi v2. Generați dezactivați pe ${covered.size} topice acoperite; ${plasaTopics.length} topice pe plasă (etichetate).\n`);
}
main().catch((e) => { console.error(e); process.exit(1); });
