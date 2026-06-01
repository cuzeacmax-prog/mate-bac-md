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

export interface FigureSpec3D {
  body: RegularPyramidSpec;
  /** Ce să marcheze (implicit: înălțimea + unghiul diedru). */
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
