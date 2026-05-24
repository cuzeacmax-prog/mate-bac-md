/**
 * sections.ts — Plane secante prin solide geometrice
 * Vizualizare 2D a intersecției unui plan cu diverse solide.
 */

import type { Point } from './types';
import { cabinetProjection } from './solid3d';
import { regularPolygonVertices } from './polygon';

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

const EY = 0.3; // ellipse factor

// ─── Output type ──────────────────────────────────────────────────────────────

export interface SectionOutput {
  tikz: string;
  points: Record<string, Point>;
  computed: {
    section_shape: string;
    section_area?: number;
    description: string;
  };
  construction_steps: Array<{
    step: number;
    title: string;
    explanation: string;
    cumulative_tikz: string;
  }>;
}

// ─── Input types ──────────────────────────────────────────────────────────────

export interface CubeSectionInput {
  side: number;
  plane_type: 'horizontal' | 'vertical' | 'diagonal_face' | 'diagonal_space';
  plane_position?: number;      // 0-1, default 0.5
  show_full_cube?: boolean;
  highlight_section?: boolean;
  label_section_vertices?: boolean;
}

export interface PyramidSectionInput {
  base_sides: number;
  base_radius: number;
  height: number;
  section_height_ratio: number;  // 0-1, unde e planul secant (fracție din înălțime)
  highlight_section?: boolean;
  label_vertices?: boolean;
}

export interface ConeSectionInput {
  base_radius: number;
  height: number;
  section_height_ratio: number;  // 0-1
  highlight_section?: boolean;
}

export interface SphereSectionInput {
  radius: number;
  section_distance_from_center: number;  // 0 = cerc mare; < radius = cerc mic
  highlight_section?: boolean;
}

export interface CylinderSectionInput {
  radius: number;
  height: number;
  section_type: 'horizontal' | 'axial' | 'oblique';
  oblique_angle?: number;  // grade față de orizontală (pentru oblique)
  highlight_section?: boolean;
}

// ─── Cub cu plan secant ───────────────────────────────────────────────────────

