/**
 * ETAPA 50→52 — Probă: construcția DERIVĂ din TIPURILE DE RELAȚIE/OBIECT extrase de CAS (nu inventată per
 * exercițiu, nu din exercise_concept_link). Pentru fiecare caz: triggere → tipare (PATTERNS) → categorii cerute;
 * figura produsă de CAS trebuie să CONȚINĂ acele categorii (poarta STRUCTURALĂ).  npm run verify:construction
 */
import { solveAndVerify3D, type GeoProblem3D } from "../../src/lib/figures/cas";
import { coneSectionScene } from "../../src/lib/figures/relations";
import { resolveInput } from "../../scripts/figures/authoring-registry";
import { checkConstruction, requiredFor } from "../../src/lib/figures/construction-patterns";
import { extractTriggers } from "../../src/lib/figures/relation-trigger";
import type { FigureSpec3D } from "../../src/lib/figures/spec3d";

interface Probe { titlu: string; triggers: string[]; spec: FigureSpec3D | null; reason?: string }

function geo3d(p: GeoProblem3D): { spec: FigureSpec3D | null; reason?: string } {
  const r = solveAndVerify3D(p);
  return { spec: r.spec ?? null, reason: r.accepted ? undefined : r.reason };
}

const probes: Probe[] = [];

// 1) cuboid + diedru — triggere EXTRASE din structura CAS (obj:cuboid + rel:angle(plane,plane))
{
  const r = resolveInput("Paralelipiped dreptunghic ABCDA1B1C1D1 cu AB=8 cm, BC=4 cm; unghiul dintre planele (A1BC) si (ABC) este 45°.");
  const g = r && r.input.kind === "geo3d" ? geo3d(r.input.problem) : { spec: null };
  probes.push({ titlu: "cuboid diedru 45° (AB=8, BC=4)", triggers: r ? extractTriggers(r.input) : [], spec: g.spec, reason: g.reason });
}
// 2) prismă regulată + triunghi dreptunghic (mijloc) — obj:prism-regular + rel:right-triangle
{
  const g = geo3d({
    build: [{ op: "regularPrism", bottom: ["A", "B", "C"], top: ["A1", "B1", "C1"], sides: 3, baseEdge: 4 * Math.sqrt(3), height: 8 }, { op: "midpoint3", id: "M", of: ["A", "B"] }],
    solid: { bottom: ["A", "B", "C"], top: ["A1", "B1", "C1"] },
    draw: { segments: [{ of: ["C", "M"] }, { of: ["C1", "M"], label: "10" }, { of: ["C1", "C"], label: "8" }], rightAngles3d: [{ at: "C", from: ["M", "C1"] }] },
    givens: [{ kind: "length3", of: ["C1", "C"], value: 8 }, { kind: "length3", of: ["C1", "M"], value: 10 }],
  });
  probes.push({ titlu: "prismă C₁M=10, C₁C=8 (triunghi dreptunghic C₁CM)", triggers: ["obj:prism-regular", "rel:right-triangle"], spec: g.spec, reason: g.reason });
}
// 3) con-secțiune (plan paralel) — rel:parallel-section(cone)
probes.push({ titlu: "con-secțiune (plan ∥ bază)", triggers: ["rel:parallel-section(cone)"], spec: { scene: coneSectionScene(3, 6, { rel: "distanceApexToParallelPlane", value: 2 })! } });
// 4) piramidă regulată + apotemă — obj:pyramid-regular
{
  const g = geo3d({
    build: [{ op: "regularPyramidPts", base: ["A", "B", "C", "D"], apex: "V", sides: 4, baseEdge: 6, height: 7 }, { op: "midpoint3", id: "O", of: ["A", "C"] }, { op: "midpoint3", id: "M", of: ["A", "B"] }],
    solid: { base: ["A", "B", "C", "D"], apex: "V" },
    draw: { segments: [{ of: ["V", "O"], dashed: true, label: "H" }, { of: ["O", "M"], label: "a" }, { of: ["V", "M"] }], rightAngles3d: [{ at: "O", from: ["M", "V"] }] },
    givens: [{ kind: "length3", of: ["O", "M"], value: 3 }, { kind: "length3", of: ["V", "O"], value: 7 }],
  });
  probes.push({ titlu: "piramidă apotemă (O centru, OM apotemă, VO înălțime)", triggers: ["obj:pyramid-regular"], spec: g.spec, reason: g.reason });
}

let allOk = true;
console.log("\n════════ CONSTRUCȚIA DIN TIPUL DE RELAȚIE/OBIECT — poartă STRUCTURALĂ ════════\n");
for (const p of probes) {
  if (!p.spec) { allOk = false; console.log(`✗ ${p.titlu}: figura nu s-a produs (${p.reason ?? "?"})\n`); continue; }
  const { patterns } = requiredFor(p.triggers);
  const chk = checkConstruction(p.spec, p.triggers);
  if (!chk.ok) allOk = false;
  console.log(`${chk.ok ? "✓" : "✗"} ${p.titlu}`);
  console.log(`    triggere extrase  : ${p.triggers.join(", ")}`);
  console.log(`    tipare aplicate   : ${patterns.map((t) => t.title).join(" + ")}`);
  console.log(`    construcție cerută : ${chk.required.join(", ")}`);
  console.log(`    prezentă în figură : ${chk.present.join(", ")}`);
  console.log(`    → ${chk.ok ? "COMPLET (construcție prezentă)" : `LIPSĂ: ${chk.missing.join(", ")}`}\n`);
}

// CONTROL NEGATIV: cuboid fără marcajul diedrului → poarta structurală PICĂ (cere dihedralMark).
{
  const r = resolveInput("Paralelipiped dreptunghic ABCDA1B1C1D1 cu AB=8 cm, BC=4 cm; unghiul dintre planele (A1BC) si (ABC) este 45°.");
  const g = r && r.input.kind === "geo3d" ? geo3d(r.input.problem) : { spec: null };
  if (g.spec?.scene && r) {
    const stripped: FigureSpec3D = { scene: { points: g.spec.scene.points, elements: g.spec.scene.elements.filter((e) => e.kind !== "angle3d") } };
    const chk = checkConstruction(stripped, extractTriggers(r.input));
    const caught = !chk.ok && chk.missing.includes("dihedralMark");
    if (!caught) allOk = false;
    console.log(`${caught ? "✓" : "✗"} CONTROL: cuboid FĂRĂ diedru marcat → poarta ${caught ? "PRINDE (lipsă: " + chk.missing.join(",") + ")" : "NU prinde ✗"}\n`);
  }
}

console.log(allOk
  ? "✅ Construcția vine din TIPURILE DE RELAȚIE/OBIECT extrase de CAS, asamblate din tipare; poarta cere construcția prezentă."
  : "❌ Construcția din relații / poarta structurală nu funcționează.");
process.exit(allOk ? 0 : 1);
