/**
 * ETAPA 26 — Specificația de figură 3D (corp + parametri → coordonate, rezolvate de motor).
 *
 * Aceeași filozofie ca 2D: declari CORPUL + parametri, solverul calculează vârfurile (corect prin
 * construcție), iar JSXGraph view3d (NATIV) randează. NU plasezi puncte de mână. NU folosește three.js.
 * Începem cu UN șablon: piramida regulată.
 */

export type Vec3 = [number, number, number];

/** Piramidă regulată: bază regulată cu `baseSides` laturi de lungime `baseEdge`, înălțime `height`. */
export interface RegularPyramidSpec {
  kind: "regularPyramid";
  baseSides: number;
  baseEdge: number;
  height: number;
  /** [apex, bază0, bază1, …]. Implicit V, A, B, C, D… */
  labels?: string[];
}

/**
 * Triunghi în plan (z=0) + segment perpendicular pe plan dintr-un vârf (config. „teorema celor 3
 * perpendiculare” / distanța de la un punct la o dreaptă în spațiu).
 */
export interface PerpFromVertexSpec {
  kind: "perpFromVertex";
  triangle: { sides: { AB: number; BC: number; CA: number } };
  apexFrom: string;        // vârful din care se ridică perpendiculara (ex. "A")
  apexHeight: number;      // lungimea segmentului (ex. AM)
  apexLabel?: string;      // eticheta apexului (ex. "M")
  labels?: [string, string, string]; // etichetele triunghiului de bază
}

export interface CubeSpec { kind: "cube"; edge: number; labels?: string[] }
export interface BoxSpec { kind: "box"; length: number; width: number; height: number; labels?: string[] }
export interface PrismSpec { kind: "prism"; baseSides: number; baseEdge: number; height: number; labels?: string[] }
export interface TetrahedronSpec { kind: "tetrahedron"; edge: number; labels?: string[] }
export interface FrustumSpec { kind: "frustum"; baseSides: number; baseEdge: number; topEdge: number; height: number; labels?: string[] }
export interface ConeSpec { kind: "cone"; radius: number; height: number }
export interface CylinderSpec { kind: "cylinder"; radius: number; height: number }
export interface SphereSpec { kind: "sphere"; radius: number }

export type PolyhedronBody = CubeSpec | BoxSpec | PrismSpec | TetrahedronSpec | FrustumSpec;
export type RoundBody = ConeSpec | CylinderSpec | SphereSpec;
export type Body3D = RegularPyramidSpec | PerpFromVertexSpec | PolyhedronBody | RoundBody;

export interface FigureSpec3D {
  /** Corp standard (șablon) SAU scenă compusă din primitive generale. Exact unul. */
  body?: Body3D;
  scene?: Scene3D;
  /** Ce să marcheze (implicit: înălțimea + unghiul diedru pt. piramidă). */
  show?: { height?: boolean; dihedral?: boolean };
}

// ───────────────────────── STRAT GENERAL: scenă 3D compozabilă din primitive ────────────────────
/** Punct 3D: explicit SAU generat prin constrângere. */
export interface P3Explicit { id: string; x: number; y: number; z: number }
export interface P3RegPoly { gen: "regularPolygon3d"; ids: string[]; sides: number; edge?: number; circumradius?: number; z?: number; center?: [number, number] }
export interface P3OnAxis { gen: "pointOnAxis"; id: string; height: number; over?: [number, number]; overCentroidOf?: string[] }
export interface P3Mid { gen: "midpoint3d"; id: string; of: [string, string] }
export interface P3Centroid { gen: "centroid3d"; id: string; of: string[] }
export type Point3DSpec = P3Explicit | P3RegPoly | P3OnAxis | P3Mid | P3Centroid;

/** Elemente de scenă (poliedru GENERAL prin vârfuri+fețe, suprafețe parametrice, relații). */
export interface ElPolyhedron { kind: "polyhedron"; vertices: string[]; faces: string[][]; fillOpacity?: number }
export interface ElSphere { kind: "sphere3d"; center?: string | Vec3; radius: number }
export interface ElCone { kind: "cone3d"; radius: number; height: number; baseCenter?: string | Vec3 }
export interface ElCylinder { kind: "cylinder3d"; radius: number; height: number; baseCenter?: string | Vec3 }
export interface ElSegment { kind: "segment3d"; of: [string, string]; dash?: boolean; color?: string; label?: string }
export interface ElInscribedSphere { kind: "inscribedSphere"; inCone: { radius: number; height: number }; baseCenter?: string | Vec3 }
export interface ElLabel { kind: "label3d"; at: string | Vec3; text: string }
export type SceneElement = ElPolyhedron | ElSphere | ElCone | ElCylinder | ElSegment | ElInscribedSphere | ElLabel;

