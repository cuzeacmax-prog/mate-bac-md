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

export type Body3D = RegularPyramidSpec | PerpFromVertexSpec;

export interface FigureSpec3D {
  body: Body3D;
  /** Ce să marcheze (implicit: înălțimea + unghiul diedru pt. piramidă). */
  show?: { height?: boolean; dihedral?: boolean };
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
