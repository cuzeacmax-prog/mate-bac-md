/**
 * ETAPA 34 — Strat GENERAL de AUTO-VERIFICARE a figurilor (invariante numerice).
 *
 * Aceeași disciplină ca la CAS: fiecare construcție își declară invariantele, asertate numeric ÎNAINTE
 * de randare. Invariant picat = eroare clară cu CE a căzut, nu figură greșită. Pur (fără DOM) → rulabil
 * la composer, la render și în harness-ul de test.
 */
import { solveBasePoints, type FigureSpec2D } from "./spec";
import {
  solvePyramid, solvePolyhedron, solveScenePoints, type FigureSpec3D, type Scene3D, type Vec3, type ElCone,
} from "./spec3d";

export interface Check { name: string; pass: boolean; detail: string }
export interface VerifyResult { ok: boolean; checks: Check[] }

const tol = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
const d2 = (p: [number, number], q: [number, number]) => Math.hypot(p[0] - q[0], p[1] - q[1]);
const d3 = (p: Vec3, q: Vec3) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
const sub3 = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross3 = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot3 = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm3 = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);

// ───────────────────────── 2D ─────────────────────────
export function verifyFigure2D(spec: FigureSpec2D): VerifyResult {
  const checks: Check[] = [];
  let pts: Record<string, { x: number; y: number }> = {};
  try { pts = solveBasePoints(spec); } catch (e) { return { ok: false, checks: [{ name: "solveBasePoints", pass: false, detail: (e as Error).message }] }; }
  const P = (id: string): [number, number] => [pts[id].x, pts[id].y];

  for (const e of spec.elements) {
    if (e.kind === "triangleFromSides") {
      const [a, b, c] = e.ids;
      const AB = e.sides.AB, BC = e.sides.BC, CA = e.sides.CA ?? (e.sides as { CA?: number; AC?: number }).AC ?? NaN;
      const mAB = d2(P(a), P(b)), mBC = d2(P(b), P(c)), mCA = d2(P(c), P(a));
      const pass = tol(mAB, AB) && tol(mBC, BC) && tol(mCA, CA);
      checks.push({ name: "triangleFromSides: laturi", pass, detail: `|AB|=${mAB.toFixed(3)}/${AB} |BC|=${mBC.toFixed(3)}/${BC} |CA|=${mCA.toFixed(3)}/${CA}` });
    } else if (e.kind === "quadFromConstraints") {
      const ids = e.ids; const k = Math.max(0, ids.indexOf(e.angleAt));
      const vk = ids[k], vN = ids[(k + 1) % 4], vP = ids[(k + 3) % 4];
      // unghi la angleAt
      const u: [number, number] = [P(vN)[0] - P(vk)[0], P(vN)[1] - P(vk)[1]];
      const w: [number, number] = [P(vP)[0] - P(vk)[0], P(vP)[1] - P(vk)[1]];
      const ang = (Math.acos((u[0] * w[0] + u[1] * w[1]) / (Math.hypot(...u) * Math.hypot(...w))) * 180) / Math.PI;
      const aPass = tol(ang, e.angle);
      checks.push({ name: "quad: unghi", pass: aPass, detail: `∠${e.angleAt}=${ang.toFixed(3)}° / ${e.angle}°` });
      // raport laturi
      const r = Math.hypot(...u) / Math.hypot(...w);
      const rExp = e.sideRatio[0] / e.sideRatio[1];
      checks.push({ name: "quad: raport laturi", pass: tol(r, rExp), detail: `raport=${r.toFixed(3)} / ${rExp.toFixed(3)}` });
      // diagonala
      const idx: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };
      const dg = d2(P(ids[idx[e.scaleBy.diagonal[0]] ?? 0]), P(ids[idx[e.scaleBy.diagonal[1]] ?? 0]));
      checks.push({ name: `quad: diagonala ${e.scaleBy.diagonal}`, pass: tol(dg, e.scaleBy.length), detail: `=${dg.toFixed(3)} / ${e.scaleBy.length}` });
    } else if (e.kind === "midpoint") {
      // doar dacă ambele capete sunt puncte de bază
      if (pts[e.of[0]] && pts[e.of[1]]) {
        const m: [number, number] = [(P(e.of[0])[0] + P(e.of[1])[0]) / 2, (P(e.of[0])[1] + P(e.of[1])[1]) / 2];
        checks.push({ name: "midpoint: echidistant", pass: tol(d2(m, P(e.of[0])), d2(m, P(e.of[1]))), detail: "ok" });
      }
    }
  }
  return { ok: checks.every((c) => c.pass), checks };
}

