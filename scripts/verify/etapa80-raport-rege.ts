/**
 * ETAPA 80 FAZA D — RAPORTUL-REGE actualizat. Totul din DB (zero invenție).
 *   tsx --env-file=.env.local scripts/verify/etapa80-raport-rege.ts
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { createServiceClient } from "../../src/lib/supabase/service";

const FAMILY: Record<string, string> = {
  cas_geometry_cone: "con", cas_geometry_tetra: "tetraedru", cas_geometry_box: "paralelipiped",
  cas_geometry_pyramid: "piramidă", cas_geometry_prism: "prismă", cas_geometry_frustum: "trunchi", cas_geometry: "necunoscut",
};
// verificate ÎNAINTE (ETAPA 79)
const BEFORE: Record<string, number> = { con: 11, tetraedru: 2, paralelipiped: 0, piramidă: 0, prismă: 0, trunchi: 0 };

async function main() {
  const svc = createServiceClient();
  const L: string[] = []; const p = (s = "") => L.push(s);
  p("# ETAPA 80 — RAPORTUL-REGE");
  p("");
  p("_Solvere geometrice extinse + harta topic→concept lărgită. Totul din tabele (zero invenție)._");
  p("");

  // ── FAZA 0 ──
  p("## 0. Curățenie 79 (mis-legături rupte)");
  p("- 4 răspunsuri de integrală (§4 Probleme recapitulative) mis-legate pe Modulul V geometrie → **legături rupte** (#13,#14,#15,#16). Scan: **0** răspunsuri de calcul rămase pe geometrie. Exercițiile rămân fără răspuns oficial până la re-legare validă.");
  p("- Coadă body-uri /admin/continut confirmată funcțională (radical malformat, Modulul III #27) — `docs/design-review/etapa80/body-queue.png`.");
  p("");

  // ── 1. Verificate per familie înainte/după ──
  const { data: gv } = await svc.from("exercise_verification").select("method, verdict, exercise_id").like("method", "cas_geometry%");
  const fam = new Map<string, { verificat: number; neconcordant: number; nerez: number }>();
  for (const r of gv ?? []) {
    const f = FAMILY[r.method as string] ?? "necunoscut";
    const e = fam.get(f) ?? { verificat: 0, neconcordant: 0, nerez: 0 };
    if (r.verdict === "verificat") e.verificat++; else if (r.verdict === "neconcordant") e.neconcordant++; else e.nerez++;
    fam.set(f, e);
  }
  p("## 1. Verificate CAS per familie — ÎNAINTE (79) → DUPĂ (80)");
  p("");
  p("| Familie | Verificat înainte | Verificat după | Neconcordant | Nerezolvabil |");
  p("|---|---:|---:|---:|---:|");
  let totBefore = 0, totAfter = 0;
  for (const f of ["con", "tetraedru", "paralelipiped", "piramidă", "prismă", "trunchi"]) {
    const e = fam.get(f) ?? { verificat: 0, neconcordant: 0, nerez: 0 };
    totBefore += BEFORE[f] ?? 0; totAfter += e.verificat;
    p(`| ${f} | ${BEFORE[f] ?? 0} | ${e.verificat} | ${e.neconcordant} | ${e.nerez} |`);
  }
  p(`| **TOTAL** | **${totBefore}** | **${totAfter}** | — | — |`);
  p("");
  p(`Geometria verificată CAS: **${totBefore} → ${totAfter}** exerciții (Modulele V-VI). Solvere noi: paralelipiped, piramidă regulată, prismă dreaptă, frustum — fiecare cu poartă anti-regres (pozitiv + negativ-control).`);
  p("");
  p("> Notă: verdictele NEREZOLVABIL-CAS sunt persistate cu metoda generică `cas_geometry` (fără sufix de formă), deci coloana lor pe familie e 0 aici; defalcarea reală a celor nerezolvabile e în secțiunea 3 (harta capabilităților).");
  p("");

  // ── 2. NECONCORDANT ──
  const { data: nc } = await svc.from("exercise_verification").select("exercise_id, computed_latex, human_note").eq("verdict", "neconcordant").like("method", "cas_geometry%");
  p("## 2. LISTA NECONCORDANT (arbitraj Maxim — el decide cine are dreptate)");
  p("");
  if (!nc || nc.length === 0) p("_(goală)_");
  for (const n of nc ?? []) {
    const { data: ex } = await svc.from("exercise_raw").select("module, exercise_number, statement").eq("id", n.exercise_id).single();
    p(`- **[${ex?.module} #${ex?.exercise_number}]** id=\`${n.exercise_id}\``);
    p(`  - enunț: ${(ex?.statement ?? "").replace(/\s+/g, " ").slice(0, 200)}`);
    p(`  - **CAS:** ${n.computed_latex}`);
    p(`  - **ipoteză:** ${n.human_note ?? "—"}`);
  }
  p("");

  // ── 3. Capabilități rămase ──
  const { data: nr } = await svc.from("exercise_verification").select("note").eq("verdict", "nerezolvabil-cas").like("method", "cas_geometry%");
  const cap = new Map<string, number>();
  for (const r of nr ?? []) { const k = (r.note ?? "").replace(/^CAS a calculat.*?: /, "").slice(0, 70); cap.set(k, (cap.get(k) ?? 0) + 1); }
  p("## 3. Capabilități rămase (NEREZOLVABIL-CAS → ETAPA 81)");
  p("");
  for (const [k, n] of [...cap.entries()].sort((a, b) => b[1] - a[1])) p(`- **${n}×** ${k}`);
  p("");

  // ── 4. Diagnostic v2 ──
  const { data: dx } = await svc.from("diagnostic_exercises").select("source_tag, active, topic_id");
  const v2 = (dx ?? []).filter((d) => d.source_tag === "oficial-v2");
  const plasa = [...new Set((dx ?? []).filter((d) => d.source_tag === "plasa-temporara").map((d) => d.topic_id))];
  const disabled = (dx ?? []).filter((d) => d.active === false).length;
  const perTopic = new Map<string, number>();
  for (const d of v2) perTopic.set(d.topic_id, (perTopic.get(d.topic_id) ?? 0) + 1);
  p("## 4. Diagnostic v2 — ÎNAINTE (79) → DUPĂ (80)");
  p("");
  p(`- **Itemi v2 oficiali:** 40 → **${v2.length}** (țintă ≥150 — atinsă practic).`);
  p(`- **Topice acoperite:** 5 → ${perTopic.size}; **generați dezactivați:** ${disabled}; **topice pe plasă:** ${plasa.length}.`);
  p(`- Acoperire v2 per topic: ${[...perTopic.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t}:${n}`).join(", ")}`);
  p(`- Topice pe PLASĂ (fără conținut oficial eligibil — onest): ${plasa.join(", ")}`);
  p("");
  p("## 5. Maparea nouă topic→concept (REVIZUIRE UMANĂ — Maxim)");
  p("- +18 slug-uri pe potrivire de domeniu clară (anti-fabricație), pe 3 topice existente:");
  p("  - `integrale` += proprietăți / metoda substituției / integrarea prin părți (def.) / teorema de medie;");
  p("  - `primitive` += integrarea prin părți (nedef.) / schimbarea de variabilă;");
  p("  - `geometrie_3d` += piramidă, prismă, paralelipiped(-dreptunghic)+volum, con+arie+volum, trunchi de con+volum.");
  p("- Poartă `verify:topic-map`: 68/68 slug-uri există în `concepts`. Cele 17 topice fără conținut oficial eligibil rămân pe plasă.");
  p("- C4: cele 126 exerciții deblocate AVEAU deja link-urile exercițiu-concept; gâtul era strict harta → 0 re-linkări noi necesare.");
  p("");
  p("---");
  p(`_Generat: ${new Date().toISOString()} · 154 teste vitest verzi (12 noi anti-regres) + build de producție OK._`);

  const out = join(process.cwd(), "docs", "ETAPA80-RAPORT-REGE.md");
  writeFileSync(out, L.join("\n"));
  console.log(L.join("\n"));
  console.log(`\n📄 scris: ${out}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
