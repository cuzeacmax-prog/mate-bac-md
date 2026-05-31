/**
 * ETAPA 13 — Specificația de figură 2D (minimal, EXTENSIBIL).
 *
 * Principiu: figura NU se desenează liber. Se DESCRIE prin primitive + RELAȚII, iar motorul
 * (JSXGraph, conștient matematic) o randează exact — tangența cercului înscris, plasarea
 * centrelor etc. sunt CALCULATE, nu puse de mână. Acest fișier e doar contractul de date.
 */

/** Un punct de bază (vârf). Coordonate în sistemul figurii. */
export interface FigurePoint {
  id: string;
  x: number;
  y: number;
  /** Eticheta afișată (implicit = id). */
  label?: string;
}

/**
 * Element definit prin RELAȚIE față de puncte/alte elemente.
 * Fiecare `kind` se mapează 1:1 pe un tip NATIV JSXGraph, ca geometria să fie exactă.
 */
export type FigureElement =
  /** Poligon (ex. triunghi) prin vârfurile sale. */
  | { kind: "polygon"; points: string[]; label?: string }
  /** Cerc circumscris celor 3 puncte (trece prin A,B,C; centru = circumcentru). */
  | { kind: "circumcircle"; of: [string, string, string]; centerLabel?: string; color?: string }
  /** Cerc înscris în triunghiul celor 3 puncte (tangent la laturi; centru = incentru). */
  | { kind: "incircle"; of: [string, string, string]; centerLabel?: string; color?: string }
  /** Punct derivat: incentru sau circumcentru (dacă vrei doar centrul, fără cerc). */
  | {
      kind: "point";
      from: "incenter" | "circumcenter";
      /** Cele 3 puncte ale triunghiului; dacă lipsește, se folosește primul poligon. */
      of?: [string, string, string];
      label?: string;
    };

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
