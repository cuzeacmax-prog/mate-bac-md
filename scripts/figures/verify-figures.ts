/**
 * ETAPA 34 — Harness de auto-verificare a figurilor. Rulează un set reprezentativ prin stratul de
 * invariante (verifyFigure2D/3D) și tipărește un tabel PASS/FAIL. Regresiile se prind AICI, nu pe ecran.
 *
 * Rulează:  npm run verify:figures
 */
import { verifyFigure2D, verifyFigure3D, checkInscribedSphere, type VerifyResult } from "../../src/lib/figures/verify";
import type { FigureSpec2D } from "../../src/lib/figures/spec";
import type { FigureSpec3D } from "../../src/lib/figures/spec3d";

interface Case { name: string; run: () => VerifyResult }

const cases: Case[] = [
  {
    name: "2D triunghi (6,7,8) + cerc înscris",
    run: () => verifyFigure2D({ points: [], elements: [
      { kind: "triangleFromSides", ids: ["A", "B", "C"], sides: { AB: 6, BC: 7, CA: 8 } },
      { kind: "polygon", points: ["A", "B", "C"] }, { kind: "incircle", of: ["A", "B", "C"] },
    ] } as FigureSpec2D),
  },
  {
    name: "2D paralelogram (∠A=60°, 1:2, BD=3) + pointOnSegment",
    run: () => verifyFigure2D({ points: [], elements: [
      { kind: "quadFromConstraints", ids: ["A", "B", "C", "D"], angleAt: "A", angle: 60, sideRatio: [1, 2], scaleBy: { diagonal: "BD", length: 3 } },
      { kind: "pointOnSegment", on: ["A", "B"], ratio: 0.5, id: "M" },
    ] } as FigureSpec2D),
  },
  {
    name: "3D sferă înscrisă în con (R6 H8) [trebuie să TREACĂ după ETAPA 33]",
    run: () => verifyFigure3D({ scene: { points: [], elements: [
      { kind: "cone3d", id: "con", radius: 6, height: 8 }, { kind: "inscribedSphere", in: "con" },
    ] } } as unknown as FigureSpec3D),
  },
  {
    name: "3D piramidă patrulateră regulată (24,12)",
    run: () => verifyFigure3D({ body: { kind: "regularPyramid", baseSides: 4, baseEdge: 24, height: 12 } } as FigureSpec3D),
  },
  {
    name: "3D cub (5)",
    run: () => verifyFigure3D({ body: { kind: "cube", edge: 5 } } as FigureSpec3D),
  },
  {
    name: "3D poliedru compus (piramidă bază dreptunghi 6×4 h10)",
    run: () => verifyFigure3D({ scene: { points: [
      { id: "A", x: -3, y: -2, z: 0 }, { id: "B", x: 3, y: -2, z: 0 }, { id: "C", x: 3, y: 2, z: 0 }, { id: "D", x: -3, y: 2, z: 0 },
      { gen: "pointOnAxis", id: "V", height: 10, overCentroidOf: ["A", "B", "C", "D"] },
    ], elements: [{ kind: "polyhedron", vertices: ["A", "B", "C", "D", "V"], faces: [["A", "B", "C", "D"], ["A", "B", "V"], ["B", "C", "V"], ["C", "D", "V"], ["D", "A", "V"]] }] } } as unknown as FigureSpec3D),
  },
  {
    name: "CONTROL NEGATIV: sferă cu centrul GREȘIT (lângă vârf) — TREBUIE FAIL",
    run: () => {
      // sferă de rază ρ pusă la z=H−ρ (sus): asertăm tangențele — trebuie să PICE.
      const R = 6, H = 8; const { rho } = checkInscribedSphere(R, H, 0);
      const zWrong = H - rho; const C: [number, number, number] = [0, 0, zWrong];
      const dBase = C[2];
      const P1: [number, number, number] = [R, 0, 0], P2: [number, number, number] = [0, 0, H];
      const u = [C[0] - P1[0], C[1] - P1[1], C[2] - P1[2]] as [number, number, number];
      const v = [P2[0] - P1[0], P2[1] - P1[1], P2[2] - P1[2]] as [number, number, number];
      const cr = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const dGen = Math.hypot(...cr) / Math.hypot(...v);
      const t = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
      return { ok: t(dBase, rho) && t(dGen, rho), checks: [
        { name: "tangentă bază", pass: t(dBase, rho), detail: `dist=${dBase.toFixed(3)} ρ=${rho.toFixed(3)}` },
        { name: "tangentă generatoare", pass: t(dGen, rho), detail: `dist=${dGen.toFixed(3)} ρ=${rho.toFixed(3)}` },
      ] };
    },
  },
];

let allOk = true;
console.log("\n──────── HARNESS AUTO-VERIFICARE FIGURI ────────");
for (const c of cases) {
  const expectFail = c.name.includes("CONTROL NEGATIV");
  let r: VerifyResult;
  try { r = c.run(); } catch (e) { r = { ok: false, checks: [{ name: "excepție", pass: false, detail: (e as Error).message }] }; }
  const verdict = expectFail ? (!r.ok ? "PASS (a picat corect)" : "FAIL (ar fi trebuit să pice!)") : (r.ok ? "PASS" : "FAIL");
  const good = expectFail ? !r.ok : r.ok;
  if (!good) allOk = false;
  console.log(`\n${good ? "✅" : "❌"} ${verdict.padEnd(22)} ${c.name}`);
  for (const ck of r.checks) console.log(`     ${ck.pass ? "·" : "✗"} ${ck.name}: ${ck.detail}`);
}
console.log(`\n${allOk ? "✅ TOATE corecte (poarta funcționează)" : "❌ Au picat cazuri — vezi mai sus"}.`);
process.exit(allOk ? 0 : 1);
