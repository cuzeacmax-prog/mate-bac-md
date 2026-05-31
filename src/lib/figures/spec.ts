/**
 * ETAPA 13 + 20 — Specificația de figură 2D (compozabilă, EXTENSIBILĂ).
 *
 * Principiu: figura NU se desenează liber. Se DESCRIE prin primitive + RELAȚII, iar motorul
 * (JSXGraph, conștient matematic) o randează exact — tangența, picioarele perpendicularelor,
 * punctele remarcabile etc. sunt CALCULATE, nu puse de mână. Acest fișier e doar contractul de date.
 */

/** Un punct de bază (vârf). Coordonate în sistemul figurii. */
export interface FigurePoint {
  id: string;
  x: number;
  y: number;
  /** Eticheta afișată (implicit = id). */
  label?: string;
}

/** Triunghiul (3 id-uri de vârf) pe care se sprijină o relație. */
type Tri = [string, string, string];

/**
 * Element definit prin RELAȚIE față de puncte/alte elemente.
 * Fiecare `kind` se mapează pe tipuri NATIVE JSXGraph (sau construcții din ele), ca geometria să fie exactă.
 */
export type FigureElement =
  /** Poligon (ex. triunghi) prin vârfurile sale. */
  | { kind: "polygon"; points: string[]; label?: string }
  /** Cerc circumscris celor 3 puncte (trece prin A,B,C; centru = circumcentru). */
  | { kind: "circumcircle"; of: Tri; centerLabel?: string; color?: string }
  /** Cerc înscris în triunghiul celor 3 puncte (tangent la laturi; centru = incentru). */
  | { kind: "incircle"; of: Tri; centerLabel?: string; color?: string }
  /** Punct remarcabil derivat din triunghi. */
  | { kind: "point"; from: "incenter" | "circumcenter" | "centroid" | "orthocenter"; of?: Tri; label?: string; color?: string }
  /** Mediana din vârful `from` (la mijlocul laturii opuse). */
  | { kind: "median"; of: Tri; from: string; label?: string; color?: string }
  /** Bisectoarea unghiului din vârful `from`. */
  | { kind: "bisector"; of: Tri; from: string; label?: string; color?: string }
  /** Înălțimea din vârful `from` (perpendiculară pe latura opusă); opțional marchează unghiul drept. */
  | { kind: "altitude"; of: Tri; from: string; label?: string; color?: string; markRightAngle?: boolean }
  /** Mediatoarea (perpendiculara pe mijlocul) laturii OPUSE vârfului `from`. */
  | { kind: "perpBisector"; of: Tri; from: string; label?: string; color?: string }
  /** Unghiul în vârful `at`, între razele către `from[0]` și `from[1]` (arc + etichetă, calculat). */
  | { kind: "angle"; at: string; from: [string, string]; label?: string; color?: string }
  /** Cerc generic: prin `through` SAU cu `radius`. `id` permite referirea (ex. la tangente). */
  | { kind: "circle"; id?: string; center: string; through?: string; radius?: number; centerLabel?: string; color?: string }
  /** Cele două tangente din punctul exterior `from` la cercul `to` (id), cu punctele de tangență marcate. */
  | { kind: "tangentLines"; from: string; to: string; markPoints?: boolean; pointLabels?: [string, string]; color?: string }
  /** Mijlocul segmentului `of`. */
  | { kind: "midpoint"; of: [string, string]; label?: string; color?: string }
  /** Perpendiculara prin `through` pe segmentul `toSegment`. */
  | { kind: "perpendicular"; through: string; toSegment: [string, string]; label?: string; color?: string }
  /** Paralela prin `through` la segmentul `toSegment`. */
  | { kind: "parallel"; through: string; toSegment: [string, string]; label?: string; color?: string }
  /** Segment între două puncte, cu etichetă opțională (ex. lungime). */
  | { kind: "segment"; between: [string, string]; label?: string; color?: string };

/** Specificația completă a unei figuri 2D. */
export interface FigureSpec2D {
  points: FigurePoint[];
  elements: FigureElement[];
  /** [xmin, ymax, xmax, ymin] (convenția JSXGraph). Dacă lipsește, se calculează automat. */
  boundingBox?: [number, number, number, number];
}

/** Cadru auto care lasă loc pentru cercuri (care pot depăși vârfurile) și etichete. */
export function autoBoundingBox(spec: FigureSpec2D): [number, number, number, number] {
  if (spec.boundingBox) return spec.boundingBox;
  const xs = spec.points.map((p) => p.x);
  const ys = spec.points.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const half = Math.max(maxX - minX, maxY - minY, 1) / 2;
  const pad = half * 1.9 + 1; // loc pentru cercul circumscris + etichete
  return [cx - pad, cy + pad, cx + pad, cy - pad];
}
