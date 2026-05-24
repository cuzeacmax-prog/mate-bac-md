/**
 * frustum.ts — Trunchiuri de piramidă și de con
 * Proiecție cabinet consistentă cu solid3d.ts
 */

import type { Point } from './types';
import { regularPolygonVertices } from './polygon';
import { cabinetProjection } from './solid3d';

function fmt(n: number, d = 3) {
  return n.toFixed(d);
}

type Point3D = readonly [number, number, number];

function proj(p: Point3D): Point {
  return cabinetProjection(p, 0.45, 30);
}

function p2str(p: Point) {
  return `(${fmt(p[0])},${fmt(p[1])})`;
}

function baseLabel(i: number): string {
  const lbs = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  return lbs[i] ?? `V_{${i + 1}}`;
}

function topLabel(i: number): string {
  const lbs = ["A'", "B'", "C'", "D'", "E'", "F'", "G'", "H'"];
  return lbs[i] ?? `V'_{${i + 1}}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FrustumPyramidInput {
  base_sides: number;      // 3, 4, 6 ...
  base_radius: number;     // raza bazei mari
  top_radius: number;      // raza bazei mici
  height: number;

  show_height?: boolean;
  show_apothem_lateral?: boolean;  // generatoarea (de la mijlocul laturii de sus la mijlocul laturii de jos)
  show_hidden_lines?: boolean;
  label_vertices?: boolean;
  label_apex?: string;             // ignorat (trunchiuri nu au vârf), păstrat pt compatibilitate
}

export interface FrustumConeInput {
  bottom_radius: number;
  top_radius: number;
  height: number;

  show_axis?: boolean;
  show_slant?: boolean;    // generatoarea laterală
  show_radii?: boolean;    // razele celor două baze
  label_bottom_center?: string;
  label_top_center?: string;
}

export interface FrustumOutput {
  tikz: string;
  points: Record<string, Point>;
  computed: {
    base_area: number;
    top_area: number;
    lateral_area: number;
    volume: number;
    slant_height: number;
  };
  construction_steps: Array<{
    step: number;
    title: string;
    explanation: string;
    cumulative_tikz: string;
  }>;
}

// ─── Frustum Pyramid ─────────────────────────────────────────────────────────

export function generateFrustumPyramidAdvanced(input: FrustumPyramidInput): FrustumOutput {
  const n = input.base_sides;
  const R = input.base_radius;
  const r = input.top_radius;
  const h = input.height;
  const showHidden = input.show_hidden_lines !== false;

  // Polygon vertices pentru cele 2 baze — orientare identică
  const baseVerts2D = regularPolygonVertices(n, R, [0, 0], 90 - 90 / n);
  const topVerts2D  = regularPolygonVertices(n, r, [0, 0], 90 - 90 / n);

  // 3D points: baza jos la y=0, baza sus la y=h
  const base3D: Point3D[] = baseVerts2D.map((p) => [p[0], 0, p[1]]);
  const top3D:  Point3D[] = topVerts2D.map((p) => [p[0], h, p[1]]);

  const basePts = base3D.map(proj);
  const topPts  = top3D.map(proj);

  const points: Record<string, Point> = {};
  for (let i = 0; i < n; i++) {
    points[baseLabel(i)] = basePts[i];
    points[topLabel(i)]  = topPts[i];
  }

  // Math
  const sideLen     = 2 * R * Math.sin(Math.PI / n);
  const sideLenTop  = 2 * r * Math.sin(Math.PI / n);
  const apothemBase = R * Math.cos(Math.PI / n);
  const apothemTop  = r * Math.cos(Math.PI / n);
  const slantH      = Math.sqrt(h ** 2 + (apothemBase - apothemTop) ** 2);
  const baseArea    = 0.5 * n * sideLen * apothemBase;
  const topArea     = 0.5 * n * sideLenTop * apothemTop;
  const lateralArea = 0.5 * n * (sideLen + sideLenTop) * slantH;
  const volume      = (h / 3) * (baseArea + topArea + Math.sqrt(baseArea * topArea));

  const steps: FrustumOutput['construction_steps'] = [];
  let cum = `\\begin{tikzpicture}\n`;

  // Baza mare (jos)
  {
    const pathPts = basePts.map(p2str).join(' -- ');
    cum += `  \\draw[thick] ${pathPts} -- cycle;\n`;
  }

  // Baza mică (sus)
  {
    const pathPts = topPts.map(p2str).join(' -- ');
    cum += `  \\draw[thick] ${pathPts} -- cycle;\n`;
  }

  // Muchii laterale
  for (let i = 0; i < n; i++) {
    const hiddenIdx = Math.floor(n / 2);
    const style = (i >= hiddenIdx && showHidden) ? 'dashed, gray' : 'thick';
    cum += `  \\draw[${style}] ${p2str(basePts[i])} -- ${p2str(topPts[i])};\n`;
  }

  // Etichete
  if (input.label_vertices !== false) {
    for (let i = 0; i < n; i++) {
      const bp = basePts[i];
      const dx = bp[0];
      const anc = dx < -0.01 ? 'left' : (dx > 0.01 ? 'right' : 'below');
      cum += `  \\fill ${p2str(bp)} circle (0.04) node[${anc}] {$${baseLabel(i)}$};\n`;

      const tp = topPts[i];
      const dxt = tp[0];
      const anct = dxt < -0.01 ? 'above left' : 'above right';
      cum += `  \\fill ${p2str(tp)} circle (0.04) node[${anct}] {$${topLabel(i)}$};\n`;
    }
  }

  steps.push({
    step: 1,
    title: `Trunchi de piramidă regulată cu ${n} fețe`,
    explanation: `R=${R}, r=${r}, h=${h}. V=${volume.toFixed(2)}.`,
    cumulative_tikz: cum + `\\end{tikzpicture}`,
  });

  // Înălțimea
  if (input.show_height) {
    const baseCtr = proj([0, 0, 0]);
    const topCtr  = proj([0, h, 0]);
    cum += `  \\draw[blue, dashed] ${p2str(baseCtr)} -- ${p2str(topCtr)} node[right, midway] {$h=${fmt(h, 2)}$};\n`;
    cum += `  \\fill ${p2str(baseCtr)} circle (0.04) node[below] {$O$};\n`;
    cum += `  \\fill ${p2str(topCtr)} circle (0.04) node[above] {$O'$};\n`;
    points['O'] = baseCtr;
    points["O'"] = topCtr;
    steps.push({
      step: steps.length + 1,
      title: 'Înălțimea',
      explanation: `Înălțimea h = ${h} între centrele celor două baze.`,
      cumulative_tikz: cum + `\\end{tikzpicture}`,
    });
  }

  // Apotema laterală
  if (input.show_apothem_lateral) {
    // De la mijlocul primei laturi a bazei mari la mijlocul primei laturi a bazei mici
    const midBase3D: Point3D = [
      (base3D[0][0] + base3D[1][0]) / 2, 0,
      (base3D[0][2] + base3D[1][2]) / 2,
    ];
    const midTop3D: Point3D = [
      (top3D[0][0] + top3D[1][0]) / 2, h,
      (top3D[0][2] + top3D[1][2]) / 2,
    ];
    const midBasePt = proj(midBase3D);
    const midTopPt  = proj(midTop3D);
    cum += `  \\draw[orange] ${p2str(midBasePt)} -- ${p2str(midTopPt)} node[midway, right] {$l=${fmt(slantH, 2)}$};\n`;
    steps.push({
      step: steps.length + 1,
      title: 'Generatoarea laterală',
      explanation: `Generatoarea l = √(h²+(R-r)²) = ${slantH.toFixed(2)}.`,
      cumulative_tikz: cum + `\\end{tikzpicture}`,
    });
  }

  cum += `\\end{tikzpicture}`;

  return {
    tikz: cum,
    points,
    computed: { base_area: baseArea, top_area: topArea, lateral_area: lateralArea, volume, slant_height: slantH },
    construction_steps: steps,
  };
}