export function generateCubeSectionAdvanced(input: CubeSectionInput): SectionOutput {
  const a = input.side;
  const t = input.plane_position ?? 0.5;
  const showCube = input.show_full_cube !== false;
  const highlight = input.highlight_section !== false;

  // Cube vertices in 3D (cabinet projection)
  type VKey = 'A' | 'B' | 'C' | 'D' | 'Ap' | 'Bp' | 'Cp' | 'Dp';
  const v3d: Record<VKey, Point3D> = {
    A:  [0, 0, 0], B:  [a, 0, 0], C:  [a, a, 0], D:  [0, a, 0],
    Ap: [0, 0, a], Bp: [a, 0, a], Cp: [a, a, a], Dp: [0, a, a],
  };
  const v2d: Record<VKey, Point> = {} as Record<VKey, Point>;
  for (const k of Object.keys(v3d) as VKey[]) {
    v2d[k] = proj(v3d[k]);
  }

  const points: Record<string, Point> = {
    A: v2d.A, B: v2d.B, C: v2d.C, D: v2d.D,
    "A'": v2d.Ap, "B'": v2d.Bp, "C'": v2d.Cp, "D'": v2d.Dp,
  };

  const steps: SectionOutput['construction_steps'] = [];
  let cum = `\\begin{tikzpicture}\n`;

  // Cub întreg
  if (showCube) {
    const solidEdges: Array<[VKey, VKey]> = [
      ['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'A'],
      ['B', 'Bp'], ['C', 'Cp'], ['Bp', 'Cp'], ['Cp', 'Dp'], ['D', 'Dp'],
    ];
    const hiddenEdges: Array<[VKey, VKey]> = [['A', 'Ap'], ['Ap', 'Bp'], ['Ap', 'Dp']];
    for (const [a1, b1] of solidEdges) {
      cum += `  \\draw[thick] ${p2str(v2d[a1])} -- ${p2str(v2d[b1])};\n`;
    }
    for (const [a1, b1] of hiddenEdges) {
      cum += `  \\draw[dashed, gray] ${p2str(v2d[a1])} -- ${p2str(v2d[b1])};\n`;
    }
    // Etichete vârfuri
    const labelMap: Record<VKey, [string, string]> = {
      A: ['A', 'below left'], B: ['B', 'below right'],
      C: ['C', 'right'], D: ['D', 'left'],
      Ap: ["A'", 'above left'], Bp: ["B'", 'above'],
      Cp: ["C'", 'above right'], Dp: ["D'", 'above left'],
    };
    for (const [k, [lbl, anc]] of Object.entries(labelMap) as Array<[VKey, [string, string]]>) {
      cum += `  \\fill ${p2str(v2d[k])} circle (0.04) node[${anc}] {$${lbl}$};\n`;
    }
    steps.push({
      step: 1,
      title: `Cubul ABCD-A'B'C'D' cu latura ${a}`,
      explanation: `Cub cu latura a = ${a}.`,
      cumulative_tikz: cum + `\\end{tikzpicture}`,
    });
  }

  // Plan secant
  let sectionPts: Point[] = [];
  let sectionDesc = '';
  let sectionArea = 0;

  if (input.plane_type === 'horizontal') {
    // Plan orizontal la înălțimea t*a
    const y = t * a;
    const sp: Point3D[] = [[0, y, 0], [a, y, 0], [a, y, a], [0, y, a]];
    sectionPts = sp.map(proj);
    sectionDesc = `Plan orizontal la înălțimea y=${(t * a).toFixed(2)} — rezultă dreptunghi`;
    sectionArea = a * a;
  } else if (input.plane_type === 'vertical') {
    // Plan vertical (x = t*a)
    const x = t * a;
    const sp: Point3D[] = [[x, 0, 0], [x, a, 0], [x, a, a], [x, 0, a]];
    sectionPts = sp.map(proj);
    sectionDesc = `Plan vertical la x=${(t * a).toFixed(2)} — rezultă dreptunghi`;
    sectionArea = a * a;
  } else if (input.plane_type === 'diagonal_face') {
    // Plan prin diagonala feței frontale și latura opusă
    const sp: Point3D[] = [[0, 0, 0], [a, a, 0], [a, a, a], [0, 0, a]];
    sectionPts = sp.map(proj);
    sectionDesc = `Plan diagonal prin fațe — rezultă dreptunghi cu diagonala a√2`;
    sectionArea = a * a * Math.sqrt(2);
  } else {
    // diagonal_space: plan prin 4 vârfuri alternante
    const sp: Point3D[] = [[a, 0, 0], [a, a, a], [0, a, a], [0, 0, 0]];
    sectionPts = sp.map(proj);
    sectionDesc = `Plan secant spațial — rezultă dreptunghi cu diagonala a√3`;
    sectionArea = a * a * Math.sqrt(3);
  }

  // Adaugă punctele secțiunii în points
  ['M', 'N', 'P', 'Q'].forEach((lbl, i) => {
    if (sectionPts[i]) {
      points[lbl] = sectionPts[i];
    }
  });

  if (highlight) {
    const fillPts = sectionPts.map(p2str).join(' -- ');
    cum += `  \\fill[blue!20, opacity=0.5] ${fillPts} -- cycle;\n`;
  }
  const secPath = sectionPts.map(p2str).join(' -- ');
  cum += `  \\draw[blue, thick, dashed] ${secPath} -- cycle;\n`;

  if (input.label_section_vertices !== false) {
    ['M', 'N', 'P', 'Q'].forEach((lbl, i) => {
      if (sectionPts[i]) {
        cum += `  \\fill[blue] ${p2str(sectionPts[i])} circle (0.05) node[above right, blue] {$${lbl}$};\n`;
      }
    });
  }

  steps.push({
    step: showCube ? 2 : 1,
    title: 'Planul secant',
    explanation: sectionDesc,
    cumulative_tikz: cum + `\\end{tikzpicture}`,
  });

  cum += `\\end{tikzpicture}`;

  return {
    tikz: cum,
    points,
    computed: { section_shape: input.plane_type, section_area: sectionArea, description: sectionDesc },
    construction_steps: steps,
  };
}

// ─── Piramidă cu plan secant paralel cu baza ──────────────────────────────────

export function generatePyramidSectionAdvanced(input: PyramidSectionInput): SectionOutput {
  const n = input.base_sides;
  const R = input.base_radius;
  const h = input.height;
  const ratio = Math.max(0.1, Math.min(0.9, input.section_height_ratio));
  const highlight = input.highlight_section !== false;

  // Vârfuri baza mare
  const baseVerts2D = regularPolygonVertices(n, R, [0, 0], 90 - 90 / n);
  const base3D = baseVerts2D.map((p): Point3D => [p[0], 0, p[1]]);

  // Piramida: vârf
  const apex3D: Point3D = [0, h, 0];

  // Plan secant la y = ratio * h → secțiune similară cu scala (1-ratio)
  const secRatio = 1 - ratio;
  const secVerts2D = regularPolygonVertices(n, R * secRatio, [0, 0], 90 - 90 / n);
  const secY = ratio * h;
  const sec3D = secVerts2D.map((p): Point3D => [p[0], secY, p[1]]);

  const basePts = base3D.map(proj);
  const apexPt  = proj(apex3D);
  const secPts  = sec3D.map(proj);

  const points: Record<string, Point> = {};
  const baseLabels = ['A', 'B', 'C', 'D', 'E', 'F'];
  const secLabels  = ["A'", "B'", "C'", "D'", "E'", "F'"];
  for (let i = 0; i < n; i++) {
    if (input.label_vertices !== false) {
      points[baseLabels[i] ?? `V${i}`] = basePts[i];
      points[secLabels[i] ?? `V'${i}`]  = secPts[i];
    }
  }
  points['V'] = apexPt;

  const steps: SectionOutput['construction_steps'] = [];
  let cum = `\\begin{tikzpicture}\n`;

  // Baza mare
  const basePath = basePts.map(p2str).join(' -- ');
  cum += `  \\draw[thick] ${basePath} -- cycle;\n`;

  // Muchii laterale (piramidă completă)
  for (let i = 0; i < n; i++) {
    const style = i >= Math.floor(n / 2) ? 'dashed, gray' : 'thick';
    cum += `  \\draw[${style}] ${p2str(apexPt)} -- ${p2str(basePts[i])};\n`;
  }
  cum += `  \\fill ${p2str(apexPt)} circle (0.04) node[above] {$V$};\n`;

  if (input.label_vertices !== false) {
    for (let i = 0; i < n; i++) {
      const dx = basePts[i][0];
      const anc = dx < -0.01 ? 'left' : 'right';
      cum += `  \\fill ${p2str(basePts[i])} circle (0.04) node[${anc}] {$${baseLabels[i] ?? `V${i}`}$};\n`;
    }
  }

  steps.push({
    step: 1,
    title: `Piramida regulată cu ${n} fețe`,
    explanation: `Piramidă regulată cu R=${R}, h=${h}.`,
    cumulative_tikz: cum + `\\end{tikzpicture}`,
  });

  // Plan secant
  if (highlight) {
    const fillPath = secPts.map(p2str).join(' -- ');
    cum += `  \\fill[red!20, opacity=0.6] ${fillPath} -- cycle;\n`;
  }
  const secPath = secPts.map(p2str).join(' -- ');
  cum += `  \\draw[red, thick] ${secPath} -- cycle;\n`;

  if (input.label_vertices !== false) {
    for (let i = 0; i < n; i++) {
      cum += `  \\fill[red] ${p2str(secPts[i])} circle (0.04) node[right, red, font=\\small] {$${secLabels[i] ?? `V'${i}`}$};\n`;
    }
  }

  const secRadius = R * secRatio;
  const secSideLen = 2 * secRadius * Math.sin(Math.PI / n);
  const secApothem = secRadius * Math.cos(Math.PI / n);
  const sectionArea = 0.5 * n * secSideLen * secApothem;

  steps.push({
    step: 2,
    title: `Plan secant paralel cu baza la h'=${(secY).toFixed(2)}`,
    explanation: `Secțiunea este un poligon similar cu baza, de rază r'=${secRadius.toFixed(2)}, aria=${sectionArea.toFixed(2)}.`,
    cumulative_tikz: cum + `\\end{tikzpicture}`,
  });

  cum += `\\end{tikzpicture}`;

  return {
    tikz: cum,
    points,
    computed: { section_shape: 'polygon', section_area: sectionArea, description: `Plan paralel cu baza la înălțimea ${secY.toFixed(2)}` },
    construction_steps: steps,
  };
}

// ─── Con cu plan secant paralel cu baza ──────────────────────────────────────

export function generateConeSectionAdvanced(input: ConeSectionInput): SectionOutput {
  const R = input.base_radius;
  const h = input.height;
  const ratio = Math.max(0.1, Math.min(0.9, input.section_height_ratio));
  const highlight = input.highlight_section !== false;
  const cx = 0;

  const secY = ratio * h;           // înălțimea planului secant
  const secR = R * (1 - ratio);     // raza cercului de secțiune

  const sectionArea = Math.PI * secR * secR;

  const points: Record<string, Point> = {
    O:  [cx, 0],
    V:  [cx, h],
    "O'": [cx, secY],
  };

  const steps: SectionOutput['construction_steps'] = [];
  let cum = `\\begin{tikzpicture}\n`;

  // Con
  cum += `  \\draw[thick] (${fmt(cx)},0) ellipse (${fmt(R)} and ${fmt(R * EY)});\n`;
  cum += `  \\draw[thick] (${fmt(cx - R)},0) -- (${fmt(cx)},${fmt(h)});\n`;
  cum += `  \\draw[thick] (${fmt(cx + R)},0) -- (${fmt(cx)},${fmt(h)});\n`;
  cum += `  \\fill (${fmt(cx)},${fmt(h)}) circle (0.04) node[above] {$V$};\n`;
  cum += `  \\fill (${fmt(cx)},0) circle (0.04) node[below] {$O$};\n`;

  steps.push({
    step: 1,
    title: `Con r=${R}, h=${h}`,
    explanation: `Con circular drept cu raza r=${R}, înălțimea h=${h}.`,
    cumulative_tikz: cum + `\\end{tikzpicture}`,
  });

  // Plan secant → cerc la înălțimea secY
  if (highlight) {
    cum += `  \\fill[red!20, opacity=0.6] (${fmt(cx)},${fmt(secY)}) ellipse (${fmt(secR)} and ${fmt(secR * EY)});\n`;
  }
  cum += `  \\draw[red, thick] (${fmt(cx)},${fmt(secY)}) ellipse (${fmt(secR)} and ${fmt(secR * EY)});\n`;
  cum += `  \\fill[red] (${fmt(cx)},${fmt(secY)}) circle (0.04) node[right, red] {$O'$};\n`;
  // Linii laterale pentru trunchiul de jos
  cum += `  \\draw[gray, dashed] (${fmt(cx - R)},0) -- (${fmt(cx - secR)},${fmt(secY)});\n`;
  cum += `  \\draw[gray, dashed] (${fmt(cx + R)},0) -- (${fmt(cx + secR)},${fmt(secY)});\n`;

  steps.push({
    step: 2,
    title: `Planul secant la înălțimea ${secY.toFixed(2)}`,
    explanation: `Secțiunea este un cerc cu raza r'=${secR.toFixed(2)}, aria=${sectionArea.toFixed(2)}.`,
    cumulative_tikz: cum + `\\end{tikzpicture}`,
  });

  cum += `\\end{tikzpicture}`;

  return {
    tikz: cum,
    points,
    computed: { section_shape: 'circle', section_area: sectionArea, description: `Plan paralel cu baza la înălțimea ${secY.toFixed(2)}, cerc r'=${secR.toFixed(2)}` },
    construction_steps: steps,
  };
}

// ─── Sferă cu plan secant ─────────────────────────────────────────────────────

export function generateSphereSectionAdvanced(input: SphereSectionInput): SectionOutput {
  const R = input.radius;
  const d = Math.min(Math.abs(input.section_distance_from_center), R * 0.99);
  const highlight = input.highlight_section !== false;

  // Raza secțiunii: r = √(R²-d²)
  const secR = Math.sqrt(Math.max(0, R * R - d * d));
  const sectionArea = Math.PI * secR * secR;
  const isGreatCircle = d < 0.001;

  const points: Record<string, Point> = {
    O: [0, 0],
    "O'": [0, d],
  };

  const steps: SectionOutput['construction_steps'] = [];
  let cum = `\\begin{tikzpicture}\n`;

  // Sfera
  cum += `  \\draw[thick] (0,0) circle (${fmt(R)});\n`;
  cum += `  \\fill (0,0) circle (0.04) node[below left] {$O$};\n`;
  // Ecuator (dashed)
  cum += `  \\draw[dashed, gray] (0,0) ellipse (${fmt(R)} and ${fmt(R * EY)});\n`;

  steps.push({
    step: 1,
    title: `Sfera r=${R}`,
    explanation: `Sferă cu raza R=${R}.`,
    cumulative_tikz: cum + `\\end{tikzpicture}`,
  });

  // Plan secant
  if (highlight) {
    cum += `  \\fill[red!20, opacity=0.5] (0,${fmt(d)}) ellipse (${fmt(secR)} and ${fmt(secR * EY)});\n`;
  }
  cum += `  \\draw[red, thick] (0,${fmt(d)}) ellipse (${fmt(secR)} and ${fmt(secR * EY)});\n`;
  cum += `  \\fill[red] (0,${fmt(d)}) circle (0.04) node[right, red] {$O'$};\n`;
  // Raza planului secant
  cum += `  \\draw[red, dashed] (0,${fmt(d)}) -- (${fmt(secR)},${fmt(d)}) node[midway, above] {$r'=${fmt(secR, 2)}$};\n`;
  // Distanța de la centru
  if (d > 0.01) {
    cum += `  \\draw[blue, dashed] (0,0) -- (0,${fmt(d)}) node[midway, right] {$d=${fmt(d, 2)}$};\n`;
  }

  const circleType = isGreatCircle ? 'cerc mare' : 'cerc mic';
  steps.push({
    step: 2,
    title: `Secțiunea: ${circleType}`,
    explanation: `Secțiunea este un ${circleType} cu r'=${secR.toFixed(2)}, distanța de la centru d=${d.toFixed(2)}.`,
    cumulative_tikz: cum + `\\end{tikzpicture}`,
  });

  cum += `\\end{tikzpicture}`;

  return {
    tikz: cum,
    points,
    computed: { section_shape: circleType, section_area: sectionArea, description: `${circleType} cu r'=${secR.toFixed(2)} la distanța d=${d.toFixed(2)} față de centru` },
    construction_steps: steps,
  };
}

// ─── Cilindru cu plan secant ──────────────────────────────────────────────────

export function generateCylinderSectionAdvanced(input: CylinderSectionInput): SectionOutput {
  const r = input.radius;
  const h = input.height;
  const highlight = input.highlight_section !== false;
  const cx = 0;

  const steps: SectionOutput['construction_steps'] = [];
  let cum = `\\begin{tikzpicture}\n`;

  // Cilindru de bază
  cum += `  \\draw[thick] (${fmt(cx)},0) ellipse (${fmt(r)} and ${fmt(r * EY)});\n`;
  cum += `  \\draw[thick] (${fmt(cx)},${fmt(h)}) ellipse (${fmt(r)} and ${fmt(r * EY)});\n`;
  cum += `  \\draw[thick] (${fmt(cx - r)},0) -- (${fmt(cx - r)},${fmt(h)});\n`;
  cum += `  \\draw[thick] (${fmt(cx + r)},0) -- (${fmt(cx + r)},${fmt(h)});\n`;

  steps.push({
    step: 1,
    title: `Cilindrul r=${r}, h=${h}`,
    explanation: `Cilindru circular drept cu raza r=${r}, înălțimea h=${h}.`,
    cumulative_tikz: cum + `\\end{tikzpicture}`,
  });

  const points: Record<string, Point> = {
    O1: [cx, 0],
    O2: [cx, h],
  };

  let sectionShape = '';
  let sectionArea = 0;
  let sectionDesc = '';

  if (input.section_type === 'horizontal') {
    // Plan orizontal la jumătate → elipsă
    const secY = h / 2;
    if (highlight) {
      cum += `  \\fill[red!20, opacity=0.6] (${fmt(cx)},${fmt(secY)}) ellipse (${fmt(r)} and ${fmt(r * EY)});\n`;
    }
    cum += `  \\draw[red, thick] (${fmt(cx)},${fmt(secY)}) ellipse (${fmt(r)} and ${fmt(r * EY)});\n`;
    sectionShape = 'ellipse';
    sectionArea = Math.PI * r * r;
    sectionDesc = `Plan orizontal la h/2 — rezultă elipsă cu r=${r}`;

  } else if (input.section_type === 'axial') {
    // Plan axial (prin axă) → dreptunghi 2r × h
    if (highlight) {
      cum += `  \\fill[red!20, opacity=0.5] (${fmt(cx - r)},0) rectangle (${fmt(cx + r)},${fmt(h)});\n`;
    }
    cum += `  \\draw[red, thick] (${fmt(cx - r)},0) -- (${fmt(cx + r)},0) -- (${fmt(cx + r)},${fmt(h)}) -- (${fmt(cx - r)},${fmt(h)}) -- cycle;\n`;
    sectionShape = 'rectangle';
    sectionArea = 2 * r * h;
    sectionDesc = `Plan axial — rezultă dreptunghi ${(2 * r).toFixed(2)}×${h}`;

  } else {
    // Oblique — elipsă înclinată (simplificat ca elipsă vizuală)
    const angleDeg = input.oblique_angle ?? 45;
    const angleRad = (angleDeg * Math.PI) / 180;
    const ellipseB = r * EY / Math.cos(angleRad);
    const secY = h * 0.5;
    if (highlight) {
      cum += `  \\fill[red!20, opacity=0.5] (${fmt(cx)},${fmt(secY)}) ellipse (${fmt(r)} and ${fmt(Math.min(ellipseB, r * 0.8))});\n`;
    }
    cum += `  \\draw[red, thick] (${fmt(cx)},${fmt(secY)}) ellipse (${fmt(r)} and ${fmt(Math.min(ellipseB, r * 0.8))});\n`;
    sectionShape = 'ellipse';
    sectionArea = Math.PI * r * r / Math.cos(angleRad);
    sectionDesc = `Plan oblic la ${angleDeg}° — rezultă elipsă`;
  }

  steps.push({
    step: 2,
    title: `Planul secant (${input.section_type})`,
    explanation: sectionDesc,
    cumulative_tikz: cum + `\\end{tikzpicture}`,
  });

  cum += `\\end{tikzpicture}`;

  return {
    tikz: cum,
    points,
    computed: { section_shape: sectionShape, section_area: sectionArea, description: sectionDesc },
    construction_steps: steps,
  };
}
