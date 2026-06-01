/**
 * ETAPA 13 + 20 + 21 — Specificația de figură 2D (compozabilă, prin CONSTRÂNGERI).
 *
 * Principiu: figura NU se desenează liber. Se DESCRIE prin primitive + RELAȚII + CONSTRÂNGERI, iar
 * motorul rezolvă coordonatele (SSS, paralelogram) și relațiile (intersecții, tangente, paralele la
 * distanță) — corect prin construcție, nu plasat de mână. Acest fișier e contractul de date + solverul pur.
 */

/** Un punct de bază (vârf) cu coordonate EXPLICITE. */
export interface FigurePoint {
  id: string;
  x: number;
  y: number;
  label?: string;
}

/** Triunghiul (3 id-uri de vârf) pe care se sprijină o relație. */
type Tri = [string, string, string];
/** Referință la o dreaptă: id de element SAU pereche de puncte. */
export type LineRef = string | [string, string];

export type FigureElement =
  // ── GENERATORI de coordonate (rezolvați de solver, nu desenați direct) ──
  /** Triunghi din cele 3 LATURI (SSS, legea cosinusului). Eroare dacă inegalitatea triunghiului cade. */
  | { kind: "triangleFromSides"; ids: Tri; sides: { AB: number; BC: number; CA: number }; labels?: Tri }
  /** Paralelogram din unghi + raport laturi, scalat printr-o diagonală/lungime. */
  | {
      kind: "quadFromConstraints";
      ids: [string, string, string, string];
      angleAt: string; angle: number; sideRatio: [number, number];
      scaleBy: { diagonal: "AC" | "BD" | "AB" | "AD"; length: number };
    }
  // ── DESENE ──
  | { kind: "polygon"; points: string[]; label?: string; shade?: boolean; color?: string; fillOpacity?: number }
  | { kind: "circumcircle"; of: Tri; centerLabel?: string; color?: string }
  | { kind: "incircle"; of: Tri; centerLabel?: string; color?: string }
  | { kind: "point"; from: "incenter" | "circumcenter" | "centroid" | "orthocenter"; of?: Tri; label?: string; color?: string; id?: string }
  /** Punct = INTERSECȚIA a două drepte/cercuri (nativ). Expus ca punct referabil prin `id`. */
  | { kind: "point"; from: "intersection"; of: [LineRef, LineRef]; index?: number; label?: string; color?: string; id?: string }
  | { kind: "median"; of: Tri; from: string; label?: string; color?: string; id?: string }
  | { kind: "bisector"; of: Tri; from: string; label?: string; color?: string; id?: string }
  | { kind: "altitude"; of: Tri; from: string; label?: string; color?: string; markRightAngle?: boolean; id?: string }
  | { kind: "perpBisector"; of: Tri; from: string; label?: string; color?: string; id?: string }
  | { kind: "angle"; at: string; from: [string, string]; label?: string; color?: string }
  | { kind: "circle"; id?: string; center: string; through?: string; radius?: number; centerLabel?: string; color?: string }
  | { kind: "tangentLines"; from: string; to: string; markPoints?: boolean; pointLabels?: [string, string]; color?: string }
  | { kind: "midpoint"; of: [string, string]; label?: string; color?: string; id?: string }
  | { kind: "perpendicular"; through: string; toSegment: [string, string]; label?: string; color?: string; id?: string }
  | { kind: "parallel"; through: string; toSegment: [string, string]; label?: string; color?: string; id?: string }
  /** Dreaptă PARALELĂ la un segment, la `distance` perpendiculară, pe partea lui `offsetFrom`. */
  | { kind: "parallelAtDistance"; id?: string; parallelTo: [string, string]; offsetFrom: string; distance: number; color?: string; visible?: boolean }
  | { kind: "segment"; between: [string, string]; label?: string; color?: string; id?: string; showLength?: boolean }
  /** Semn de EGALITATE (liniuțe perpendiculare) la mijlocul segmentului. */
  | { kind: "equalMark"; on: [string, string]; count?: number; color?: string }
  /** Semn de PARALELISM (chevron) la mijlocul segmentului. */
  | { kind: "parallelMark"; on: [string, string]; count?: number; color?: string };

export interface FigureSpec2D {
  points: FigurePoint[];
  elements: FigureElement[];
  boundingBox?: [number, number, number, number];
  /** Încadrare canonică (override). baseEdge = latura așezată orizontal ca bază. */
  framing?: { baseEdge?: [string, string]; anchor?: "bottom-left" };
}

/**
 * Încadrare canonică: similaritate (rotație + reflexie) aplicată DUPĂ rezolvare. Geometria
 * (unghiuri, rapoarte, lungimi) rămâne EXACTĂ. Așază baza orizontal, A în stânga-jos, figura deasupra.
 */
