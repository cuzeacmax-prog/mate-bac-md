import type { Point } from './types';

function fmt(n: number, d = 3) {
  return n.toFixed(d);
}

type Point3D = readonly [number, number, number];

// ─── Projections ─────────────────────────────────────────────────────────────

export function cabinetProjection(
  p: Point3D,
  scale = 0.45,
  angleDeg = 30,
): Point {
  const rad = (angleDeg * Math.PI) / 180;
  return [p[0] + scale * p[2] * Math.cos(rad), p[1] + scale * p[2] * Math.sin(rad)];
}

export function isometricProjection(p: Point3D): Point {
  return [
    (p[0] - p[2]) * Math.cos(Math.PI / 6),
    p[1] + (p[0] + p[2]) * Math.sin(Math.PI / 6),
  ];
}

function proj(
  p: Point3D,
  mode: 'cabinet' | 'isometric',
  scale?: number,
  angle?: number,
): Point {
  return mode === 'isometric' ? isometricProjection(p) : cabinetProjection(p, scale, angle);
}

function p2str(p: Point) {
  return `(${fmt(p[0])},${fmt(p[1])})`;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CubeInput {
  side: number;
  projection?: 'cabinet' | 'isometric';

  show_diagonals_face?: boolean;
  show_diagonal_3d?: boolean;
  show_hidden_lines?: boolean;
  label_vertices?: boolean;
}

export interface RectangularPrismInput {
  length: number;
  width: number;
  height: number;
  projection?: 'cabinet' | 'isometric';

  show_diagonal_3d?: boolean;
  show_hidden_lines?: boolean;
  label_vertices?: boolean;
}

export interface Solid3DOutput {
  tikz: string;
  points: Record<string, Point>;
  computed: {
    volume?: number;
    surface_area?: number;
    diagonal_3d?: number;
  };
  construction_steps: Array<{
    step: number;
    title: string;
    explanation: string;
    cumulative_tikz: string;
  }>;
}

// ─── Cube ────────────────────────────────────────────────────────────────────

export function generateCubeAdvanced(input: CubeInput): Solid3DOutput {
  const a = input.side;
  const mode = input.projection ?? 'cabinet';
  const showHidden = input.show_hidden_lines !== false;

  // 3D vertices:
  // Front face: A(0,0,0), B(a,0,0), C(a,a,0), D(0,a,0)
  // Back face:  A'(0,0,a), B'(a,0,a), C'(a,a,a), D'(0,a,a)
  const v3d: Record<string, Point3D> = {
    A:  [0, 0, 0],
    B:  [a, 0, 0],
    C:  [a, a, 0],
    D:  [0, a, 0],
    Ap: [0, 0, a],
    Bp: [a, 0, a],
    Cp: [a, a, a],
    Dp: [0, a, a],
  };

  const v2d: Record<string, Point> = {};
  for (const [k, p] of Object.entries(v3d)) {
    v2d[k] = proj(p, mode);
  }

  // Rename Ap→A', etc. for output
  const points: Record<string, Point> = {
    A: v2d.A, B: v2d.B, C: v2d.C, D: v2d.D,
    "A'": v2d.Ap, "B'": v2d.Bp, "C'": v2d.Cp, "D'": v2d.Dp,
  };

  const steps: Solid3DOutput['construction_steps'] = [];
  let cum = `\\begin{tikzpicture}\n`;

  // Visible solid edges
  const solidEdges: [string, string][] = [
    ['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'A'],   // front face
    ['B', 'Bp'], ['C', 'Cp'],                           // right lateral (visible)
    ['Bp', 'Cp'],                                       // back right vertical
    ['Cp', 'Dp'],                                       // back top
    ['D', 'Dp'],                                        // left-top lateral
  ];

  // Hidden edges (behind the solid)
  const hiddenEdges: [string, string][] = [
    ['A', 'Ap'], ['Ap', 'Bp'], ['Ap', 'Dp'],
  ];

  for (const [a1, b1] of solidEdges) {
    cum += `  \\draw[thick] ${p2str(v2d[a1])} -- ${p2str(v2d[b1])};\n`;
  }
  if (showHidden) {
    for (const [a1, b1] of hiddenEdges) {
      cum += `  \\draw[dashed, gray] ${p2str(v2d[a1])} -- ${p2str(v2d[b1])};\n`;
    }
  }

  if (input.label_vertices !== false) {
    const labelMap: Record<string, [string, string]> = {
      A: ['A', 'below left'], B: ['B', 'below right'],
      C: ['C', 'right'], D: ['D', 'left'],
      Ap: ["A'", 'above left'], Bp: ["B'", 'above'],
      Cp: ["C'", 'above right'], Dp: ["D'", 'above left'],
    };
    for (const [k, [lbl, anc]] of Object.entries(labelMap)) {
      cum += `  \\fill ${p2str(v2d[k])} circle (0.04) node[${anc}] {$${lbl}$};\n`;
    }
  }

  steps.push({
    step: 1,
    title: `Cubul cu latura ${a}`,
    explanation: `Cub ABCD-A'B'C'D' cu latura ${a}. V = ${(a ** 3).toFixed(2)}, S = ${(6 * a ** 2).toFixed(2)}.`,
    cumulative_tikz: cum + `\\end{tikzpicture}`,
  });

  // Step 2: 3D diagonal
  if (input.show_diagonal_3d) {
    cum += `  \\draw[blue, thick] ${p2str(v2d.A)} -- ${p2str(v2d.Cp)} node[midway, right] {$d=${fmt(a * Math.sqrt(3), 2)}$};\n`;
    steps.push({
      step: 2,
      title: 'Diagonala spațială',
      explanation: `Diagonala spațială AC' = a√3 = ${(a * Math.sqrt(3)).toFixed(2)}.`,
      cumulative_tikz: cum + `\\end{tikzpicture}`,
    });
  }

  // Step 3: face diagonals
  if (input.show_diagonals_face) {
    cum += `  \\draw[dashed, blue] ${p2str(v2d.A)} -- ${p2str(v2d.C)};\n`;
    cum += `  \\draw[dashed, blue] ${p2str(v2d.B)} -- ${p2str(v2d.D)};\n`;
    steps.push({
      step: steps.length + 1,
      title: 'Diagonalele feței',
      explanation: `Diagonala feței = a√2 = ${(a * Math.sqrt(2)).toFixed(2)}.`,
      cumulative_tikz: cum + `\\end{tikzpicture}`,
    });
  }

  cum += `\\end{tikzpicture}`;

  const diag3d = a * Math.sqrt(3);

  return {
    tikz: cum,
    points,
    computed: {
      volume: a ** 3,
      surface_area: 6 * a ** 2,
      diagonal_3d: diag3d,
    },
    construction_steps: steps,
  };
}

// ─── Rectangular Prism ───────────────────────────────────────────────────────

export function generateRectangularPrismAdvanced(input: RectangularPrismInput): Solid3DOutput {
  const l = input.length;
  const w = input.width;
  const h = input.height;
  const mode = input.projection ?? 'cabinet';
  const showHidden = input.show_hidden_lines !== false;

  const v3d: Record<string, Point3D> = {
    A:  [0, 0, 0], B:  [l, 0, 0], C:  [l, h, 0], D:  [0, h, 0],
    Ap: [0, 0, w], Bp: [l, 0, w], Cp: [l, h, w], Dp: [0, h, w],
  };

  const v2d: Record<string, Point> = {};
  for (const [k, p] of Object.entries(v3d)) {
    v2d[k] = proj(p, mode);
  }

  const points: Record<string, Point> = {
    A: v2d.A, B: v2d.B, C: v2d.C, D: v2d.D,
    "A'": v2d.Ap, "B'": v2d.Bp, "C'": v2d.Cp, "D'": v2d.Dp,
  };

  let cum = `\\begin{tikzpicture}\n`;

  const solidEdges: [string, string][] = [
    ['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'A'],
    ['B', 'Bp'], ['C', 'Cp'], ['Bp', 'Cp'], ['Cp', 'Dp'], ['D', 'Dp'],
  ];
  const hiddenEdges: [string, string][] = [
    ['A', 'Ap'], ['Ap', 'Bp'], ['Ap', 'Dp'],
  ];

  for (const [a1, b1] of solidEdges) {
    cum += `  \\draw[thick] ${p2str(v2d[a1])} -- ${p2str(v2d[b1])};\n`;
  }
  if (showHidden) {
    for (const [a1, b1] of hiddenEdges) {
      cum += `  \\draw[dashed, gray] ${p2str(v2d[a1])} -- ${p2str(v2d[b1])};\n`;
    }
  }

  const labelMap: Record<string, [string, string]> = {
    A: ['A', 'below left'], B: ['B', 'below right'],
    C: ['C', 'right'], D: ['D', 'left'],
    Ap: ["A'", 'above left'], Bp: ["B'", 'above'],
    Cp: ["C'", 'above right'], Dp: ["D'", 'above left'],
  };
  if (input.label_vertices !== false) {
    for (const [k, [lbl, anc]] of Object.entries(labelMap)) {
      cum += `  \\fill ${p2str(v2d[k])} circle (0.04) node[${anc}] {$${lbl}$};\n`;
    }
  }

  const steps: Solid3DOutput['construction_steps'] = [{
    step: 1,
    title: `Paralelipipedul dreptunghic ${l}×${w}×${h}`,
    explanation: `Paralelipipedul ABCD-A'B'C'D' cu dimensiunile ${l}×${w}×${h}.`,
    cumulative_tikz: cum + `\\end{tikzpicture}`,
  }];

  if (input.show_diagonal_3d) {
    const d3d = Math.sqrt(l ** 2 + w ** 2 + h ** 2);
    cum += `  \\draw[blue, thick] ${p2str(v2d.A)} -- ${p2str(v2d.Cp)} node[midway, above right] {$d=${fmt(d3d, 2)}$};\n`;
    steps.push({
      step: 2,
      title: 'Diagonala spațială',
      explanation: `d = √(${l}²+${w}²+${h}²) = ${d3d.toFixed(2)}.`,
      cumulative_tikz: cum + `\\end{tikzpicture}`,
    });
  }

  cum += `\\end{tikzpicture}`;

  return {
    tikz: cum,
    points,
    computed: {
      volume: l * w * h,
      surface_area: 2 * (l * w + w * h + l * h),
      diagonal_3d: Math.sqrt(l ** 2 + w ** 2 + h ** 2),
    },
    construction_steps: steps,
  };
}