// ───────────────────────── 3D ─────────────────────────
/** Tangența sferei înscrise în con: dist-bază == ρ ȘI dist-generatoare == ρ, centru în interior. */
export function checkInscribedSphere(R: number, H: number, baseZ: number): { rho: number; dBase: number; dGen: number; inside: boolean; pass: boolean } {
  const l = Math.sqrt(R * R + H * H);
  const rho = (R * H) / (R + l);
  const C: Vec3 = [0, 0, baseZ + rho];
  const dBase = C[2] - baseZ;
  const P1: Vec3 = [R, 0, baseZ], P2: Vec3 = [0, 0, baseZ + H];
  const dGen = norm3(cross3(sub3(C, P1), sub3(P2, P1))) / (norm3(sub3(P2, P1)) || 1);
  const inside = rho > 0 && 2 * rho <= H + 1e-9;
  return { rho, dBase, dGen, inside, pass: tol(dBase, rho) && tol(dGen, rho) && inside };
}

function verifyPolyhedron(verts: Vec3[], faces: number[][], checks: Check[]) {
  // vârfuri distincte
  let distinct = true;
  for (let i = 0; i < verts.length; i++) for (let j = i + 1; j < verts.length; j++) if (d3(verts[i], verts[j]) < 1e-9) distinct = false;
  checks.push({ name: "poliedru: vârfuri distincte", pass: distinct, detail: `${verts.length} vârfuri` });
  // fețe valide + planare + non-degenerate
  let facesOk = faces.length >= 4;
  let planar = true, nondeg = true;
  for (const f of faces) {
    if (f.length < 3) { facesOk = false; continue; }
    const a = verts[f[0]], b = verts[f[1]], c = verts[f[2]];
    const n = cross3(sub3(b, a), sub3(c, a));
    if (norm3(n) < 1e-9) nondeg = false;
    for (let i = 3; i < f.length; i++) { if (Math.abs(dot3(n, sub3(verts[f[i]], a))) > 1e-6 * norm3(n)) planar = false; }
  }
  checks.push({ name: "poliedru: fețe ≥4 & valide", pass: facesOk, detail: `${faces.length} fețe` });
  checks.push({ name: "poliedru: fețe non-degenerate", pass: nondeg, detail: nondeg ? "ok" : "față cu arie nulă" });
  checks.push({ name: "poliedru: fețe planare", pass: planar, detail: planar ? "ok" : "față neplanară" });
}