export function frameSolved(
  solved: Record<string, SolvedPoint>,
  framing?: FigureSpec2D["framing"],
): Record<string, SolvedPoint> {
  const ids = Object.keys(solved);
  if (ids.length < 2) return solved;
  const aId = framing?.baseEdge?.[0] ?? (solved["A"] ? "A" : ids[0]);
  const A = solved[aId];
  let bId = framing?.baseEdge?.[1];
  if (!bId) { // latura cea mai lungă pornind din A
    let best = -1; bId = ids.find((i) => i !== aId) ?? aId;
    for (const i of ids) {
      if (i === aId) continue;
      const d = Math.hypot(solved[i].x - A.x, solved[i].y - A.y);
      if (d > best) { best = d; bId = i; }
    }
  }
  const B = solved[bId];
  const theta = Math.atan2(B.y - A.y, B.x - A.x);
  const c = Math.cos(-theta), s = Math.sin(-theta);
  const out: Record<string, SolvedPoint> = {};
  for (const i of ids) {
    const dx = solved[i].x - A.x, dy = solved[i].y - A.y;
    out[i] = { x: dx * c - dy * s, y: dx * s + dy * c, label: solved[i].label };
  }
  // figura deasupra bazei: dacă media e sub axă, reflectă pe verticală (reflexie = similaritate)
  const ys = Object.values(out).map((p) => p.y);
  if (ys.reduce((a, b) => a + b, 0) / ys.length < 0) for (const i of ids) out[i].y = -out[i].y;
  return out;
}

export interface SolvedPoint { x: number; y: number; label?: string }

/** Rezolvă coordonatele punctelor de BAZĂ (explicite + generate prin constrângeri). PUR. */
export function solveBasePoints(spec: FigureSpec2D): Record<string, SolvedPoint> {
  const out: Record<string, SolvedPoint> = {};
  for (const p of spec.points) out[p.id] = { x: p.x, y: p.y, label: p.label };

  for (const e of spec.elements) {
    if (e.kind === "triangleFromSides") {
      const { AB, BC, CA } = e.sides;
      if (AB + BC <= CA || AB + CA <= BC || BC + CA <= AB) {
        throw new Error(`Inegalitatea triunghiului cade pentru laturile (${AB}, ${BC}, ${CA}).`);
      }
      // A=(0,0), B=(AB,0); C din legea cosinusului.
      const x = (AB * AB + CA * CA - BC * BC) / (2 * AB);
      const y2 = CA * CA - x * x;
      if (y2 <= 0) throw new Error(`Triunghi degenerat pentru (${AB}, ${BC}, ${CA}).`);
      const y = Math.sqrt(y2);
      const [a, b, c] = e.ids;
      out[a] = { x: 0, y: 0, label: e.labels?.[0] ?? a };
      out[b] = { x: AB, y: 0, label: e.labels?.[1] ?? b };
      out[c] = { x, y, label: e.labels?.[2] ?? c };
    } else if (e.kind === "quadFromConstraints") {
      const [A, B, C, D] = e.ids;
      const th = (e.angle * Math.PI) / 180;
      const ab = e.sideRatio[0], ad = e.sideRatio[1]; // scară unitară
      const Bx = ab, By = 0;
      const Dx = ad * Math.cos(th), Dy = ad * Math.sin(th);
      const Cx = Bx + Dx, Cy = By + Dy;
      const diag = (n: string) =>
        n === "AC" ? Math.hypot(Cx, Cy) :
        n === "AB" ? ab :
        n === "AD" ? ad :
        Math.hypot(Dx - Bx, Dy - By); // BD
      const L0 = diag(e.scaleBy.diagonal);
      if (L0 === 0) throw new Error(`Diagonala ${e.scaleBy.diagonal} e nulă în constrângeri.`);
      const f = e.scaleBy.length / L0;
      out[A] = { x: 0, y: 0, label: A };
      out[B] = { x: Bx * f, y: By * f, label: B };
      out[C] = { x: Cx * f, y: Cy * f, label: C };
      out[D] = { x: Dx * f, y: Dy * f, label: D };
    }
  }
  return out;
}

/** Cadru auto din punctele rezolvate, cu loc pentru cercuri + etichete. */
export function autoBoundingBox(spec: FigureSpec2D): [number, number, number, number] {
  if (spec.boundingBox) return spec.boundingBox;
  const pts = Object.values(solveBasePoints(spec));
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const half = Math.max(maxX - minX, maxY - minY, 1) / 2;
  const pad = half * 0.9 + Math.max(2, half * 0.5);
  return [cx - pad, cy + pad, cx + pad, cy - pad];
}
