/**
 * ETAPA 41 — Probă GEOMETRY CAS pe enunțurile testate. Fiecare enunț → constrângeri (ZERO coordonate)
 * → solver (toate punctele prin formule) → AUTO-VERIFICARE că reproduce FIECARE număr dat → accept/reject.
 *
 * Vrem: ACCEPTĂ figurile corecte, RESPINGE automat orice inconsistență — fără ochi umani.
 * Include un CONTROL NEGATIV (numere imposibile) care TREBUIE respins.   Rulează:  npm run verify:geo-cas
 */
import { solveAndVerify, type GeoProblem } from "../../src/lib/figures/cas";

interface Probe { titlu: string; enunt: string; prob: GeoProblem; trebuieAcceptat: boolean }

// Numere DATE precise (irraționale calculate exact, nu rotunjite — toleranța e 1e-9).
const RHO_R6H8 = (6 * 8) / (6 + Math.hypot(6, 8)); // = 3, raza cercului înscris în secțiunea axială
const SLANT_R6H8 = Math.hypot(6, 8);   // generatoarea conului = 10
const H_DIEDRU = 4 * Math.tan(Math.PI / 3); // r·tan60 pentru apotema 4

const probes: Probe[] = [
  {
    titlu: "Sferă înscrisă în con (secțiune axială): R=6, H=8",
    enunt: "Un con are raza bazei 6 și înălțimea 8. Sfera înscrisă. Secțiunea axială: triunghi isoscel + cercul înscris tangent.",
    prob: {
      build: [
        { op: "isoFromBaseHeight", apex: "V", left: "B", right: "C", base: 12, height: 8 },
        { op: "center", id: "I", kind: "incenter", tri: ["V", "B", "C"] },
      ],
      givens: [
        { kind: "length", of: ["B", "C"], value: 12 },          // bază = 2R
        { kind: "length", of: ["V", "B"], value: SLANT_R6H8 },  // generatoarea = √(R²+H²) = 10
        { kind: "length", of: ["V", "C"], value: SLANT_R6H8 },
        { kind: "incircleRadius", tri: ["V", "B", "C"], value: RHO_R6H8 }, // ρ = R·H/(R+√(R²+H²)) = 3
      ],
    },
    trebuieAcceptat: true,
  },
  {
    titlu: "Unghi diedru la bază (secțiune triunghi dreptunghic): apotemă 4, diedru 60°",
    enunt: "Piramidă cu apotema bazei 4 și unghi diedru la bază 60°. Secțiunea perpendiculară pe muchie: triunghiul dreptunghic VOM.",
    prob: {
      build: [
        { op: "rightTriangle", right: "O", legEnd: "M", vert: "V", leg: 4, angleAtLegEnd: 60 },
      ],
      givens: [
        { kind: "length", of: ["O", "M"], value: 4 },        // apotema
        { kind: "rightAngle", at: "O", rays: ["M", "V"] },   // unghi drept la O
        { kind: "angle", at: "M", rays: ["O", "V"], value: 60 }, // diedrul
        { kind: "length", of: ["O", "V"], value: H_DIEDRU }, // H = r·tan60
      ],
    },
    trebuieAcceptat: true,
  },
  {
    titlu: "Triunghi isoscel + bisectoarea din A: AB=AC=26, BC=20, bisectoarea taie BC în M",
    enunt: "Triunghi isoscel ABC cu AB=AC=26, BC=20. Bisectoarea din A taie BC în M.",
    prob: {
      build: [
        { op: "triangleSSS", ids: ["A", "B", "C"], ab: 26, bc: 20, ca: 26 },
        { op: "bisectorFoot", id: "M", tri: ["A", "B", "C"], from: "A" },
      ],
      givens: [
        { kind: "length", of: ["A", "B"], value: 26 },
        { kind: "length", of: ["A", "C"], value: 26 },
        { kind: "length", of: ["B", "C"], value: 20 },
        { kind: "length", of: ["B", "M"], value: 10 }, // bisectoarea = mediană în isoscel → M mijloc
        { kind: "rightAngle", at: "M", rays: ["A", "B"] }, // AM ⟂ BC (consecință verificată)
      ],
    },
    trebuieAcceptat: true,
  },
  {
    titlu: "Paralelogram ABCD: ∠A=60°, AB:AD=1:2, BD=3",
    enunt: "Paralelogram ABCD cu ∠A=60°, AB:AD=1:2 și diagonala BD=3.",
    prob: {
      build: [
        { op: "parallelogram", ids: ["A", "B", "C", "D"], angleAt: "A", angle: 60, sideRatio: [1, 2], scaleBy: { diagonal: "BD", length: 3 } },
      ],
      givens: [
        { kind: "angle", at: "A", rays: ["B", "D"], value: 60 },
        { kind: "length", of: ["B", "D"], value: 3 },
        { kind: "ratio", of: [["A", "B"], ["A", "D"]], value: 0.5 },
      ],
    },
    trebuieAcceptat: true,
  },
  {
    titlu: "CONTROL NEGATIV: triunghi 26/20/26 dar se PRETINDE BC=21 (inconsistent)",
    enunt: "Aceeași construcție, dar enunțul pretinde un număr pe care figura NU îl poate reproduce.",
    prob: {
      build: [{ op: "triangleSSS", ids: ["A", "B", "C"], ab: 26, bc: 20, ca: 26 }],
      givens: [
        { kind: "length", of: ["A", "B"], value: 26 },
        { kind: "length", of: ["B", "C"], value: 21 }, // GREȘIT: construit 20 → trebuie RESPINS
      ],
    },
    trebuieAcceptat: false,
  },
];

let allOk = true;
console.log("\n════════ GEOMETRY CAS — constrângeri → solver → auto-verificare ════════\n");
for (const pr of probes) {
  const res = solveAndVerify(pr.prob);
  const correct = res.accepted === pr.trebuieAcceptat;
  if (!correct) allOk = false;
  const verdict = res.accepted ? "ACCEPTATĂ ✅" : "RESPINSĂ ⛔";
  const meta = correct ? "(corect)" : "(GREȘIT — poarta nu funcționează)";
  console.log(`${correct ? "✓" : "✗"} ${pr.titlu}`);
  console.log(`    enunț: ${pr.enunt}`);
  console.log(`    constrângeri: ${pr.prob.build.map((b) => b.op).join(" → ")}`);
  if (res.checks.length) for (const c of res.checks) console.log(`      ${c.pass ? "·" : "✗"} ${c.name}: ${c.detail}`);
  if (res.reason) console.log(`      ↳ ${res.reason}`);
  console.log(`    → ${verdict} ${meta}\n`);
}
console.log(allOk
  ? "✅ TOATE corecte: figurile valide ACCEPTATE, inconsistențele RESPINSE — fără ochi umani."
  : "❌ Poarta CAS nu se comportă corect pe unele cazuri.");
process.exit(allOk ? 0 : 1);