// ─── Frustum Cone ─────────────────────────────────────────────────────────────

const EY = 0.3; // ellipse vertical scale factor

export function generateFrustumConeAdvanced(input: FrustumConeInput): FrustumOutput {
  const R  = input.bottom_radius;
  const r  = input.top_radius;
  const h  = input.height;
  const cx = 0;
  const cy = 0;
  const lblBot = input.label_bottom_center ?? 'O';
  const lblTop = input.label_top_center ?? "O'";

  const slantH    = Math.sqrt(h ** 2 + (R - r) ** 2);
  const baseArea  = Math.PI * R * R;
  const topArea   = Math.PI * r * r;
  const lateralArea = Math.PI * (R + r) * slantH;
  const volume    = (Math.PI * h / 3) * (R * R + R * r + r * r);

  const points: Record<string, Point> = {
    [lblBot]: [cx, cy],
    [lblTop]: [cx, cy + h],
  };

  const steps: FrustumOutput['construction_steps'] = [];
  let cum = `\\begin{tikzpicture}\n`;

  // Baza mare (jos) — elipsă completă
  cum += `  \\draw[thick] (${fmt(cx)},${fmt(cy)}) ellipse (${fmt(R)} and ${fmt(R * EY)});\n`;

  // Baza mică (sus) — elipsă completă
  cum += `  \\draw[thick] (${fmt(cx)},${fmt(cy + h)}) ellipse (${fmt(r)} and ${fmt(r * EY)});\n`;

  // Generatoarele laterale (2 linii drepte)
  cum += `  \\draw[thick] (${fmt(cx - R)},${fmt(cy)}) -- (${fmt(cx - r)},${fmt(cy + h)});\n`;
  cum += `  \\draw[thick] (${fmt(cx + R)},${fmt(cy)}) -- (${fmt(cx + r)},${fmt(cy + h)});\n`;

  // Centre
  cum += `  \\fill (${fmt(cx)},${fmt(cy)}) circle (0.04) node[below] {$${lblBot}$};\n`;
  cum += `  \\fill (${fmt(cx)},${fmt(cy + h)}) circle (0.04) node[above] {$${lblTop}$};\n`;

  steps.push({
    step: 1,
    title: `Trunchi de con R=${R}, r=${r}, h=${h}`,
    explanation: `Trunchi circular drept. V=${volume.toFixed(2)}.`,
    cumulative_tikz: cum + `\\end{tikzpicture}`,
  });

  if (input.show_axis) {
    cum += `  \\draw[dashed, gray] (${fmt(cx)},${fmt(cy)}) -- (${fmt(cx)},${fmt(cy + h)});\n`;
    steps.push({
      step: steps.length + 1,
      title: 'Axa',
      explanation: `Axa de rotație (h = ${h}).`,
      cumulative_tikz: cum + `\\end{tikzpicture}`,
    });
  }

  if (input.show_radii) {
    cum += `  \\draw[blue] (${fmt(cx)},${fmt(cy)}) -- (${fmt(cx + R)},${fmt(cy)}) node[midway, below] {$R=${fmt(R, 2)}$};\n`;
    cum += `  \\draw[blue] (${fmt(cx)},${fmt(cy + h)}) -- (${fmt(cx + r)},${fmt(cy + h)}) node[midway, above] {$r=${fmt(r, 2)}$};\n`;
    steps.push({
      step: steps.length + 1,
      title: 'Razele bazelor',
      explanation: `Raza mare R=${R}, raza mică r=${r}.`,
      cumulative_tikz: cum + `\\end{tikzpicture}`,
    });
  }

  if (input.show_slant) {
    cum += `  \\draw[orange, thick] (${fmt(cx + R)},${fmt(cy)}) -- (${fmt(cx + r)},${fmt(cy + h)}) node[midway, right] {$l=${fmt(slantH, 2)}$};\n`;
    steps.push({
      step: steps.length + 1,
      title: 'Generatoarea',
      explanation: `l = √(h²+(R-r)²) = ${slantH.toFixed(2)}.`,
      cumulative_tikz: cum + `\\end{tikzpicture}`,
    });
  }

  cum += `\\end{tikzpicture}`;

  return {
    tikz: cum,
    points,
    computed: { base_area: baseArea, top_area: topArea, lateral_area: lateralArea, volume, slant_height: slantH },
    construction_steps: steps,
  };
}
