/**
 * ETAPA 79 FAZA A — VERIFICARE CAS pe geometrie (Modulele V-VI) contra
 * răspunsurilor OFICIALE legate strict-bijectiv. Trei verdicte ONESTE persistate
 * în exercise_verification (verdict + verified + computed_latex + note):
 *   VERIFICAT · NECONCORDANT (iese din servire) · NEREZOLVABIL-CAS (capabilitate lipsă).
 *
 * Rulează:  tsx --env-file=.env.local scripts/verify/etapa79-geo-verify.ts [--write]
 * Fără --write: raport (dry-run), nu atinge DB.
 */
import { createServiceClient } from "../../src/lib/supabase/service";
import { verifyGeometry, type GeoVerdict } from "../../src/lib/geometry/official-verify";

const CHUNK = 150;
async function inChunks<T>(ids: string[], q: (c: string[]) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += CHUNK) { const { data } = await q(ids.slice(i, i + CHUNK)); out.push(...(data ?? [])); }
  return out;
}

interface Cand { id: string; module: string; exercise_number: string | null; statement: string; official: string }

async function loadCandidates(svc: ReturnType<typeof createServiceClient>): Promise<Cand[]> {
  const { data: raws } = await svc.from("exercise_raw")
    .select("id, module, statement, exercise_number, self_contained")
    .in("module", ["Modulul V", "Modulul VI"]);
  const selfContained = (raws ?? []).filter((r) => r.self_contained);
  const ids = selfContained.map((r) => r.id as string);

  const links = await inChunks<{ exercise_id: string; answer_id: string }>(ids, (c) =>
    svc.from("exercise_answer_link").select("exercise_id, answer_id").in("exercise_id", c).eq("match_confidence", "strict-bijectiv"));
  const answerIds = [...new Set(links.map((l) => l.answer_id))];
  const answers = await inChunks<{ id: string; answer_text: string | null }>(answerIds, (c) =>
    svc.from("exercise_answers").select("id, answer_text").in("id", c));
  const ansById = new Map(answers.map((a) => [a.id, a.answer_text ?? ""]));
  const officialByEx = new Map<string, string[]>();
  for (const l of links) {
    const t = ansById.get(l.answer_id); if (!t) continue;
    if (!officialByEx.has(l.exercise_id)) officialByEx.set(l.exercise_id, []);
    officialByEx.get(l.exercise_id)!.push(t);
  }

  const cands: Cand[] = [];
  for (const r of selfContained) {
    const off = officialByEx.get(r.id as string);
    if (!off || off.length === 0) continue;
    cands.push({ id: r.id as string, module: r.module as string, exercise_number: r.exercise_number as string | null, statement: (r.statement as string) ?? "", official: off.join("  |||  ") });
  }
  return cands.sort((a, b) => a.module.localeCompare(b.module) || (a.exercise_number ?? "").localeCompare(b.exercise_number ?? ""));
}