export interface Scene3D { points: Point3DSpec[]; elements: SceneElement[] }

/** Rezolvă punctele unei scene (explicite + generate). PUR. Aruncă la referințe lipsă. */
export function solveScenePoints(scene: Scene3D): Record<string, Vec3> {
  const out: Record<string, Vec3> = {};
  const need = (id: string): Vec3 => { const p = out[id]; if (!p) throw new Error(`punctul „${id}” e folosit înainte să fie definit.`); return p; };
  for (const p of scene.points) {
    if (!("gen" in p)) { out[p.id] = [p.x, p.y, p.z]; continue; }
    if (p.gen === "regularPolygon3d") {
      const n = Math.floor(p.sides);
      if (n < 3 || !Array.isArray(p.ids) || p.ids.length < n) throw new Error("regularPolygon3d: sides ≥ 3 și ids suficiente.");
      const R = p.circumradius ?? (p.edge != null ? p.edge / (2 * Math.sin(Math.PI / n)) : 1);
      const z = p.z ?? 0; const [cx, cy] = p.center ?? [0, 0]; const t0 = Math.PI / n - Math.PI / 2;
      p.ids.slice(0, n).forEach((id, i) => { const t = t0 + (2 * Math.PI * i) / n; out[id] = [cx + R * Math.cos(t), cy + R * Math.sin(t), z]; });
    } else if (p.gen === "pointOnAxis") {
      let xy: [number, number] = p.over ?? [0, 0];
      if (p.overCentroidOf?.length) { let sx = 0, sy = 0; for (const id of p.overCentroidOf) { const q = need(id); sx += q[0]; sy += q[1]; } const k = p.overCentroidOf.length; xy = [sx / k, sy / k]; }
      out[p.id] = [xy[0], xy[1], p.height];
    } else if (p.gen === "midpoint3d") { const a = need(p.of[0]), b = need(p.of[1]); out[p.id] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]; }
    else if (p.gen === "centroid3d") { let s: Vec3 = [0, 0, 0]; for (const id of p.of) { const q = need(id); s = [s[0] + q[0], s[1] + q[1], s[2] + q[2]]; } const k = p.of.length || 1; out[p.id] = [s[0] / k, s[1] / k, s[2] / k]; }
  }
  return out;
}

/** Semi-dimensiunea cadrului pentru o scenă. */
export function sceneExtent(scene: Scene3D): number {
  let m = 1;
  try { for (const v of Object.values(solveScenePoints(scene))) v.forEach((x) => { m = Math.max(m, Math.abs(x)); }); } catch { /* validarea prinde */ }
  for (const e of scene.elements) {
    if (e.kind === "sphere3d") m = Math.max(m, e.radius);
    if (e.kind === "cone3d" || e.kind === "cylinder3d") m = Math.max(m, e.radius, e.height);
    if (e.kind === "inscribedSphere") m = Math.max(m, e.inCone.radius, e.inCone.height);
  }
  return m * 1.4;
}

