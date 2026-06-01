/**
 * ETAPA 41 — GEOMETRY CAS: constrângeri → solver (toate punctele prin FORMULE) → AUTO-VERIFICARE.
 *
 * Principiul (cauza tuturor eșecurilor: AI-ul plasa COORDONATE):
 *   1. AI-ul emite DOAR entități + relații + numerele DATE (constrângeri). ZERO coordonate.
 *   2. SOLVER constructiv: calculează TOATE punctele prin formule închise — fiecare intersecție
 *      (dreaptă∩dreaptă, dreaptă∩cerc, cerc∩cerc), picioare de perpendiculare, mijloace, centre,
 *      bisectoare. Nimic plasat de mână; seed-ul de cadru îl alege MOTORUL.
 *   3. AUTO-VERIFICARE: măsoară figura rezolvată (lungimi, unghiuri, arii, tangențe) și verifică că
 *      REPRODUCE FIECARE număr dat (tol. relativă 1e-9). Trece DOAR dacă TOATE se potrivesc; altfel
 *      RESPINGE (nu desena) — niciodată o figură greșită.
 *   4. Dezambiguizare: reguli DETERMINISTE (care intersecție, care parte) — documentate la `pickFrom`.
 *
 * Pur (fără DOM). Ieșirea constructorului = FigureSpec2D cu puncte EXPLICITE (deja calculate), deci
 * intră direct în renderer-ul existent (care NU reîncadrează figuri cu coordonate explicite).
 */
import type { FigureSpec2D, FigureElement, FigurePoint } from "./spec";

export type Vec2 = [number, number];

/** Lungime: literal, SAU distanță măsurată între 2 puncte, SAU operații simple (fără coordonate). */
export type LenExpr = number | { dist: [string, string] } | { sum: LenExpr[] } | { scale: [LenExpr, number] };

/** Referință la o dreaptă: id de dreaptă construită SAU pereche de puncte (dreapta implicită). */
export type LineRef = string | [string, string];
/** Referință la un obiect intersectabil: id de dreaptă/cerc SAU pereche de puncte (dreaptă implicită). */
export type ObjRef = string | [string, string];

/**
 * Dezambiguizare deterministă a unei intersecții cu mai mulți candidați:
 *   "upper"/"lower" = y maxim/minim · "left"/"right" = x minim/maxim
 *   "first"/"second" = candidatul 0/1 după sortarea canonică (x crescător, apoi y crescător)
 *   {near|far: P} = cel mai apropiat/depărtat de punctul P.
 * DEFAULT (lipsă) = "upper", tie-break "right" — documentat, determinist.
 */
export type Pick = "upper" | "lower" | "left" | "right" | "first" | "second" | { near: string } | { far: string };

