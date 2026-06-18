/**
 * ETAPA 79 FAZA B1 — TRIERE body-uri LaTeX stricate (exercise_raw).
 *  (a) reparabile MECANIC CERT (sanitizer structural R5-sigur, re-randate curat) → reparate;
 *  (b) doar-uman (rămân stricate după sanitizer) → coadă în /admin/continut.
 *
 * Rulează:  tsx --env-file=.env.local scripts/verify/etapa79-body-triage.ts [--write]
 * Fără --write: raport (dry-run). Cu --write: aplică reparațiile mecanice în
 * exercise_raw.statement și marchează coada umană (human_body_status).
 */
import { createServiceClient } from "../../src/lib/supabase/service";
import { statementVisible, leakClasses, mechanicalSanitize, findBodyErrors } from "../../src/lib/content/body-render";

async function main() {
  const write = process.argv.includes("--write");
  const svc = createServiceClient();

  const all: Array<{ id: string; module: string | null; statement: string | null }> = [];
  let from = 0;
  for (;;) {
    const { data, error } = await svc.from("exercise_raw").select("id, module, statement").range(from, from + 999);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    all.push(...(data as typeof all));
    if (data.length < 1000) break;
    from += 1000;
  }

  let clean = 0, leakStudent = 0;
  const repairable: Array<{ id: string; before: string; after: string; module: string | null }> = [];
  const humanOnly: Array<{ id: string; statement: string; classes: string[]; module: string | null }> = [];
  const classCount = new Map<string, number>();

  for (const r of all) {
    const st = r.statement ?? "";
    if (!st.trim()) continue;
    if (leakClasses(statementVisible(st)).length > 0) leakStudent++; // scurgere vizibilă elevului
    const errs0 = findBodyErrors(st); // erori KaTeX per-formulă (lentila editorului/cozii)
    if (errs0.length === 0) { clean++; continue; }
    const repaired = mechanicalSanitize(st);
    if (repaired !== st && findBodyErrors(repaired).length === 0) {
      repairable.push({ id: r.id, before: st, after: repaired, module: r.module });
    } else {
      humanOnly.push({ id: r.id, statement: st, classes: errs0.map((e) => e.message.slice(0, 32)), module: r.module });
      for (const e of errs0) classCount.set(e.message.slice(0, 40), (classCount.get(e.message.slice(0, 40)) ?? 0) + 1);
    }
  }

  console.log(`\n════════ ETAPA 79 FAZA B1 — TRIERE body-uri LaTeX ════════`);
  console.log(`  (istoric ~169 stricate pre-72/74; re-rulat prin sanitizer-ul matur)`);
  console.log(`  exercise_raw total cu enunț      : ${all.filter((r) => (r.statement ?? "").trim()).length}`);
  console.log(`  se randează curat (per-formulă)  : ${clean}`);
  console.log(`  scurgeri VIZIBILE elevului (leak): ${leakStudent}`);
  console.log(`  ⟳ REPARABILE MECANIC (cert)      : ${repairable.length}`);
  console.log(`  ✋ DOAR-UMAN (coadă)              : ${humanOnly.length}`);
  console.log(`\n  erori KaTeX (doar-uman):`);
  for (const [c, n] of [...classCount.entries()].sort((a, b) => b[1] - a[1])) console.log(`     ${String(n).padStart(4)}×  ${c}`);

  if (repairable.length) {
    console.log(`\n  ── 2 exemple reparate mecanic (înainte → după) ──`);
    for (const ex of repairable.slice(0, 2)) {
      console.log(`  • ${ex.id}`);
      console.log(`    înainte: ${ex.before.replace(/\s+/g, " ").slice(0, 120)}`);
      console.log(`    după   : ${ex.after.replace(/\s+/g, " ").slice(0, 120)}`);
    }
  }

  if (!write) { console.log(`\n(dry-run — fără --write nu se scrie)\n`); return; }

  // (a) aplică reparațiile mecanice (și scoate din coadă)
  let fixed = 0;
  for (const ex of repairable) {
    const { error } = await svc.from("exercise_raw").update({ statement: ex.after, human_body_status: null }).eq("id", ex.id);
    if (error) console.error(`  fix ${ex.id}: ${error.message}`); else fixed++;
  }
  // (b) marchează coada umană (flag pe exercise_raw)
  const queueIds = humanOnly.map((h) => h.id);
  let queued = 0;
  for (let i = 0; i < queueIds.length; i += 200) {
    const { error } = await svc.from("exercise_raw").update({ human_body_status: "coada" }).in("id", queueIds.slice(i, i + 200));
    if (error) console.error(`  queue: ${error.message}`); else queued += Math.min(200, queueIds.length - i);
  }
  console.log(`\n✅ reparate mecanic: ${fixed}  ·  marcate în coadă: ${queued}\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