/** Validează o scenă: fețe → vârfuri existente, poliedru consistent. Greșeala AI = poliedru curat-dar-greșit, prins. */
export function validateScene(scene: Scene3D): { errors: string[] } {
  const errors: string[] = [];
  if (!scene || !Array.isArray(scene.points) || !Array.isArray(scene.elements)) return { errors: ["scene invalidă (points/elements lipsă)."] };
  const ids = new Set<string>();
  for (const p of scene.points) {
    if (p && "gen" in p && p.gen === "regularPolygon3d") (p.ids ?? []).forEach((i) => ids.add(i));
    else if (p && (p as { id?: string }).id) ids.add((p as { id: string }).id);
  }
  for (const e of scene.elements) {
    try {
      if (e.kind === "polyhedron") {
        if (!Array.isArray(e.vertices) || e.vertices.length < 4) errors.push("polyhedron: minim 4 vârfuri.");
        (e.vertices ?? []).forEach((v) => { if (!ids.has(v)) errors.push(`polyhedron: vârful „${v}” nu există.`); });
        if (!Array.isArray(e.faces) || e.faces.length < 3) errors.push("polyhedron: minim 3 fețe.");
        (e.faces ?? []).forEach((f, i) => {
          if (!Array.isArray(f) || f.length < 3) errors.push(`fața ${i}: minim 3 vârfuri.`);
          else f.forEach((v) => { if (!(e.vertices ?? []).includes(v)) errors.push(`fața ${i}: vârful „${v}” nu e în vertices.`); });
        });
      } else if (e.kind === "segment3d") { (e.of ?? []).forEach((v) => { if (!ids.has(v)) errors.push(`segment3d: „${v}” nu există.`); }); }
      else if (e.kind === "sphere3d") { if (!(e.radius > 0)) errors.push("sphere3d: radius pozitiv."); if (typeof e.center === "string" && !ids.has(e.center)) errors.push(`sphere3d: centrul „${e.center}” nu există.`); }
      else if (e.kind === "cone3d" || e.kind === "cylinder3d") { if (!(e.radius > 0) || !(e.height > 0)) errors.push(`${e.kind}: radius și height pozitive.`); }
      else if (e.kind === "inscribedSphere") { if (!(e.inCone?.radius > 0) || !(e.inCone?.height > 0)) errors.push("inscribedSphere: inCone.radius/height pozitive."); }
    } catch { errors.push(`${(e as { kind?: string }).kind ?? "element"}: structură invalidă.`); }
  }
  return { errors };
}

export interface Solved3D {
  /** Vârfuri în ordine: [apex, bază0, bază1, …]. */
  verts: Array<{ id: string; xyz: Vec3 }>;
  /** Fețe ca indici în `verts` (baza + fețele laterale). */
  faces: number[][];
  apexId: string;
  baseIds: string[];
  center: Vec3;              // O = centrul bazei (origine)
  apothemFoot: Vec3;         // M = mijlocul unei laturi de bază
  apothemEdge: [string, string];
  circumR: number;
  apothem: number;
  dihedralDeg: number;       // unghiul diedru față laterală ↔ bază (CALCULAT)
  extent: number;            // semi-dimensiunea pentru cadrul 3D
}

const DEFAULT_LABELS = ["V", "A", "B", "C", "D", "E", "F", "G", "H"];

/** Rezolvă coordonatele unei piramide regulate. PUR. Aruncă pentru parametri invalizi. */
export function solvePyramid(spec: RegularPyramidSpec): Solved3D {
  const n = Math.floor(spec.baseSides);
  const s = spec.baseEdge;
  const h = spec.height;
  if (n < 3) throw new Error(`baseSides trebuie ≥ 3 (e ${spec.baseSides}).`);
  if (s <= 0 || h <= 0) throw new Error("baseEdge și height trebuie pozitive.");

  const circumR = s / (2 * Math.sin(Math.PI / n));
  const apothem = s / (2 * Math.tan(Math.PI / n));
  const dihedralDeg = (Math.atan2(h, apothem) * 180) / Math.PI;

  const labels = spec.labels ?? DEFAULT_LABELS;
  const apexId = labels[0] ?? "V";
  const baseIds = Array.from({ length: n }, (_, i) => labels[i + 1] ?? DEFAULT_LABELS[i + 1] ?? `P${i}`);

  // Bază regulată centrată în origine, z=0; offset ca prima latură să fie simetrică în față.
  const theta0 = Math.PI / n - Math.PI / 2;
  const base: Vec3[] = baseIds.map((_, i) => {
    const t = theta0 + (2 * Math.PI * i) / n;
    return [circumR * Math.cos(t), circumR * Math.sin(t), 0];
  });

  const verts: Array<{ id: string; xyz: Vec3 }> = [
    { id: apexId, xyz: [0, 0, h] },
    ...baseIds.map((id, i) => ({ id, xyz: base[i] })),
  ];
  // Fețe: baza [1..n] + laterale [0, i, i+1].
  const baseFace = baseIds.map((_, i) => i + 1);
  const lateral = baseIds.map((_, i) => [0, i + 1, ((i + 1) % n) + 1]);
  const faces = [baseFace, ...lateral];

  const apothemFoot: Vec3 = [(base[0][0] + base[1][0]) / 2, (base[0][1] + base[1][1]) / 2, 0];
  const extent = Math.max(circumR, h) * 1.25;

  return {
    verts, faces, apexId, baseIds, center: [0, 0, 0],
    apothemFoot, apothemEdge: [baseIds[0], baseIds[1]],
    circumR, apothem, dihedralDeg, extent,
  };
}