export type BuildStep =
  // ── SEED-uri de cadru (motorul alege coordonatele, NU AI-ul) ──
  /** Segment-bază orizontal: a=(0,0), b=(length,0). Stabilește cadrul figurii. */
  | { op: "baseSegment"; a: string; b: string; length: number }
  /** Triunghi din 3 LATURI (SSS): A=(0,0), B=(ab,0), C deasupra. Eroare la inegalitatea triunghiului. */
  | { op: "triangleSSS"; ids: [string, string, string]; ab: number; bc: number; ca: number }
  /** Triunghi isoscel din bază + înălțime, SIMETRIC față de axa y (ex. secțiune axială con). */
  | { op: "isoFromBaseHeight"; apex: string; left: string; right: string; base: number; height: number }
  /** Triunghi dreptunghic: right=(0,0) unghi drept, legEnd pe Ox la `leg`, vert pe Oy. ∠legEnd = angle. */
  | { op: "rightTriangle"; right: string; legEnd: string; vert: string; leg: number; angleAtLegEnd: number }
  /** Paralelogram din unghi + raport laturi, scalat printr-o diagonală/lungime (formulă închisă). */
  | { op: "parallelogram"; ids: [string, string, string, string]; angleAt: string; angle: number; sideRatio: [number, number]; scaleBy: { diagonal: "AC" | "BD" | "AB" | "AD"; length: number } }
  // ── PRIMITIVE constructive generale (riglă & compas) ──
  /** Cerc: centru + rază (literal/măsurată) SAU prin punct. */
  | { op: "circle"; id: string; center: string; radius?: LenExpr; through?: string }
  /** Dreaptă prin 2 puncte (referabilă prin id). */
  | { op: "line"; id: string; through: [string, string] }
  /** Perpendiculară prin P pe dreapta `to`. */
  | { op: "perpLine"; id: string; through: string; to: LineRef }
  /** Paralelă prin P la dreapta `to`. */
  | { op: "parallelLine"; id: string; through: string; to: LineRef }
  /** Punct = INTERSECȚIA a două obiecte (dreaptă/cerc), cu dezambiguizare. */
  | { op: "intersect"; id: string; of: [ObjRef, ObjRef]; pick?: Pick }
  /** Mijlocul unui segment. */
  | { op: "midpoint"; id: string; of: [string, string] }
  /** Piciorul perpendicularei din P pe dreapta (Q,R). */
  | { op: "foot"; id: string; from: string; to: [string, string] }
  /** Punct pe segment la `ratio`∈[0,1] sau la `dist` de primul capăt. */
  | { op: "onSegment"; id: string; seg: [string, string]; ratio?: number; dist?: number }
  /** Centru remarcabil al triunghiului. */
  | { op: "center"; id: string; kind: "incenter" | "circumcenter" | "centroid" | "orthocenter"; tri: [string, string, string] }
  /** Piciorul bisectoarei interne din `from` pe latura opusă (BD/DC = AB/AC). */
  | { op: "bisectorFoot"; id: string; tri: [string, string, string]; from: string };

/** Numerele DATE în enunț care trebuie REPRODUSE de figura rezolvată. */
export type Given =
  | { kind: "length"; of: [string, string]; value: number }
  | { kind: "angle"; at: string; rays: [string, string]; value: number }
  | { kind: "rightAngle"; at: string; rays: [string, string] }
  | { kind: "area"; of: string[]; value: number }
  | { kind: "incircleRadius"; tri: [string, string, string]; value: number }
  | { kind: "collinear"; points: string[] }
  | { kind: "tangent"; circle: string; line: [string, string] }
  | { kind: "ratio"; of: [[string, string], [string, string]]; value: number };

export interface GeoProblem {
  build: BuildStep[];
  givens: Given[];
  /** Desen explicit (override). Dacă lipsește, se DERIVĂ automat din build + givens. */
  draw?: {
    polygons?: string[][];
    segments?: Array<{ between: [string, string]; label?: string }>;
    circles?: Array<{ center: string; radius?: LenExpr; through?: string }>;
    incircles?: Array<[string, string, string]>;
    hideLabels?: boolean;
  };
}

// ───────────────────────── geometrie pură ─────────────────────────
const d2 = (p: Vec2, q: Vec2) => Math.hypot(p[0] - q[0], p[1] - q[1]);
const sub = (a: Vec2, b: Vec2): Vec2 => [a[0] - b[0], a[1] - b[1]];
const dot = (a: Vec2, b: Vec2) => a[0] * b[0] + a[1] * b[1];
const cross = (a: Vec2, b: Vec2) => a[0] * b[1] - a[1] * b[0];
const EPS = 1e-9;

interface Line { p: Vec2; d: Vec2 } // punct + direcție (nenormalizată)
interface Circle { c: Vec2; r: number }

interface Store { pts: Record<string, Vec2>; lines: Record<string, Line>; circles: Record<string, Circle> }

function evalLen(e: LenExpr, st: Store): number {
  if (typeof e === "number") return e;
  if ("dist" in e) { const [a, b] = e.dist; return d2(needPt(st, a), needPt(st, b)); }
  if ("scale" in e) return evalLen(e.scale[0], st) * e.scale[1];
  if ("sum" in e) return e.sum.reduce((s: number, x) => s + evalLen(x, st), 0);
  throw new Error("LenExpr invalid");
}

function needPt(st: Store, id: string): Vec2 {
  const p = st.pts[id];
  if (!p) throw new Error(`punctul „${id}” nu e construit încă (ordinea pașilor?)`);
  return p;
}

