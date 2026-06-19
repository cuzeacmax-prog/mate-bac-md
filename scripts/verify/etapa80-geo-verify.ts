/**
 * ETAPA 80 FAZA A/B — re-verificare CAS a geometriei (Modulele V-VI) cu solverele
 * EXTINSE (paralelipiped/piramidă/prismă/frustum). Trei verdicte persistate ca în 79.
 * Pe enunțurile trunchiate ("Calculați:") concatenăm subparts (cererea reală).
 *
 *   tsx --env-file=.env.local scripts/verify/etapa80-geo-verify.ts [--write]
 */
import { createServiceClient } from "../../src/lib/supabase/service";
import { verifyGeometry, type GeoVerdict } from "../../src/lib/geometry/official-verify";

const CHUNK = 150;
async function inChunks<T>(ids: string[], q: (c: string[]) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += CHUNK) { const { data } = await q(ids.slice(i, i + CHUNK)); out.push(...(data ?? [])); }
  return out;
}

interface Cand { id: string; module: string; exercise_number: string | null; text: string; statement: string; official: string }

async function loadCandidates(svc: ReturnType<typeof createServiceClient>): Promise<Cand[]> {
  const { data: raws } = await svc.from("exercise_raw")
    .select("id, module, statement, exercise_number, self_contained, subparts")
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
  for (const l of links) { const t = ansById.get(l.answer_id); if (!t) continue; if (!officialByEx.has(l.exercise_id)) officialByEx.set(l.exercise_id, []); officialByEx.get(l.exercise_id)!.push(t); }

  const cands: Cand[] = [];
  for (const r of selfContained) {
    const off = officialByEx.get(r.id as string);
    if (!off || off.length === 0) continue;
    const statement = (r.statement as string) ?? "";
    const subs = Array.isArray(r.subparts) ? (r.subparts as unknown[]).map((x) => typeof x === "string" ? x : JSON.stringify(x)).join(" ") : "";
    cands.push({ id: r.id as string, module: r.module as string, exercise_number: r.exercise_number as string | null, text: `${statement} ${subs}`.trim(), statement, official: off.join("  |||  ") });
  }
  return cands.sort((a, b) => a.module.localeCompare(b.module) || (a.exercise_number ?? "").localeCompare(b.exercise_number ?? ""));
}

async function main() {
  const write = process.argv.includes("--write");
  const svc = createServiceClient();
  const cands = await loadCandidates(svc);

  const byVerdict: Record<GeoVerdict, number> = { verificat: 0, neconcordant: 0, "nerezolvabil-cas": 0 };
  const perFamily = new Map<string, { verificat: number; neconcordant: number; nerez: number }>();
  const capability = new Map<string, number>();
  const neconList: Array<{ c: Cand; computed: string; official: string; shape: string | null }> = [];
  const rows: Array<{ exercise_id: string; method: string; computed_latex: string | null; verified: boolean; verdict: GeoVerdict; note: string }> = [];

  console.log(`\n════════ ETAPA 80 FAZA A — VERIFICARE CAS EXTINSĂ (Modulele V-VI) ════════`);
  console.log(`Candidați servabili cu răspuns oficial: ${cands.length}\n`);

  for (const c of cands) {
    const r = verifyGeometry(c.text, c.official);
    byVerdict[r.verdict]++;
    const fam = r.shape ?? "necunoscut";
    const e = perFamily.get(fam) ?? { verificat: 0, neconcordant: 0, nerez: 0 };
    if (r.verdict === "verificat") e.verificat++; else if (r.verdict === "neconcordant") e.neconcordant++; else e.nerez++;
    perFamily.set(fam, e);
    if (r.verdict === "nerezolvabil-cas" && r.capability) capability.set(r.capability, (capability.get(r.capability) ?? 0) + 1);
    if (r.verdict === "neconcordant") neconList.push({ c, computed: r.computedLatex ?? "?", official: c.official, shape: r.shape });
    rows.push({ exercise_id: c.id, method: r.method, computed_latex: r.computedLatex, verified: r.verdict === "verificat", verdict: r.verdict, note: r.note.slice(0, 500) });
    const tag = r.verdict === "verificat" ? "✓ VERIFICAT" : r.verdict === "neconcordant" ? "⛔ NECONCORDANT" : "· nerezolvabil";
    console.log(`${tag.padEnd(16)} [${c.module} #${c.exercise_number ?? "?"}] ${(r.shape ?? "?").padEnd(13)} ${r.computedLatex ? "→ " + r.computedLatex : ""}`);
  }

  console.log(`\n──────── REZUMAT (verificat ÎNAINTE 79 = 13) ────────`);
  console.log(`  VERIFICAT: ${byVerdict.verificat}  ·  NECONCORDANT: ${byVerdict.neconcordant}  ·  NEREZOLVABIL: ${byVerdict["nerezolvabil-cas"]}`);
  console.log(`\n  pe familie:`);
  for (const [fam, e] of [...perFamily.entries()].sort()) console.log(`    ${fam.padEnd(14)} verificat=${e.verificat}  neconcordant=${e.neconcordant}  nerezolvabil=${e.nerez}`);
  if (capability.size) {
    console.log(`\n  capabilități rămase (NEREZOLVABIL → ETAPA 81):`);
    for (const [k, n] of [...capability.entries()].sort((a, b) => b[1] - a[1])) console.log(`    ${String(n).padStart(3)}×  ${k}`);
  }
  if (neconList.length) {
    console.log(`\n──────── LISTA NECONCORDANT (pentru arbitrajul lui Maxim) ────────`);
    for (const n of neconList) {
      console.log(`\n  • [${n.c.module} #${n.c.exercise_number}] ${n.shape} id=${n.c.id}`);
      console.log(`    enunț:   ${n.c.statement.replace(/\s+/g, " ").slice(0, 150)}`);
      console.log(`    CAS:     ${n.computed}`);
      console.log(`    oficial: ${n.official.replace(/\s+/g, " ").slice(0, 100)}`);
    }
  }

  if (!write) { console.log(`\n(dry-run — fără --write)\n`); return; }
  // curăță TOATE verdictele cas_geometry% (inclusiv orfanii celor 4 exerciții dez-legate în FAZA 0), apoi re-inserează
  await svc.from("exercise_verification").delete().like("method", "cas_geometry%").select("id");
  let ins = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100).map((r) => ({ ...r, created_at: new Date().toISOString() }));
    const { error } = await svc.from("exercise_verification").insert(batch);
    if (error) console.error("  insert:", error.message); else ins += batch.length;
  }
  console.log(`\n✅ Persistat ${ins} verdicte. NECONCORDANT (${byVerdict.neconcordant}) scoase din servire prin view-ul exercise_servable.\n`);
}
main().catch((e) => { console.error(e); process.exit(1); });