export interface SolvedPerp {
  verts: Array<{ id: string; xyz: Vec3 }>; // A, B, C, M(apex), D(piciorul perpendicularei pe latura opusă)
  baseIds: [string, string, string];
  apexId: string;
  apexBaseId: string;             // vârful de bază din care se ridică perpendiculara
  footId: string;
  oppositeEdge: [string, string]; // latura la care se măsoară distanța
  distanceMD: number;             // distanța de la apex la latura opusă (în spațiu)
  apexHeight: number;
  extent: number;
}

/** Triunghi (SSS) în z=0 + apex perpendicular pe plan dintr-un vârf + piciorul D pe latura opusă. PUR. */
export function solvePerpFromVertex(spec: PerpFromVertexSpec): SolvedPerp {
  const { AB, BC } = spec.triangle.sides;
  const CA = spec.triangle.sides.CA ?? (spec.triangle.sides as { CA?: number; AC?: number }).AC;
  if (!(AB > 0) || !(BC > 0) || !(CA! > 0)) throw new Error(`perpFromVertex: laturi invalide (AB=${AB}, BC=${BC}, CA=${CA}).`);
  if (AB + BC <= CA! || AB + CA! <= BC || BC + CA! <= AB) throw new Error(`perpFromVertex: inegalitatea triunghiului cade (${AB}, ${BC}, ${CA}).`);
  if (!(spec.apexHeight > 0)) throw new Error("perpFromVertex: apexHeight trebuie pozitiv.");

  const labels = (spec.labels ?? ["A", "B", "C"]).slice(0, 3); // doar vârfurile bazei (apexul e apexLabel)
  const [LA, LB, LC] = labels;
  const ca = CA as number;
  const cx = (AB * AB + ca * ca - BC * BC) / (2 * AB);
  const cy = Math.sqrt(Math.max(ca * ca - cx * cx, 0));
  const base: Record<string, Vec3> = { [LA]: [0, 0, 0], [LB]: [AB, 0, 0], [LC]: [cx, cy, 0] };

  const apexFrom = base[spec.apexFrom] ? spec.apexFrom : LA;
  const Vc = base[apexFrom];
  const apexLabel = spec.apexLabel ?? "M";
  const M: Vec3 = [Vc[0], Vc[1], spec.apexHeight];

  // latura opusă vârfului apexFrom = ceilalți doi
  const others = labels.filter((l) => l !== apexFrom) as [string, string];
  const P = base[others[0]], Q = base[others[1]];
  // piciorul D al perpendicularei din apexFrom pe dreapta PQ (în z=0)
  const dx = Q[0] - P[0], dy = Q[1] - P[1];
  const t = ((Vc[0] - P[0]) * dx + (Vc[1] - P[1]) * dy) / (dx * dx + dy * dy || 1);
  const D: Vec3 = [P[0] + t * dx, P[1] + t * dy, 0];
  const AD = Math.hypot(Vc[0] - D[0], Vc[1] - D[1]);
  const distanceMD = Math.hypot(AD, spec.apexHeight);

  const footId = "D";
  const verts: Array<{ id: string; xyz: Vec3 }> = [
    { id: LA, xyz: base[LA] }, { id: LB, xyz: base[LB] }, { id: LC, xyz: base[LC] },
    { id: apexLabel, xyz: M }, { id: footId, xyz: D },
  ];
  const extent = Math.max(AB, ca, BC, spec.apexHeight) * 1.25;
  return { verts, baseIds: [LA, LB, LC], apexId: apexLabel, apexBaseId: apexFrom, footId, oppositeEdge: others, distanceMD, apexHeight: spec.apexHeight, extent };
}

// ───────────────────────── Corpuri POLIEDRALE (cub, paralelipiped, prismă, tetraedru, trunchi) ──
export interface SolvedPoly { verts: Array<{ id: string; xyz: Vec3 }>; faces: number[][]; extent: number; info: string }
const BASE_LABELS = ["A", "B", "C", "D", "E", "F", "G", "H"];