/** Rezolvă un ObjRef la o dreaptă (id de dreaptă sau pereche de puncte). */
function asLine(st: Store, ref: ObjRef): Line {
  if (Array.isArray(ref)) { const a = needPt(st, ref[0]), b = needPt(st, ref[1]); return { p: a, d: sub(b, a) }; }
  if (st.lines[ref]) return st.lines[ref];
  throw new Error(`dreapta „${ref}” nu există`);
}
function asObj(st: Store, ref: ObjRef): { line?: Line; circle?: Circle } {
  if (Array.isArray(ref)) return { line: asLine(st, ref) };
  if (st.lines[ref]) return { line: st.lines[ref] };
  if (st.circles[ref]) return { circle: st.circles[ref] };
  throw new Error(`obiectul „${ref}” nu există (nici dreaptă, nici cerc)`);
}

function interLineLine(a: Line, b: Line): Vec2[] {
  const denom = cross(a.d, b.d);
  if (Math.abs(denom) < EPS) return []; // paralele/coincidente → fără punct unic
  const t = cross(sub(b.p, a.p), b.d) / denom;
  return [[a.p[0] + t * a.d[0], a.p[1] + t * a.d[1]]];
}
function interLineCircle(l: Line, c: Circle): Vec2[] {
  // |l.p + t·d − c| = r  → ecuație de gradul 2 în t
  const f = sub(l.p, c.c);
  const A = dot(l.d, l.d), B = 2 * dot(f, l.d), C = dot(f, f) - c.r * c.r;
  const disc = B * B - 4 * A * C;
  if (disc < -EPS) return [];
  const s = Math.sqrt(Math.max(0, disc));
  const ts = disc < EPS ? [-B / (2 * A)] : [(-B - s) / (2 * A), (-B + s) / (2 * A)];
  return ts.map((t) => [l.p[0] + t * l.d[0], l.p[1] + t * l.d[1]] as Vec2);
}
function interCircleCircle(a: Circle, b: Circle): Vec2[] {
  const dx = b.c[0] - a.c[0], dy = b.c[1] - a.c[1];
  const dd = Math.hypot(dx, dy);
  if (dd < EPS) return []; // concentrice
  if (dd > a.r + b.r + EPS || dd < Math.abs(a.r - b.r) - EPS) return []; // disjuncte / una în alta
  const aDist = (a.r * a.r - b.r * b.r + dd * dd) / (2 * dd);
  const h2 = a.r * a.r - aDist * aDist;
  const h = Math.sqrt(Math.max(0, h2));
  const xm = a.c[0] + (aDist * dx) / dd, ym = a.c[1] + (aDist * dy) / dd;
  if (h < EPS) return [[xm, ym]];
  const rx = -(dy / dd) * h, ry = (dx / dd) * h;
  return [[xm + rx, ym + ry], [xm - rx, ym - ry]];
}

/** Alege determinist un candidat dintre intersecții. Vezi doc la tipul `Pick`. */
function pickFrom(cands: Vec2[], pick: Pick | undefined, st: Store): Vec2 {
  if (cands.length === 0) throw new Error("nicio intersecție (obiecte disjuncte/paralele)");
  if (cands.length === 1) return cands[0];
  const sorted = [...cands].sort((u, v) => (Math.abs(u[0] - v[0]) > EPS ? u[0] - v[0] : u[1] - v[1]));
  if (pick === undefined) return [...cands].sort((u, v) => (Math.abs(v[1] - u[1]) > EPS ? v[1] - u[1] : v[0] - u[0]))[0]; // upper, tie-break right
  if (pick === "upper") return cands.reduce((m, p) => (p[1] > m[1] ? p : m));
  if (pick === "lower") return cands.reduce((m, p) => (p[1] < m[1] ? p : m));
  if (pick === "right") return cands.reduce((m, p) => (p[0] > m[0] ? p : m));
  if (pick === "left") return cands.reduce((m, p) => (p[0] < m[0] ? p : m));
  if (pick === "first") return sorted[0];
  if (pick === "second") return sorted[1] ?? sorted[0];
  if ("near" in pick) { const r = needPt(st, pick.near); return cands.reduce((m, p) => (d2(p, r) < d2(m, r) ? p : m)); }
  if ("far" in pick) { const r = needPt(st, pick.far); return cands.reduce((m, p) => (d2(p, r) > d2(m, r) ? p : m)); }
  return sorted[0];
}

