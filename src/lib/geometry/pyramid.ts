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

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RegularPyramidInput {
  base_sides: number;
  base_radius: number;
  height: number;

  show_apothem?: boolean;
  show_height?: boolean;
  show_lateral_edges?: boolean;
  show_base?: boolean;
  show_hidden_lines?: boolean;
  label_apex?: string;
  label_vertices?: boolean;
}

export interface PyramidOutput {
  tikz: string;
  points: Record<string, Point>;
  computed: {
    base_area: number;
    lateral_area: number;
    volume: number;
    slant_height: number;
    lateral_edge: number;
  };
  construction_steps: Array<{
    step: number;
    title: string;
    explanation: string;
    cumulative_tikz: string;
  }>;
}

// ─── Vertex labels ───────────────────────────────────────────────────────────

function baseLabel(i: number): string {
  const lbs = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  return lbs[i] ?? `V_{${i + 1}}`;
}

// ─── Generator ───────────────────────────────────────────────────────────────

export function generateRegularPyramidAdvanced(input: RegularPyramidInput): PyramidOutput {
  const n = input.base_sides;
  const R = input.base_radius;
  const h = input.height;
  const apexLabel = input.label_apex ?? 'V';
  const showHidden = input.show_hidden_lines !== false;
  const showBase = input.show_base !== false;

  // Base polygon in xz-plane (y=0), center at origin
  // We use 2D polygon vertices in xz-plane: (x, z) pairs
  const baseVerts2D = regularPolygonVertices(n, R, [0, 0], 90 - 90 / n);

  // Map to 3D: (x, 0, z)
  const base3D: Point3D[] = baseVerts2D.map((p) => [p[0], 0, p[1]]);
  const apex3D: Point3D = [0, h, 0];

  // Project all to 2D
  const basePts = base3D.map(proj);
  const apexPt = proj(apex3D);

  const points: Record<string, Point> = { [apexLabel]: apexPt };
  for (let i = 0; i < n; i++) {
    points[baseLabel(i)] = basePts[i];
  }

  // Math
  const sideLen = 2 * R * Math.sin(Math.PI / n);
  const apothem = R * Math.cos(Math.PI / n);
  const slantHeight = Math.sqrt(h ** 2 + apothem ** 2);
  const lateralEdge = Math.sqrt(h ** 2 + R ** 2);
  const baseArea = 0.5 * n * sideLen * apothem;
  const lateralArea = 0.5 * n * sideLen * slantHeight;
  const volume = (1 / 3) * baseArea * h;

  const steps: PyramidOutput['construction_steps'] = [];
  let cum = `\\begin{tikzpicture}\n`;

  // Step 1: base polygon
  if (showBase) {
    const pathPts = basePts.map(p2str).join(' -- ');
    cum += `  \\draw[thick] ${pathPts} -- cycle;\n`;

    // Hidden base edges (simplified: back half dashed)
    // For now, just draw all solid — proper hidden line detection is complex
  }

  if (input.label_vertices !== false) {
    for (let i = 0; i < n; i++) {
      const p = basePts[i];
      const dx = p[0];
      const anc = dx < -0.01 ? 'left' : (dx > 0.01 ? 'right' : 'below');
      cum += `  \\fill ${p2str(p)} circle (0.04) node[${anc}] {$${baseLabel(i)}$};\n`;
    }
    cum += `  \\fill ${p2str(apexPt)} circle (0.04) node[above] {$${apexLabel}$};\n`;
  }

  steps.push({
    step: 1,
    title: `Baza piramidei`,
    explanation: `Poligon regulat cu ${n} laturi, raza ${R}.`,
    cumulative_tikz: cum + `\\end{tikzpicture}`,
  });

  // Step 2: lateral edges
  const showLateral = input.show_lateral_edges !== false;
  if (showLateral) {
    for (let i = 0; i < n; i++) {
      const style = i >= Math.floor(n / 2) && showHidden ? 'dashed, gray' : 'thick';
      cum += `  \\draw[${style}] ${p2str(apexPt)} -- ${p2str(basePts[i])};\n`;
    }
    steps.push({
      step: 2,
      title: 'Muchiile laterale',
      explanation: `Muchiile laterale de la vârf ${apexLabel} la fiecare vârf al bazei. Lungimea muchiei = ${lateralEdge.toFixed(2)}.`,
      cumulative_tikz: cum + `\\end{tikzpicture}`,
    });
  }

  // Step 3: height
  if (input.show_height) {
    const baseCenterPt = proj([0, 0, 0]);
    cum += `  \\draw[blue, dashed] ${p2str(apexPt)} -- ${p2str(baseCenterPt)} node[right, midway] {$h=${fmt(h, 2)}$};\n`;
    cum += `  \\fill ${p2str(baseCenterPt)} circle (0.04) node[below] {$O$};\n`;
    points['O'] = baseCenterPt;
    steps.push({
      step: steps.length + 1,
      title: 'Înălțimea',
      explanation: `Înălțimea h = ${h} de la vârf perpendicular pe centrul O al bazei.`,
      cumulative_tikz: cum + `\\end{tikzpicture}`,
    });
  }

  // Step 4: apothem (slant height to midpoint of base edge)
  if (input.show_apothem) {
    const mid: Point3D = [
      (base3D[0][0] + base3D[1][0]) / 2,
      0,
      (base3D[0][2] + base3D[1][2]) / 2,
    ];
    const midPt = proj(mid);
    cum += `  \\draw[orange] ${p2str(apexPt)} -- ${p2str(midPt)} node[midway, right] {$l=${fmt(slantHeight, 2)}$};\n`;
    steps.push({
      step: steps.length + 1,
      title: 'Apotema laterală',
      explanation: `Apotema laterală l = √(h² + a²) = ${slantHeight.toFixed(2)}.`,
      cumulative_tikz: cum + `\\end{tikzpicture}`,
    });
  }

  cum += `\\end{tikzpicture}`;

  return {
    tikz: cum,
    points,
    computed: {
      base_area: baseArea,
      lateral_area: lateralArea,
      volume,
      slant_height: slantHeight,
      lateral_edge: lateralEdge,
    },
    construction_steps: steps,
  };
}
