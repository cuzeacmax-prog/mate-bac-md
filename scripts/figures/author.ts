/**
 * ETAPA 45 — CLI bucla de AUTORAT.  npm run figura:autor
 *
 * Set REPREZENTATIV de bootstrap (adevăr-de-referință: condiție + desen dorit). Pentru fiecare caz:
 *   CAS → porți numerice → randare → poartă vizuală vs DORIT → status. Rasterizează PNG (sharp) și
 *   PERSISTĂ în `figura_autor` pentru review pe /admin/figura-autor (compari DORIT vs GENERAT, aprobi/respingi).
 * Raportează per caz: condiție → constrângeri → porți numerice → potrivire vizuală cu dorit → persistat? → status.
 */
import sharp from "sharp";
import { createServiceClient } from "../../src/lib/supabase/service";
import { runAuthoring, type AuthorCase } from "../../src/lib/figures/authoring";
import { axialSection, dihedralSection } from "../../src/lib/figures/axial";
import type { Scene3D } from "../../src/lib/figures/spec3d";

// ── set de bootstrap (reprezentativ): condiție + desen DORIT + intrarea de referință ──
const CASES: AuthorCase[] = [
  {
    slug: "con-sectiune-plan-paralel",
    condition: "Un con are volumul 18π și înălțimea 6. Un plan paralel cu baza este dus la distanța 2 de vârf. Reprezentați conul, planul de secțiune și distanța de la vârf la plan.",
    desired: { kind: "description", ref: "Con 3D (vârf V sus, bază O jos cu rim spate punctat) + cercul de secțiune orizontal aproape de vârf + segmentul perpendicular V→secțiune punctat, etichetat 2." },
    desiredDescriptor: { dim: "3D", orientation: "apex-sus", mustLabels: ["V", "O", "2"], minPolylines: 6 },
    input: { kind: "coneCut", cone: { radius: 3, height: 6 }, by: { rel: "distanceApexToParallelPlane", value: 2 } },
  },
  {
    slug: "sfera-inscrisa-con-sectiune-axiala",
    condition: "O sferă este înscrisă într-un con cu raza 5 și înălțimea 12. Reprezentați secțiunea axială: triunghiul isoscel și cercul înscris tangent.",
    desired: { kind: "description", ref: "Triunghi isoscel V (sus), B, C (bază) + cercul înscris tangent la cele 3 laturi." },
    desiredDescriptor: { dim: "2D", orientation: "apex-sus", mustLabels: ["V", "B", "C"], minPolylines: 2 },
    input: { kind: "spec2d", spec: axialSection({ points: [], elements: [{ kind: "cone3d", id: "con", radius: 5, height: 12 }, { kind: "inscribedSphere", in: "con" }] } as unknown as Scene3D) },
  },
  {
    slug: "diedru-baza-sectiune",
    condition: "O piramidă are apotema bazei 4 și unghiul diedru la bază 60°. Reprezentați secțiunea perpendiculară pe muchie (triunghiul dreptunghic VOM).",
    desired: { kind: "description", ref: "Triunghi dreptunghic V (sus), O (colț drept jos-stânga), M (jos-dreapta); apotema r=4 pe OM, unghi 60° la M, unghi drept la O." },
    desiredDescriptor: { dim: "2D", orientation: "apex-sus", mustLabels: ["O", "M", "V"], minPolylines: 4 },
    input: { kind: "spec2d", spec: dihedralSection(4, 60) },
  },
  {
    slug: "triunghi-isoscel-bisectoare",
    condition: "Triunghi isoscel ABC cu AB=AC=26, BC=20. Bisectoarea din A taie BC în M.",
    desired: { kind: "description", ref: "Triunghi ABC (A sus), bisectoarea din A până la M pe BC." },
    desiredDescriptor: { dim: "2D", mustLabels: ["A", "B", "C", "M"], minPolylines: 2 },
    input: { kind: "geo", problem: { build: [{ op: "triangleSSS", ids: ["A", "B", "C"], ab: 26, bc: 20, ca: 26 }, { op: "bisectorFoot", id: "M", tri: ["A", "B", "C"], from: "A" }], givens: [{ kind: "length", of: ["A", "B"], value: 26 }, { kind: "length", of: ["B", "C"], value: 20 }] } },
  },
];

const ICON = (b: boolean) => (b ? "✅" : "⛔");
async function pngDataUrl(svg: string | null): Promise<string | null> {
  if (!svg) return null;
  const buf = await sharp(Buffer.from(svg), { density: 200 }).flatten({ background: "white" }).png().toBuffer();
  return `data:image/png;base64,${buf.toString("base64")}`;
}

async function main() {
  const noDb = process.argv.includes("--no-db");
  let supabase: ReturnType<typeof createServiceClient> | null = null;
  if (!noDb) { try { supabase = createServiceClient(); } catch (e) { console.warn(`(fără DB: ${(e as Error).message})`); } }

  console.log("\n════════ BUCLA DE AUTORAT — (condiție + dorit) → CAS + porți → DB ════════\n");
  let acc = 0, marked = 0, persisted = 0;
  for (const c of CASES) {
    const res = runAuthoring(c);
    const { numeric, visual, desiredMatch } = res.gates;
    const png = await pngDataUrl(res.svg);

    let persistOk = false;
    if (supabase) {
      const row = {
        slug: c.slug, condition: c.condition, desired_kind: c.desired.kind, desired_ref: c.desired.ref,
        input_kind: c.input.kind, spec_generat: res.spec, gates: res.gates, render_png: png,
        status: res.status, iteratii: res.iteratii, updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("figura_autor").upsert(row, { onConflict: "slug" });
      if (error) console.warn(`   ! persist „${c.slug}”: ${error.message}`);
      else { persistOk = true; persisted++; }
    }
    if (res.status === "auto-acceptat") acc++; else marked++;

    console.log(`${res.status === "auto-acceptat" ? "✓" : "⚑"} ${c.slug}  [${res.status}]  (${res.iteratii} iter)`);
    console.log(`    condiție        : ${c.condition.slice(0, 90)}${c.condition.length > 90 ? "…" : ""}`);
    console.log(`    constrângeri    : ${c.input.kind}`);
    console.log(`    porți numerice  : ${ICON(numeric.ok)} (${numeric.checks.filter((x) => x.pass).length}/${numeric.checks.length})`);
    console.log(`    poartă vizuală  : ${ICON(visual.ok)} (${visual.checks.map((x) => `${x.id}:${x.pass ? "·" : "✗"}`).join(" ")})`);
    console.log(`    potrivire DORIT : ${ICON(desiredMatch.ok)} (${desiredMatch.checks.map((x) => x.name?.split(" ")[0] + ":" + (x.pass ? "·" : "✗")).join(" ") || "fără descriptor"})`);
    console.log(`    persistat       : ${supabase ? (persistOk ? "DA → figura_autor" : "EȘUAT") : "skip (--no-db)"}`);
    if (res.reason) console.log(`    motiv           : ${res.reason}`);
    console.log("");
  }
  console.log(`──────── ${acc} auto-acceptate · ${marked} marcate pt. om · ${persisted} persistate ────────`);
  console.log(supabase ? "Vezi /admin/figura-autor pentru DORIT vs GENERAT alături + aprobă/respinge." : "Rulează fără --no-db pentru a persista în DB.");
}
main().catch((e) => { console.error(e); process.exit(1); });