function footOf(p: Vec2, q: Vec2, r: Vec2): Vec2 {
  const qr = sub(r, q), t = dot(sub(p, q), qr) / dot(qr, qr);
  return [q[0] + t * qr[0], q[1] + t * qr[1]];
}

function triCenter(kind: string, A: Vec2, B: Vec2, C: Vec2): Vec2 {
  const a = d2(B, C), b = d2(C, A), c = d2(A, B);
  if (kind === "centroid") return [(A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3];
  if (kind === "incenter") { const s = a + b + c; return [(a * A[0] + b * B[0] + c * C[0]) / s, (a * A[1] + b * B[1] + c * C[1]) / s]; }
  // circumcentru: intersecția mediatoarelor (formulă cu determinant)
  const D = 2 * (A[0] * (B[1] - C[1]) + B[0] * (C[1] - A[1]) + C[0] * (A[1] - B[1]));
  if (Math.abs(D) < EPS) throw new Error("triunghi degenerat (circumcentru nedefinit)");
  const A2 = A[0] * A[0] + A[1] * A[1], B2 = B[0] * B[0] + B[1] * B[1], C2 = C[0] * C[0] + C[1] * C[1];
  const ox = (A2 * (B[1] - C[1]) + B2 * (C[1] - A[1]) + C2 * (A[1] - B[1])) / D;
  const oy = (A2 * (C[0] - B[0]) + B2 * (A[0] - C[0]) + C2 * (B[0] - A[0])) / D;
  const O: Vec2 = [ox, oy];
  if (kind === "circumcenter") return O;
  if (kind === "orthocenter") return [A[0] + B[0] + C[0] - 2 * O[0], A[1] + B[1] + C[1] - 2 * O[1]]; // H = A+B+C−2O
  throw new Error(`centru necunoscut: ${kind}`);
}

// ───────────────────────── SOLVER ─────────────────────────
/** Construiește deterministic toate coordonatele din pași. Aruncă eroare clară dacă un pas e imposibil. */
export function solveConstraints(prob: GeoProblem): Store {
  const st: Store = { pts: {}, lines: {}, circles: {} };
  const set = (id: string, v: Vec2) => { st.pts[id] = v; };

  for (const s of prob.build) {
    switch (s.op) {
      case "baseSegment": {
        if (!(s.length > 0)) throw new Error("baseSegment: length trebuie pozitiv");
        set(s.a, [0, 0]); set(s.b, [s.length, 0]); break;
      }
      case "triangleSSS": {
        const { ab, bc, ca } = s;
        if (![ab, bc, ca].every((x) => x > 0)) throw new Error("triangleSSS: laturi pozitive necesare");
        if (ab + bc <= ca + EPS || ab + ca <= bc + EPS || bc + ca <= ab + EPS)
          throw new Error(`triangleSSS: inegalitatea triunghiului cade (${ab}, ${bc}, ${ca})`);
        const x = (ab * ab + ca * ca - bc * bc) / (2 * ab);
        const y = Math.sqrt(Math.max(0, ca * ca - x * x));
        set(s.ids[0], [0, 0]); set(s.ids[1], [ab, 0]); set(s.ids[2], [x, y]); break;
      }
      case "isoFromBaseHeight": {
        if (!(s.base > 0) || !(s.height > 0)) throw new Error("isoFromBaseHeight: base și height pozitive");
        set(s.left, [-s.base / 2, 0]); set(s.right, [s.base / 2, 0]); set(s.apex, [0, s.height]); break;
      }
      case "rightTriangle": {
        if (!(s.leg > 0)) throw new Error("rightTriangle: leg pozitiv");
        const h = s.leg * Math.tan((s.angleAtLegEnd * Math.PI) / 180);
        set(s.right, [0, 0]); set(s.legEnd, [s.leg, 0]); set(s.vert, [0, h]); break;
      }
      case "parallelogram": {
        const ids4 = s.ids, k = Math.max(0, ids4.indexOf(s.angleAt));
        const vk = ids4[k], vN = ids4[(k + 1) % 4], vP = ids4[(k + 3) % 4], vO = ids4[(k + 2) % 4];
        const th = (s.angle * Math.PI) / 180, [r0, r1] = s.sideRatio;
        if (!(r0 > 0) || !(r1 > 0)) throw new Error("parallelogram: sideRatio pozitiv");
        const co: Record<string, Vec2> = {};
        co[vk] = [0, 0]; co[vN] = [r0, 0]; co[vP] = [r1 * Math.cos(th), r1 * Math.sin(th)];
        co[vO] = [co[vN][0] + co[vP][0], co[vN][1] + co[vP][1]];
        const idx: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };
        const at = (letter: string) => co[ids4[idx[letter] ?? 0]];
        const L0 = d2(at(s.scaleBy.diagonal[0]), at(s.scaleBy.diagonal[1]));
        if (L0 < EPS) throw new Error(`parallelogram: diagonala ${s.scaleBy.diagonal} e nulă`);
        const f = s.scaleBy.length / L0;
        for (const id of ids4) set(id, [co[id][0] * f, co[id][1] * f]);
        break;
      }
      case "circle": {
        const c = needPt(st, s.center);
        const r = s.through != null ? d2(c, needPt(st, s.through)) : s.radius != null ? evalLen(s.radius, st) : NaN;
        if (!(r > 0)) throw new Error(`circle „${s.id}”: rază invalidă`);
        st.circles[s.id] = { c, r }; break;
      }
      case "line": st.lines[s.id] = (() => { const a = needPt(st, s.through[0]), b = needPt(st, s.through[1]); return { p: a, d: sub(b, a) }; })(); break;
      case "perpLine": { const l = asLine(st, s.to); st.lines[s.id] = { p: needPt(st, s.through), d: [-l.d[1], l.d[0]] }; break; }
      case "parallelLine": { const l = asLine(st, s.to); st.lines[s.id] = { p: needPt(st, s.through), d: [...l.d] as Vec2 }; break; }
      case "intersect": {
        const o0 = asObj(st, s.of[0]), o1 = asObj(st, s.of[1]);
        let cands: Vec2[];
        if (o0.line && o1.line) cands = interLineLine(o0.line, o1.line);
        else if (o0.line && o1.circle) cands = interLineCircle(o0.line, o1.circle);
        else if (o0.circle && o1.line) cands = interLineCircle(o1.line, o0.circle);
        else cands = interCircleCircle(o0.circle!, o1.circle!);
        set(s.id, pickFrom(cands, s.pick, st)); break;
      }
      case "midpoint": { const a = needPt(st, s.of[0]), b = needPt(st, s.of[1]); set(s.id, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]); break; }
      case "foot": set(s.id, footOf(needPt(st, s.from), needPt(st, s.to[0]), needPt(st, s.to[1]))); break;
      case "onSegment": {
        const a = needPt(st, s.seg[0]), b = needPt(st, s.seg[1]); const L = d2(a, b);
        const t = s.ratio != null ? s.ratio : s.dist != null ? (L > 0 ? s.dist / L : 0) : 0.5;
        set(s.id, [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]); break;
      }
      case "center": { const [A, B, C] = s.tri.map((i) => needPt(st, i)); set(s.id, triCenter(s.kind, A, B, C)); break; }
      case "bisectorFoot": {
        const [a, b, c] = s.tri; const A = needPt(st, s.from);
        const others = [a, b, c].filter((i) => i !== s.from);
        if (others.length !== 2) throw new Error("bisectorFoot: `from` trebuie să fie un vârf al triunghiului");
        const [B, C] = others.map((i) => needPt(st, i));
        const AB = d2(A, B), AC = d2(A, C); const t = AB / (AB + AC); // BD/DC = AB/AC
        set(s.id, [B[0] + t * (C[0] - B[0]), B[1] + t * (C[1] - B[1])]); break;
      }
    }
  }
  return st;
}

