import type { Point } from './types';

function fmt(n: number, d = 3) {
  return n.toFixed(d);
}

type Point3D = readonly [number, number, number];

// ─── Projections ─────────────────────────────────────────────────────────────

export function cabinetProjection(
  p: Point3D,
  scale = 0.65,
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

  // Nou: toate diagonalele (faciale + spațiale)
  show_all_diagonals?: boolean;
  highlighted_space_diagonal?: "AC'" | "BD'" | null;
}

export interface ObliquePrismInput {
  base_width: number;
  base_length: number;
  height: number;
  oblique_offset_x: number;   // deplasare laterală baza de sus
  oblique_offset_z?: number;  // deplasare în adâncime (opțional)
  projection?: 'cabinet' | 'isometric';
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

  // Step: toate diagonalele (spațiale + faciale pe toate fețele)
  if (input.show_all_diagonals) {
    const d3 = a * Math.sqrt(3);
    const d2 = a * Math.sqrt(2);
    // Diagonale spațiale: AC', BD', A'C, B'D
    const spaceDiags: [string, string, string][] = [
      ['A', 'Cp', `a\\sqrt{3}=${fmt(d3, 2)}`],
      ['B', 'Dp', ''],
    ];
    const highlightKey = input.highlighted_space_diagonal;
    for (const [from, to, lbl] of spaceDiags) {
      const isHighlighted = (highlightKey === "AC'" && from === 'A') || (highlightKey === "BD'" && from === 'B');
      const color = isHighlighted ? 'red!80!black' : 'blue!60!black';
      const thickness = isHighlighted ? 'very thick' : 'thick';
      let lineStr = `  \\draw[${color}, ${thickness}] ${p2str(v2d[from as keyof typeof v2d])} -- ${p2str(v2d[to as keyof typeof v2d])}`;
      if (lbl) lineStr += ` node[midway, right] {$${lbl}$}`;
      lineStr += `;\n`;
      cum += lineStr;
    }
    // Diagonale faciale
    const faceDiags: [string, string][] = [
      ['A', 'C'], ['B', 'D'],          // față frontală
      ['Ap', 'Cp'], ['Bp', 'Dp'],      // față spate
      ['A', 'Dp'], ['D', 'Ap'],        // față stânga
      ['B', 'Cp'], ['C', 'Bp'],        // față dreapta
      ['D', 'Bp'], ['A', 'Cp'],        // față sus
      ['A', 'Bp'], ['B', 'Ap'],        // față jos
    ];
    for (const [from, to] of faceDiags) {
      cum += `  \\draw[dashed, teal!60, thin] ${p2str(v2d[from as keyof typeof v2d])} -- ${p2str(v2d[to as keyof typeof v2d])};\n`;
    }
    steps.push({
      step: steps.length + 1,
      title: 'Toate diagonalele cubului',
      explanation: `Diagonala spațială AC' = a√3 = ${d3.toFixed(2)}. Diagonala feței = a√2 = ${d2.toFixed(2)}.`,
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

// ─── Oblique Prism ────────────────────────────────────────────────────────────

export function generateObliquePrismAdvanced(input: ObliquePrismInput): Solid3DOutput {
  const bw = input.base_width;
  const bl = input.base_length;
  const h  = input.height;
  const ox = input.oblique_offset_x;
  const oz = input.oblique_offset_z ?? 0;
  const mode = input.projection ?? 'cabinet';
  const showHidden = input.show_hidden_lines !== false;

  // Baza jos: ABCD la y=0
  // Baza sus: A'B'C'D' la y=h, deplasată cu (ox, oz)
  const v3d: Record<string, Point3D> = {
    A:  [0,    0, 0],    B:  [bw,    0, 0],    C:  [bw,    0, bl],    D:  [0,    0, bl],
    Ap: [ox,   h, oz],   Bp: [bw+ox, h, oz],   Cp: [bw+ox, h, bl+oz], Dp: [ox,   h, bl+oz],
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

  // Fețele vizibile
  const solidEdges: [string, string][] = [
    ['A', 'B'], ['B', 'C'], ['C', 'D'], ['D', 'A'],       // baza jos
    ['Ap', 'Bp'], ['Bp', 'Cp'], ['Cp', 'Dp'], ['Dp', 'Ap'], // baza sus
    ['A', 'Ap'], ['B', 'Bp'], ['C', 'Cp'], ['D', 'Dp'],   // muchii laterale
  ];
  const hiddenEdges: [string, string][] = [];

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
      Ap: ["A'", 'above left'], Bp: ["B'", 'above right'],
      Cp: ["C'", 'right'], Dp: ["D'", 'left'],
    };
    for (const [k, [lbl, anc]] of Object.entries(labelMap)) {
      cum += `  \\fill ${p2str(v2d[k])} circle (0.04) node[${anc}] {$${lbl}$};\n`;
    }
  }

  cum += `\\end{tikzpicture}`;

  const lateralEdge = Math.sqrt(ox * ox + h * h + oz * oz);
  const baseArea = bw * bl;
  const volume = baseArea * h; // V = Aria_baza × h (înălțimea perpendiculară)

  return {
    tikz: cum,
    points,
    computed: {
      volume,
      surface_area: 2 * baseArea + 2 * (bw + bl) * lateralEdge,
    },
    construction_steps: [{
      step: 1,
      title: `Prismă oblică ${bw}×${bl}×${h}`,
      explanation: `Prismă oblică cu baza ${bw}×${bl}, înălțimea h=${h}, deplasare laterală ox=${ox}.`,
      cumulative_tikz: cum,
    }],
  };
}