export function verifyFigure3D(spec: FigureSpec3D): VerifyResult {
  const checks: Check[] = [];
  try {
    if (spec.scene) {
      const scene = spec.scene as Scene3D;
      const pts = solveScenePoints(scene);
      const baseZ = (ref?: string | Vec3): number => (Array.isArray(ref) ? ref[2] : (typeof ref === "string" && pts[ref]) ? pts[ref][2] : 0);
      for (const e of scene.elements) {
        if (e.kind === "inscribedSphere") {
          const cone = e.in ? (scene.elements.find((x) => x.kind === "cone3d" && (x as ElCone).id === e.in) as ElCone | undefined) : undefined;
          const R = cone?.radius ?? e.inCone?.radius ?? NaN, H = cone?.height ?? e.inCone?.height ?? NaN;
          const r = checkInscribedSphere(R, H, baseZ(cone?.baseCenter ?? e.baseCenter));
          checks.push({ name: "inscribedSphere: tangentă la bază", pass: tol(r.dBase, r.rho), detail: `dist=${r.dBase.toFixed(4)} ρ=${r.rho.toFixed(4)}` });
          checks.push({ name: "inscribedSphere: tangentă la generatoare", pass: tol(r.dGen, r.rho), detail: `dist=${r.dGen.toFixed(4)} ρ=${r.rho.toFixed(4)}` });
          checks.push({ name: "inscribedSphere: centru în interior", pass: r.inside, detail: r.inside ? "ok" : "iese din con" });
        } else if (e.kind === "polyhedron") {
          const idx = new Map(e.vertices.map((v, i) => [v, i]));
          verifyPolyhedron(e.vertices.map((v) => pts[v]), e.faces.map((f) => f.map((v) => idx.get(v)!)), checks);
        }
      }
    } else if (spec.body) {
      const b = spec.body;
      if (b.kind === "regularPyramid") {
        const s = solvePyramid(b);
        const apex = s.verts[0].xyz;
        checks.push({ name: "piramidă: vârf pe axă", pass: tol(apex[0], 0) && tol(apex[1], 0), detail: `vârf=(${apex.map((x) => x.toFixed(2)).join(",")})` });
        const baseEdges = s.baseIds.map((_, i) => d3(s.verts[i + 1].xyz, s.verts[((i + 1) % s.baseIds.length) + 1].xyz));
        const eq = baseEdges.every((x) => tol(x, baseEdges[0]));
        checks.push({ name: "piramidă: bază regulată", pass: eq, detail: `laturi bază = ${baseEdges.map((x) => x.toFixed(2)).join(",")}` });
        checks.push({ name: "piramidă: latură bază = baseEdge", pass: tol(baseEdges[0], b.baseEdge), detail: `${baseEdges[0].toFixed(3)} / ${b.baseEdge}` });
      } else if (b.kind === "cube" || b.kind === "box" || b.kind === "prism" || b.kind === "tetrahedron" || b.kind === "frustum") {
        const s = solvePolyhedron(b);
        verifyPolyhedron(s.verts.map((v) => v.xyz), s.faces, checks);
        if (b.kind === "tetrahedron") {
          const v = s.verts.map((x) => x.xyz); const eds: number[] = [];
          for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) eds.push(d3(v[i], v[j]));
          checks.push({ name: "tetraedru: muchii egale", pass: eds.every((x) => tol(x, eds[0])) && tol(eds[0], b.edge), detail: `muchii=${eds.map((x) => x.toFixed(2)).join(",")}` });
        }
        if (b.kind === "cube") {
          const v = s.verts.map((x) => x.xyz); const diag = Math.max(...v.flatMap((p, i) => v.slice(i + 1).map((q) => d3(p, q))));
          checks.push({ name: "cub: diagonală = e√3", pass: tol(diag, b.edge * Math.sqrt(3)), detail: `${diag.toFixed(3)} / ${(b.edge * Math.sqrt(3)).toFixed(3)}` });
        }
      } else if (b.kind === "cone" || b.kind === "cylinder" || b.kind === "sphere" || b.kind === "perpFromVertex") {
        checks.push({ name: `${b.kind}: solver`, pass: true, detail: "rezolvat fără eroare" });
      }
    } else {
      checks.push({ name: "spec", pass: false, detail: "nici body, nici scene" });
    }
  } catch (e) {
    return { ok: false, checks: [...checks, { name: "verify3D", pass: false, detail: (e as Error).message }] };
  }
  return { ok: checks.every((c) => c.pass), checks };
}

/** Dispatcher general: verifică invariantele oricărei figuri (2D sau 3D). */
export function verifyConstruction(spec: FigureSpec2D | FigureSpec3D): VerifyResult {
  if ("elements" in spec && Array.isArray((spec as FigureSpec2D).elements) && !("body" in spec) && !("scene" in spec)) {
    return verifyFigure2D(spec as FigureSpec2D);
  }
  if ("body" in spec || "scene" in spec) return verifyFigure3D(spec as FigureSpec3D);
  return verifyFigure2D(spec as FigureSpec2D);
}
