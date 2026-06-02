/**
 * ETAPA 44 — Probă POARTĂ VIZUALĂ pe lot mic. Pentru fiecare figură: checklist structurat PASS pe randarea
 * corectă; apoi INJECTEZ defectul de randare văzut (etichete împrăștiate, +1 linie lipsă, triunghi gol/turtit,
 * orientare răsturnată) și arăt că poarta îl PRINDE; apoi „repar" (desenul corect) → PASS.
 * Rulează:  npm run verify:visual-gate
 */
import { axialSection, dihedralSection } from "../../src/lib/figures/axial";
import { coneSectionScene } from "../../src/lib/figures/relations";
import { renderToDrawing } from "../../src/lib/figures/render-svg";
import { structuredVisualChecks } from "../../src/lib/figures/visual-gate";
import type { Drawing2D } from "../../src/lib/figures/project";
import type { Scene3D } from "../../src/lib/figures/spec3d";
import type { FigureSpec2D, FigureSpec3D } from "../../src/lib/figures/spec";

// ── lotul de probă ──
const sphereInCone: FigureSpec2D = axialSection({ points: [], elements: [{ kind: "cone3d", id: "con", radius: 5, height: 12 }, { kind: "inscribedSphere", in: "con" }] } as unknown as Scene3D);
const dihedral: FigureSpec2D = dihedralSection(4, 60);
const coneSection: FigureSpec3D = { scene: coneSectionScene(3, 6, { rel: "distanceApexToParallelPlane", value: 2 })! };
const pyramid: FigureSpec3D = { body: { kind: "regularPyramid", baseSides: 4, baseEdge: 6, height: 7 } };

const batch: Array<{ nume: string; spec: FigureSpec2D | FigureSpec3D }> = [
  { nume: "con-secțiune (pictogramă 3D)", spec: coneSection },
  { nume: "sferă-în-con (secțiune axială 2D)", spec: sphereInCone },
  { nume: "piramidă regulată (3D)", spec: pyramid },
  { nume: "diedru la bază (secțiune 2D)", spec: dihedral },
];

// ── mutatori care SIMULEAZĂ defecte de RANDARE (nu de spec) ──
const clone = (d: Drawing2D): Drawing2D => ({ polylines: d.polylines.map((p) => ({ ...p, pts: p.pts.map((q) => [...q] as [number, number]) })), labels: d.labels.map((l) => ({ ...l })), bbox: { ...d.bbox }, named: d.named ? Object.fromEntries(Object.entries(d.named).map(([k, v]) => [k, [...v] as [number, number]])) : {} });
const scatterLabel = (d: Drawing2D): Drawing2D => { const c = clone(d); const span = Math.max(c.bbox.maxX - c.bbox.minX, c.bbox.maxY - c.bbox.minY); const l = c.labels.find((x) => c.named![x.text]); if (l) { l.x += span; l.y += span; } return c; };
const dropEdge = (d: Drawing2D): Drawing2D => { const c = clone(d); if (c.polylines.length) c.polylines.splice(c.polylines.findIndex((p) => p.pts.length === 2), 1); return c; };
const flatten = (d: Drawing2D): Drawing2D => { const c = clone(d); if (c.named) for (const k of Object.keys(c.named)) c.named[k][1] = 0; c.polylines.forEach((p) => p.pts.forEach((q) => (q[1] = 0))); return c; };
const flip = (d: Drawing2D): Drawing2D => { const c = clone(d); const yc = (c.bbox.minY + c.bbox.maxY) / 2; const f = (y: number) => 2 * yc - y; if (c.named) for (const k of Object.keys(c.named)) c.named[k][1] = f(c.named[k][1]); c.labels.forEach((l) => (l.y = f(l.y))); c.polylines.forEach((p) => p.pts.forEach((q) => (q[1] = f(q[1])))); return c; };

const failed = (r: { checks: { id: string; pass: boolean; detail: string }[] }) => r.checks.filter((c) => !c.pass).map((c) => `${c.id}(${c.detail})`).join(", ");

let allOk = true;
console.log("\n════════ POARTA VIZUALĂ — checklist structurat pe DESENUL randat ════════\n");

// A) Randarea corectă a fiecărei figuri TRECE poarta.
for (const f of batch) {
  const d = renderToDrawing(f.spec);
  const r = structuredVisualChecks(f.spec, d);
  if (!r.ok) allOk = false;
  console.log(`${r.ok ? "✓" : "✗"} ${f.nume}  — ${r.checks.length} verificări: ${r.checks.map((c) => `${c.id}:${c.pass ? "PASS" : "FAIL"}`).join(" ")}`);
  if (!r.ok) console.log(`     defecte: ${failed(r)}`);
}

// B) Fiecare CLASĂ de defect de randare e PRINSĂ (pe con-secțiune / sferă-în-con), apoi reparată → PASS.
console.log("\n──────── injectare defecte de randare → poarta le PRINDE → reparare ────────");
const defects: Array<{ nume: string; spec: FigureSpec2D | FigureSpec3D; mut: (d: Drawing2D) => Drawing2D; asteptat: string }> = [
  { nume: "etichete împrăștiate", spec: pyramid, mut: scatterLabel, asteptat: "labels" },
  { nume: "linie/muchie lipsă (+1 linie)", spec: dihedral, mut: dropEdge, asteptat: "edges" },
  { nume: "triunghi gol/turtit", spec: sphereInCone, mut: flatten, asteptat: "nondegenerate" },
  { nume: "orientare răsturnată (apex jos)", spec: coneSection, mut: flip, asteptat: "orientation" },
];
for (const def of defects) {
  const good = renderToDrawing(def.spec);
  const broken = def.mut(good);
  const rBroken = structuredVisualChecks(def.spec, broken);
  const caughtRight = !rBroken.ok && rBroken.checks.some((c) => c.id === def.asteptat && !c.pass);
  const rRepaired = structuredVisualChecks(def.spec, good); // „reparat" = desenul corect
  const repairedOk = rRepaired.ok;
  const ok = caughtRight && repairedOk;
  if (!ok) allOk = false;
  console.log(`${ok ? "✓" : "✗"} ${def.nume}`);
  console.log(`     spart    : poarta ${rBroken.ok ? "NU a prins ✗" : "a PRINS ⛔"} → ${failed(rBroken) || "—"} (așteptat: ${def.asteptat})`);
  console.log(`     reparat  : poarta ${repairedOk ? "ACCEPTĂ ✅" : "încă pică ✗"}\n`);
}

console.log(allOk
  ? "✅ Poarta vizuală: randările corecte trec; fiecare clasă de defect de randare e PRINSĂ și auto-reparată."
  : "❌ Poarta vizuală nu prinde corect unele defecte.");
process.exit(allOk ? 0 : 1);