async function main() {
  const write = process.argv.includes("--write");
  const svc = createServiceClient();
  const cands = await loadCandidates(svc);

  const byVerdict: Record<GeoVerdict, Cand[]> = { verificat: [], neconcordant: [], "nerezolvabil-cas": [] };
  const capability = new Map<string, number>();
  const neconList: Array<{ c: Cand; computed: string; official: string }> = [];
  // detector determinist: răspuns oficial dintr-un ALT domeniu (calcul integral) pe enunț geometric → mis-legat
  const CALC_RE = /\\int|\bdx\b|F\s*\(\s*x\s*\)|\+\s*[cC]\b|primitiv|\\sin\^|\\cos\^|\\tan\^/;
  const suspectMislink: Cand[] = [];
  const rows: Array<{ exercise_id: string; method: string; computed_latex: string | null; verified: boolean; verdict: GeoVerdict; note: string }> = [];

  console.log(`\n════════ ETAPA 79 FAZA A — VERIFICARE CAS GEOMETRIE (Modulele V-VI) ════════`);
  console.log(`Candidați servabili cu răspuns oficial: ${cands.length}\n`);

  for (const c of cands) {
    const r = verifyGeometry(c.statement, c.official);
    byVerdict[r.verdict].push(c);
    if (r.verdict === "nerezolvabil-cas" && r.capability) capability.set(r.capability, (capability.get(r.capability) ?? 0) + 1);
    if (r.verdict === "neconcordant") neconList.push({ c, computed: r.computedLatex ?? "?", official: c.official });
    if (r.verdict !== "verificat" && CALC_RE.test(c.official)) suspectMislink.push(c);
    rows.push({
      exercise_id: c.id, method: r.method, computed_latex: r.computedLatex,
      verified: r.verdict === "verificat", verdict: r.verdict, note: r.note.slice(0, 500),
    });
    const tag = r.verdict === "verificat" ? "✓ VERIFICAT" : r.verdict === "neconcordant" ? "⛔ NECONCORDANT" : "· nerezolvabil";
    console.log(`${tag.padEnd(16)} [${c.module} #${c.exercise_number ?? "?"}] ${(r.shape ?? "?").padEnd(13)} ${r.computedLatex ? "→ " + r.computedLatex : ""}`);
  }

  console.log(`\n──────── REZUMAT ────────`);
  console.log(`  VERIFICAT       : ${byVerdict.verificat.length}`);
  console.log(`  NECONCORDANT    : ${byVerdict.neconcordant.length}  (ies din servire → arbitraj uman)`);
  console.log(`  NEREZOLVABIL-CAS: ${byVerdict["nerezolvabil-cas"].length}`);

  if (capability.size) {
    console.log(`\n──────── HARTA CAPABILITĂȚILOR LIPSĂ (A4 — extindere ETAPA 80) ────────`);
    for (const [cap, n] of [...capability.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(3)}×  ${cap}`);
  }

  if (neconList.length) {
    console.log(`\n──────── LISTA NECONCORDANT (CRITICĂ — arbitraj Maxim) ────────`);
    for (const n of neconList) {
      console.log(`\n  • [${n.c.module} #${n.c.exercise_number}] id=${n.c.id}`);
      console.log(`    enunț:   ${n.c.statement.replace(/\s+/g, " ").slice(0, 160)}`);
      console.log(`    CAS:     ${n.computed}`);
      console.log(`    oficial: ${n.official.replace(/\s+/g, " ").slice(0, 160)}`);
    }
  }

  if (suspectMislink.length) {
    console.log(`\n──────── RĂSPUNS OFICIAL SUSPECT (alt domeniu — calcul integral pe enunț geometric; mis-legat ETAPA 14) ────────`);
    for (const c of suspectMislink) console.log(`  • [${c.module} #${c.exercise_number}] id=${c.id}  oficial: ${c.official.replace(/\s+/g, " ").slice(0, 80)}`);
    console.log(`  (rămân NEREZOLVABIL-CAS, dar legătura răspunsului trebuie curățată — pentru coada lui Maxim)`);
  }

  if (!write) { console.log(`\n(dry-run — fără --write nu se scrie în DB)\n`); return; }

  // ── PERSISTARE idempotentă ──
  const ids = rows.map((r) => r.exercise_id);
  await inChunks(ids, (c) => svc.from("exercise_verification").delete().in("exercise_id", c).like("method", "cas_geometry%").select("id"));
  let ins = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100).map((r) => ({ ...r, created_at: new Date().toISOString() }));
    const { error } = await svc.from("exercise_verification").insert(batch);
    if (error) console.error("  insert error:", error.message); else ins += batch.length;
  }
  console.log(`\n✅ Persistat ${ins} verdicte CAS. NECONCORDANT (${byVerdict.neconcordant.length}) sunt scoase din servire prin view-ul exercise_servable.\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