// ───────────────────────── AUTO-VERIFICARE ─────────────────────────
export interface Check { name: string; pass: boolean; detail: string }
const relEq = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

function polyArea(pts: Vec2[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) { const j = (i + 1) % pts.length; s += pts[i][0] * pts[j][1] - pts[j][0] * pts[i][1]; }
  return Math.abs(s) / 2;
}
function angleDeg(at: Vec2, p: Vec2, q: Vec2): number {
  const u = sub(p, at), w = sub(q, at);
  const c = dot(u, w) / (Math.hypot(...u) * Math.hypot(...w));
  return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;
}

/** Verifică fiecare GIVEN împotriva figurii rezolvate. PASS doar dacă reproduce numărul (tol relativă). */
export function verifyGivens(st: Store, givens: Given[], tol = 1e-9): Check[] {
  const P = (id: string) => needPt(st, id);
  const checks: Check[] = [];
  for (const g of givens) {
    try {
      if (g.kind === "length") {
        const m = d2(P(g.of[0]), P(g.of[1]));
        checks.push({ name: `|${g.of.join("")}| = ${g.value}`, pass: relEq(m, g.value, tol), detail: `măsurat ${m.toFixed(6)}` });
      } else if (g.kind === "angle") {
        const m = angleDeg(P(g.at), P(g.rays[0]), P(g.rays[1]));
        checks.push({ name: `∠${g.rays[0]}${g.at}${g.rays[1]} = ${g.value}°`, pass: relEq(m, g.value, tol), detail: `măsurat ${m.toFixed(6)}°` });
      } else if (g.kind === "rightAngle") {
        const m = angleDeg(P(g.at), P(g.rays[0]), P(g.rays[1]));
        checks.push({ name: `∠${g.rays[0]}${g.at}${g.rays[1]} = 90°`, pass: relEq(m, 90, tol), detail: `măsurat ${m.toFixed(6)}°` });
      } else if (g.kind === "area") {
        const m = polyArea(g.of.map(P));
        checks.push({ name: `aria(${g.of.join("")}) = ${g.value}`, pass: relEq(m, g.value, tol), detail: `măsurat ${m.toFixed(6)}` });
      } else if (g.kind === "incircleRadius") {
        const [A, B, C] = g.tri.map(P); const a = d2(B, C), b = d2(C, A), c = d2(A, B);
        const s = (a + b + c) / 2; const r = polyArea([A, B, C]) / s;
        checks.push({ name: `r_înscris(${g.tri.join("")}) = ${g.value}`, pass: relEq(r, g.value, tol), detail: `măsurat ${r.toFixed(6)}` });
      } else if (g.kind === "ratio") {
        const r = d2(P(g.of[0][0]), P(g.of[0][1])) / d2(P(g.of[1][0]), P(g.of[1][1]));
        checks.push({ name: `${g.of[0].join("")}:${g.of[1].join("")} = ${g.value}`, pass: relEq(r, g.value, tol), detail: `măsurat ${r.toFixed(6)}` });
      } else if (g.kind === "collinear") {
        let ok = true; const ps = g.points.map(P);
        for (let i = 2; i < ps.length; i++) { if (Math.abs(cross(sub(ps[i - 1], ps[0]), sub(ps[i], ps[0]))) > tol * 1e3) ok = false; }
        checks.push({ name: `coliniare(${g.points.join("")})`, pass: ok, detail: ok ? "ok" : "necoliniare" });
      } else if (g.kind === "tangent") {
        const circ = st.circles[g.circle]; if (!circ) throw new Error(`cercul „${g.circle}” nu există`);
        const f = footOf(circ.c, P(g.line[0]), P(g.line[1])); const dline = d2(circ.c, f);
        checks.push({ name: `tangentă(${g.circle}, ${g.line.join("")})`, pass: relEq(dline, circ.r, tol), detail: `dist=${dline.toFixed(6)} r=${circ.r.toFixed(6)}` });
      }
    } catch (e) {
      checks.push({ name: JSON.stringify(g), pass: false, detail: (e as Error).message });
    }
  }
  return checks;
}