function regBase(n: number, edge: number, z: number): Vec3[] {
  const R = edge / (2 * Math.sin(Math.PI / n));
  const t0 = Math.PI / n - Math.PI / 2;
  return Array.from({ length: n }, (_, i) => { const t = t0 + (2 * Math.PI * i) / n; return [R * Math.cos(t), R * Math.sin(t), z] as Vec3; });
}
function centerVerts(v: Vec3[]): Vec3[] {
  const c = [0, 0, 0]; v.forEach((p) => { c[0] += p[0]; c[1] += p[1]; c[2] += p[2]; }); const n = v.length || 1;
  return v.map((p) => [p[0] - c[0] / n, p[1] - c[1] / n, p[2] - c[2] / n] as Vec3);
}
function extentOfVerts(v: Vec3[]): number { let m = 1; v.forEach((p) => p.forEach((x) => { m = Math.max(m, Math.abs(x)); })); return m * 1.3; }

/** Rezolvă un corp poliedral → vârfuri + fețe (centrate la origine). PUR. */
export function solvePolyhedron(body: PolyhedronBody): SolvedPoly {
  let raw: Vec3[] = []; let faces: number[][] = []; let ids: string[] = []; let info = "";

  if (body.kind === "cube" || body.kind === "box") {
    const l = body.kind === "cube" ? body.edge : body.length;
    const w = body.kind === "cube" ? body.edge : body.width;
    const h = body.kind === "cube" ? body.edge : body.height;
    if (!(l > 0) || !(w > 0) || !(h > 0)) throw new Error("dimensiuni pozitive necesare.");
    raw = [[0, 0, 0], [l, 0, 0], [l, w, 0], [0, w, 0], [0, 0, h], [l, 0, h], [l, w, h], [0, w, h]];
    faces = [[0, 1, 2, 3], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]];
    const base = ["A", "B", "C", "D"]; ids = [...base, ...base.map((s) => s + "'")];
    info = body.kind === "cube" ? `cub, muchie ${body.edge}, diagonală ${(body.edge * Math.sqrt(3)).toFixed(2)}` : `paralelipiped ${l}×${w}×${h}, diagonală ${Math.hypot(l, w, h).toFixed(2)}`;
  } else if (body.kind === "prism" || body.kind === "frustum") {
    const n = Math.floor(body.baseSides);
    if (n < 3) throw new Error("baseSides trebuie ≥ 3.");
    const h = body.height; if (!(h > 0) || !(body.baseEdge > 0)) throw new Error("dimensiuni pozitive necesare.");
    const topEdge = body.kind === "frustum" ? body.topEdge : body.baseEdge;
    if (body.kind === "frustum" && !(topEdge > 0)) throw new Error("topEdge pozitiv necesar.");
    const b = regBase(n, body.baseEdge, 0), t = regBase(n, topEdge, h);
    raw = [...b, ...t];
    faces = [Array.from({ length: n }, (_, i) => i), Array.from({ length: n }, (_, i) => n + i)];
    for (let i = 0; i < n; i++) faces.push([i, (i + 1) % n, n + ((i + 1) % n), n + i]);
    const base = BASE_LABELS.slice(0, n); ids = [...base, ...base.map((s) => s + "'")];
    info = body.kind === "frustum" ? `trunchi de piramidă (${n} laturi), baze ${body.baseEdge}/${topEdge}, h=${h}` : `prismă regulată (${n} laturi), muchie ${body.baseEdge}, h=${h}`;
  } else { // tetrahedron
    const e = body.edge; if (!(e > 0)) throw new Error("muchie pozitivă necesară.");
    const A: Vec3 = [0, 0, 0], B: Vec3 = [e, 0, 0], C: Vec3 = [e / 2, (e * Math.sqrt(3)) / 2, 0];
    const D: Vec3 = [(A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3, e * Math.sqrt(2 / 3)];
    raw = [A, B, C, D]; faces = [[0, 1, 2], [0, 1, 3], [1, 2, 3], [2, 0, 3]]; ids = ["A", "B", "C", "D"];
    info = `tetraedru regulat, muchie ${e}`;
  }

  const labels = body.labels && body.labels.length >= ids.length ? body.labels : ids;
  const cv = centerVerts(raw);
  return { verts: cv.map((xyz, i) => ({ id: labels[i] ?? ids[i], xyz })), faces, extent: extentOfVerts(cv), info };
}

/** Semi-dimensiunea cadrului 3D pentru orice corp. */
export function bodyExtent(body: Body3D): number {
  switch (body.kind) {
    case "regularPyramid": return solvePyramid(body).extent;
    case "perpFromVertex": return solvePerpFromVertex(body).extent;
    case "cone": case "cylinder": return Math.max(body.radius, body.height) * 1.4;
    case "sphere": return body.radius * 1.6;
    default: return solvePolyhedron(body).extent;
  }
}
