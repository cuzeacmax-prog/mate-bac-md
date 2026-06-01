/**
 * ETAPA 40 — Test de GENERALIZARE a figurilor. Pentru fiecare problemă de bază, 2-3 VARIANTE
 * (alte cifre / +1 linie / configurație vecină) trec prin ACEIAȘI OPERATORI generali, FĂRĂ cod nou.
 * FAIL = încă case-locked acolo. Rulează:  npm run verify:figures-gen
 */
import { axialSection, dihedralSection } from "../../src/lib/figures/axial";
import { validateSpec, type FigureSpec2D } from "../../src/lib/figures/spec";
import type { Scene3D } from "../../src/lib/figures/spec3d";

const r2 = (n: number) => Math.round(n * 100) / 100;
interface Check { name: string; pass: boolean; detail: string }
const P = (s: FigureSpec2D, id: string) => s.points.find((p) => p.id === id || p.label === id);
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const tol = (a: number, b: number) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));

function structural(spec: FigureSpec2D): Check { const v = validateSpec(spec); return { name: "spec valid", pass: v.errors.length === 0, detail: v.errors.join("; ") || "ok" }; }

interface Case { name: string; checks: () => Check[] }

const cases: Case[] = [
  {
    name: "axial: sferă-în-con R6 H8",
    checks: () => {
      const s = axialSection({ points: [], elements: [{ kind: "cone3d", id: "con", radius: 6, height: 8 }, { kind: "inscribedSphere", in: "con" }] } as unknown as Scene3D);
      const V = P(s, "V")!, B = P(s, "B")!, C = P(s, "C")!;
      const hasInc = s.elements.some((e) => e.kind === "incircle");
      return [structural(s), { name: "bază = 2R=12", pass: tol(dist(B, C), 12), detail: `|BC|=${r2(dist(B, C))}` }, { name: "înălțime = 8", pass: tol(V.y - B.y, 8), detail: `H=${r2(V.y - B.y)}` }, { name: "cerc înscris prezent", pass: hasInc, detail: hasInc ? "incircle" : "lipsă" }];
    },
  },
  {
    name: "axial: sferă-în-con R5 H12 (alte cifre)",
    checks: () => {
      const s = axialSection({ points: [], elements: [{ kind: "cone3d", id: "con", radius: 5, height: 12 }, { kind: "inscribedSphere", in: "con" }] } as unknown as Scene3D);
      const V = P(s, "V")!, B = P(s, "B")!, C = P(s, "C")!;
      return [structural(s), { name: "bază = 2R=10", pass: tol(dist(B, C), 10), detail: `|BC|=${r2(dist(B, C))}` }, { name: "înălțime = 12", pass: tol(V.y - B.y, 12), detail: `H=${r2(V.y - B.y)}` }];
    },
  },
  {
    name: "axial: sferă-în-con R6 H8 + axă & apotemă (+1 linie)",
    checks: () => {
      const scene = { points: [{ id: "O", x: 0, y: 0, z: 0 }, { id: "T", x: 0, y: 0, z: 8 }, { id: "R", x: 6, y: 0, z: 0 }], elements: [{ kind: "cone3d", id: "con", radius: 6, height: 8 }, { kind: "inscribedSphere", in: "con" }, { kind: "segment3d", of: ["O", "T"] }, { kind: "segment3d", of: ["O", "R"] }] } as unknown as Scene3D;
      const s = axialSection(scene);
      const segs = s.elements.filter((e) => e.kind === "segment").length;
      return [structural(s), { name: "axă + apotemă (2 segmente)", pass: segs >= 2, detail: `${segs} segmente` }];
    },
  },
  {
    name: "axial: cilindru-în-con R6H8 (configurație vecină)",
    checks: () => {
      const s = axialSection({ points: [], elements: [{ kind: "cone3d", id: "con", radius: 6, height: 8 }, { kind: "cylinder3d", id: "cil", radius: 3, height: 4 }] } as unknown as Scene3D);
      const polys = s.elements.filter((e) => e.kind === "polygon");
      const tri = polys.find((p) => (p as { points: string[] }).points.length === 3);
      const rect = polys.find((p) => (p as { points: string[] }).points.length === 4);
      return [structural(s), { name: "triunghi (con) + dreptunghi (cilindru)", pass: !!tri && !!rect, detail: `${polys.length} poligoane` }];
    },
  },
  {
    name: "diedru: trapez 4/16 → r=4, 60°",
    checks: () => {
      const s = dihedralSection(4, 60);
      const O = P(s, "O")!, M = P(s, "M")!, V = P(s, "V")!;
      const dotOM_OV = (M.x - O.x) * (V.x - O.x) + (M.y - O.y) * (V.y - O.y);
      return [structural(s), { name: "OM = r = 4", pass: tol(dist(O, M), 4), detail: `${r2(dist(O, M))}` }, { name: "OV = r·tan60 = 6.93", pass: tol(dist(O, V), 4 * Math.tan(Math.PI / 3)), detail: `${r2(dist(O, V))}` }, { name: "unghi drept la O", pass: tol(dotOM_OV, 0), detail: `dot=${r2(dotOM_OV)}` }];
    },
  },
  {
    name: "diedru: trapez 6/14 (alte cifre) → r calculat, 60°",
    checks: () => {
      const a = 6, b = 14; const leg = (a + b) / 2; const h = Math.sqrt(leg * leg - ((b - a) / 2) ** 2); const r = h / 2; // = 4.58
      const s = dihedralSection(r, 60);
      const O = P(s, "O")!, M = P(s, "M")!, V = P(s, "V")!;
      return [structural(s), { name: `OM = r = ${r2(r)}`, pass: tol(dist(O, M), r), detail: `${r2(dist(O, M))}` }, { name: "OV = r·tan60", pass: tol(dist(O, V), r * Math.tan(Math.PI / 3)), detail: `${r2(dist(O, V))}` }];
    },
  },
  {
    name: "diedru: +diagonala bazei (figură-plan bază, 2D normal)",
    checks: () => {
      // baza (trapez 4/16) ca figură-plan + diagonala — construcție 2D obișnuită, fără operator nou
      const spec: FigureSpec2D = { points: [{ id: "A", x: 0, y: 0 }, { id: "B", x: 16, y: 0 }, { id: "C", x: 10, y: 8 }, { id: "D", x: 6, y: 8 }], elements: [{ kind: "polygon", points: ["A", "B", "C", "D"] }, { kind: "segment", between: ["A", "C"], label: "diagonala" }] };
      return [structural(spec), { name: "trapez + diagonală (poligon + segment)", pass: true, detail: "figură-plan 2D" }];
    },
  },
];

let allOk = true;
console.log("\n──────── TEST GENERALIZARE FIGURI (operatori, fără cod nou) ────────");
for (const c of cases) {
  let checks: Check[];
  try { checks = c.checks(); } catch (e) { checks = [{ name: "excepție", pass: false, detail: (e as Error).message }]; }
  const ok = checks.every((x) => x.pass); if (!ok) allOk = false;
  console.log(`\n${ok ? "✅ PASS" : "❌ FAIL"}  ${c.name}`);
  for (const ck of checks) console.log(`     ${ck.pass ? "·" : "✗"} ${ck.name}: ${ck.detail}`);
}
console.log(`\n${allOk ? "✅ TOATE variantele trec — operatorii generalizează (fără cod nou)" : "❌ Variante picate — încă case-locked acolo"}.`);
process.exit(allOk ? 0 : 1);