// ───────────────────────── → FigureSpec2D (puncte EXPLICITE, deja rezolvate) ─────────────────────────
function deriveDraw(prob: GeoProblem): NonNullable<GeoProblem["draw"]> {
  if (prob.draw) return prob.draw;
  const polygons: string[][] = [];
  const segments: Array<{ between: [string, string]; label?: string }> = [];
  const circles: Array<{ center: string; radius?: LenExpr; through?: string }> = [];
  const incircles: Array<[string, string, string]> = [];
  for (const s of prob.build) {
    if (s.op === "triangleSSS") polygons.push([...s.ids]);
    else if (s.op === "isoFromBaseHeight") polygons.push([s.apex, s.left, s.right]);
    else if (s.op === "rightTriangle") polygons.push([s.right, s.legEnd, s.vert]);
    else if (s.op === "parallelogram") polygons.push([...s.ids]);
    else if (s.op === "baseSegment") segments.push({ between: [s.a, s.b] });
    else if (s.op === "circle") circles.push({ center: s.center, radius: s.radius, through: s.through });
    else if (s.op === "center" && s.kind === "incenter") incircles.push(s.tri);
    else if (s.op === "bisectorFoot") segments.push({ between: [s.from, s.id] });
    else if (s.op === "foot") segments.push({ between: [s.from, s.id] });
    else if (s.op === "line") segments.push({ between: [...s.through] });
  }
  return { polygons, segments, circles, incircles };
}

/** Transformă o construcție rezolvată într-un FigureSpec2D cu puncte EXPLICITE (intră direct în renderer). */
export function casToFigureSpec(prob: GeoProblem, st: Store): FigureSpec2D {
  const points: FigurePoint[] = Object.entries(st.pts).map(([id, [x, y]]) => ({ id, x, y, label: id }));
  const elements: FigureElement[] = [];
  const draw = deriveDraw(prob);
  for (const poly of draw.polygons ?? []) elements.push({ kind: "polygon", points: poly });
  for (const seg of draw.segments ?? []) elements.push({ kind: "segment", between: seg.between, label: seg.label });
  for (const tri of draw.incircles ?? []) elements.push({ kind: "incircle", of: tri, centerLabel: "I" });
  for (const c of draw.circles ?? []) {
    const r = c.through != null ? d2(st.pts[c.center], st.pts[c.through]) : c.radius != null ? evalLen(c.radius, st) : undefined;
    elements.push({ kind: "circle", center: c.center, radius: r, centerLabel: c.center });
  }
  // Marcaje din givens: unghi drept / unghi cu valoare.
  for (const g of prob.givens) {
    if (g.kind === "rightAngle") elements.push({ kind: "rightAngle", at: g.at, from: g.rays });
    else if (g.kind === "angle") elements.push({ kind: "angle", at: g.at, from: g.rays, label: `${g.value}°` });
  }
  return { points, elements };
}

// ───────────────────────── ORCHESTRATOR ─────────────────────────
export interface CASResult {
  ok: boolean;
  accepted: boolean;
  checks: Check[];
  points?: Record<string, Vec2>;
  spec?: FigureSpec2D;
  reason?: string; // motivul respingerii (eroare de construcție sau invariant picat)
}

/**
 * Pipeline complet: solve → verify → accept/reject. ACCEPTĂ doar dacă construcția reușește ȘI
 * TOATE numerele date sunt reproduse. Altfel RESPINGE (fără spec) — niciodată o figură greșită.
 */
export function solveAndVerify(prob: GeoProblem, tol = 1e-9): CASResult {
  let st: Store;
  try { st = solveConstraints(prob); }
  catch (e) { return { ok: false, accepted: false, checks: [], reason: `construcție imposibilă: ${(e as Error).message}` }; }
  const checks = verifyGivens(st, prob.givens, tol);
  const ok = checks.length > 0 ? checks.every((c) => c.pass) : true;
  if (!ok) {
    const failed = checks.filter((c) => !c.pass).map((c) => `${c.name} (${c.detail})`).join(" · ");
    return { ok: false, accepted: false, checks, points: st.pts, reason: `numere nereproduse: ${failed}` };
  }
  return { ok: true, accepted: true, checks, points: st.pts, spec: casToFigureSpec(prob, st) };
}
