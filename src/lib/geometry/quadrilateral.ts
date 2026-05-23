import type { Point } from './types';

function deg2rad(d: number) {
  return (d * Math.PI) / 180;
}
function fmt(n: number, d = 3) {
  return n.toFixed(d);
}
function dist(A: Point, B: Point) {
  return Math.sqrt((B[0] - A[0]) ** 2 + (B[1] - A[1]) ** 2);
}
function mid(A: Point, B: Point): Point {
  return [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
}

// ─── Types ─────────────────────────────────────────────────────────────────

export interface ParallelogramInput {
  base: number;
  side: number;
  angle?: number;    // interior angle at A, default 60°

  show_vertices?: boolean;
  show_sides?: boolean;
  show_diagonals?: boolean;
  show_height?: boolean;
  auto_detect_special?: boolean;
  label_vertices?: [string, string, string, string];  // [A,B,C,D], defaults to ABCD
}

export interface TrapezoidInput {
  base_long: number;
  base_short: number;
  height: number;
  offset?: number;   // horizontal offset of top-left vertex; default = (base_long-base_short)/2 (isosceles)

  show_vertices?: boolean;
  show_sides?: boolean;
  show_diagonals?: boolean;
  show_height?: boolean;
  show_midline?: boolean;
  auto_detect_isosceles?: boolean;
  auto_detect_right?: boolean;
  label_vertices?: [string, string, string, string];
}

export interface QuadrilateralOutput {
  tikz: string;
  points: Record<string, Point>;
  computed: {
    area?: number;
    perimeter?: number;
    diagonal1?: number;
    diagonal2?: number;
    height?: number;
    special_type?: string;
  };
  construction_steps: Array<{
    step: number;
    title: string;
    explanation: string;
    cumulative_tikz: string;
  }>;
}

// ─── Parallelogram helpers ─────────────────────────────────────────────────

export function parallelogramVertices(
  base: number,
  side: number,
  angleDeg: number,
): [Point, Point, Point, Point] {
  // A bottom-left, B bottom-right, C top-right, D top-left
  const A: Point = [0, 0];
  const B: Point = [base, 0];
  const D: Point = [side * Math.cos(deg2rad(angleDeg)), side * Math.sin(deg2rad(angleDeg))];
  const C: Point = [B[0] + D[0], B[1] + D[1]];
  return [A, B, C, D];
}

function detectParallelogramType(base: number, side: number, angleDeg: number): string {
  const isRhombus = Math.abs(base - side) < 1e-9;
  const isRect = Math.abs(angleDeg - 90) < 1e-6;
  if (isRhombus && isRect) return 'pătrat';
  if (isRhombus) return 'romb';
  if (isRect) return 'dreptunghi';
  return 'paralelogram';
}

// ─── Parallelogram generator ────────────────────────────────────────────────

export function generateParallelogramAdvanced(input: ParallelogramInput): QuadrilateralOutput {
  const angle = input.angle ?? 60;
  const [A, B, C, D] = parallelogramVertices(input.base, input.side, angle);
  const lbls = input.label_vertices ?? ['A', 'B', 'C', 'D'];
  const [lA, lB, lC, lD] = lbls;

  const points: Record<string, Point> = { [lA]: A, [lB]: B, [lC]: C, [lD]: D };

  const diag1 = dist(A, C);
  const diag2 = dist(B, D);
  const h = input.side * Math.sin(deg2rad(angle));
  const area = input.base * h;
  const perimeter = 2 * (input.base + input.side);

  const computed: QuadrilateralOutput['computed'] = {
    area,
    perimeter,
    diagonal1: diag1,
    diagonal2: diag2,
    height: h,
  };

  if (input.auto_detect_special) {
    computed.special_type = detectParallelogramType(input.base, input.side, angle);
  }

  const steps: QuadrilateralOutput['construction_steps'] = [];
  let cum = `\\begin{tikzpicture}\n`;

  // Step 1: outline
  const drawRightAngle = input.auto_detect_special && Math.abs(angle - 90) < 1e-6;

  cum += `  \\draw[thick] (${fmt(A[0])},${fmt(A[1])}) -- (${fmt(B[0])},${fmt(B[1])}) -- (${fmt(C[0])},${fmt(C[1])}) -- (${fmt(D[0])},${fmt(D[1])}) -- cycle;\n`;

  if (input.show_vertices !== false) {
    for (const [l, p] of [[lA, A], [lB, B], [lC, C], [lD, D]] as [string, Point][]) {
      const anc =
        p[1] < 0.01 ? 'below' : 'above';
      const side2 = p[0] < 0.01 ? 'left' : '';
      cum += `  \\fill (${fmt(p[0])},${fmt(p[1])}) circle (0.05) node[${anc}${side2 ? ' ' + side2 : ''}] {$${l}$};\n`;
    }
  }

  if (drawRightAngle) {
    cum += `  \\draw[thick] (0.2,0) -- (0.2,0.2) -- (0,0.2);\n`;
  }

  steps.push({
    step: 1,
    title: `Conturul ${computed.special_type ?? 'paralelogramului'} ${lA}${lB}${lC}${lD}`,
    explanation: `Trasăm paralelogramul cu baza ${input.base}, latura ${input.side} și unghiul ${angle}°.`,
    cumulative_tikz: cum + `\\end{tikzpicture}`,
  });

  // Step 2: diagonals
  if (input.show_diagonals) {
    const O2 = mid(A, C);
    cum += `  \\draw[dashed] (${fmt(A[0])},${fmt(A[1])}) -- (${fmt(C[0])},${fmt(C[1])});\n`;
    cum += `  \\draw[dashed] (${fmt(B[0])},${fmt(B[1])}) -- (${fmt(D[0])},${fmt(D[1])});\n`;
    cum += `  \\fill (${fmt(O2[0])},${fmt(O2[1])}) circle (0.05) node[above right] {$O$};\n`;
    points['O'] = O2;
    steps.push({
      step: 2,
      title: 'Diagonalele',
      explanation: `Diagonalele ${lA}${lC} și ${lB}${lD} se bisectează în O.`,
      cumulative_tikz: cum + `\\end{tikzpicture}`,
    });
  }

  // Step 3: height from B to AD
  if (input.show_height) {
    // Foot of perpendicular from B to line AD
    const footX = A[0] + (B[0] - A[0]) * 0 + 0; // B.x projected onto the base line (y=0)
    const footH: Point = [B[0], 0];
    cum += `  \\draw[dashed, blue] (${fmt(B[0])},${fmt(B[1])}) -- (${fmt(footH[0])},${fmt(footH[1])});\n`;
    cum += `  \\draw[blue] (${fmt(footH[0] - 0.15)},0) -- (${fmt(footH[0] - 0.15)},0.15) -- (${fmt(footH[0])},0.15);\n`;
    cum += `  \\node[right, blue] at (${fmt(B[0] + 0.05)},${fmt(h / 2)}) {$h=${fmt(h, 2)}$};\n`;
    points['H'] = footH;
    steps.push({
      step: steps.length + 1,
      title: 'Înălțimea',
      explanation: `Înălțimea h = ${h.toFixed(2)} corespunzătoare bazei ${lA}${lB}.`,
      cumulative_tikz: cum + `\\end{tikzpicture}`,
    });
  }

  cum += `\\end{tikzpicture}`;

  return { tikz: cum, points, computed, construction_steps: steps };
}

// ─── Trapezoid helpers ──────────────────────────────────────────────────────

export function trapezoidVertices(
  baseLong: number,
  baseShort: number,
  height: number,
  offset?: number,
): [Point, Point, Point, Point] {
  const off = offset ?? (baseLong - baseShort) / 2;
  const A: Point = [off, height];
  const B: Point = [0, 0];
  const C: Point = [baseLong, 0];
  const D: Point = [off + baseShort, height];
  return [A, B, C, D];  // A top-left, B bottom-left, C bottom-right, D top-right
}

// ─── Trapezoid generator ────────────────────────────────────────────────────

export function generateTrapezoidAdvanced(input: TrapezoidInput): QuadrilateralOutput {
  const off = input.offset ?? (input.base_long - input.base_short) / 2;
  const [A, B, C, D] = trapezoidVertices(input.base_long, input.base_short, input.height, off);
  const lbls = input.label_vertices ?? ['A', 'B', 'C', 'D'];
  const [lA, lB, lC, lD] = lbls;

  const points: Record<string, Point> = { [lA]: A, [lB]: B, [lC]: C, [lD]: D };

  const area = 0.5 * (input.base_long + input.base_short) * input.height;
  const midline = (input.base_long + input.base_short) / 2;
  const sideLeft = dist(A, B);
  const sideRight = dist(C, D);
  const perimeter = input.base_long + input.base_short + sideLeft + sideRight;

  const computed: QuadrilateralOutput['computed'] = {
    area,
    perimeter,
    diagonal1: dist(A, C),
    diagonal2: dist(B, D),
    height: input.height,
  };

  const isIsosceles = Math.abs(sideLeft - sideRight) < 1e-6;
  const isRight = Math.abs(off) < 1e-6;

  if (input.auto_detect_isosceles && isIsosceles) {
    computed.special_type = 'trapez isoscel';
  } else if (input.auto_detect_right && isRight) {
    computed.special_type = 'trapez dreptunghic';
  } else {
    computed.special_type = 'trapez';
  }

  const steps: QuadrilateralOutput['construction_steps'] = [];
  let cum = `\\begin{tikzpicture}\n`;

  // Step 1: outline
  cum += `  \\draw[thick] (${fmt(A[0])},${fmt(A[1])}) -- (${fmt(B[0])},${fmt(B[1])}) -- (${fmt(C[0])},${fmt(C[1])}) -- (${fmt(D[0])},${fmt(D[1])}) -- cycle;\n`;

  if (input.show_vertices !== false) {
    for (const [l, p, anc] of [
      [lA, A, 'above left'],
      [lB, B, 'below left'],
      [lC, C, 'below right'],
      [lD, D, 'above right'],
    ] as [string, Point, string][]) {
      cum += `  \\fill (${fmt(p[0])},${fmt(p[1])}) circle (0.05) node[${anc}] {$${l}$};\n`;
    }
  }

  if (isRight && input.auto_detect_right) {
    cum += `  \\draw[thick] (0,0.2) -- (0.2,0.2) -- (0.2,0);\n`;
  }

  steps.push({
    step: 1,
    title: `Conturul ${computed.special_type}`,
    explanation: `Trapez cu baza mare ${input.base_long}, baza mică ${input.base_short}, înălțimea ${input.height}.`,
    cumulative_tikz: cum + `\\end{tikzpicture}`,
  });

  // Step 2: diagonals
  if (input.show_diagonals) {
    cum += `  \\draw[dashed] (${fmt(A[0])},${fmt(A[1])}) -- (${fmt(C[0])},${fmt(C[1])});\n`;
    cum += `  \\draw[dashed] (${fmt(B[0])},${fmt(B[1])}) -- (${fmt(D[0])},${fmt(D[1])});\n`;
    steps.push({
      step: 2,
      title: 'Diagonalele',
      explanation: `Diagonalele ${lA}${lC} și ${lB}${lD}.`,
      cumulative_tikz: cum + `\\end{tikzpicture}`,
    });
  }

  // Step 3: midline
  if (input.show_midline) {
    const ML: Point = [(A[0] + B[0]) / 2, input.height / 2];
    const MR: Point = [(C[0] + D[0]) / 2, input.height / 2];
    cum += `  \\draw[blue, dashed] (${fmt(ML[0])},${fmt(ML[1])}) -- (${fmt(MR[0])},${fmt(MR[1])}) node[midway, above] {$m=${fmt(midline, 2)}$};\n`;
    steps.push({
      step: steps.length + 1,
      title: 'Linia mijlocie',
      explanation: `Linia mijlocie m = (${input.base_long} + ${input.base_short}) / 2 = ${midline.toFixed(2)}.`,
      cumulative_tikz: cum + `\\end{tikzpicture}`,
    });
  }

  // Step 4: height
  if (input.show_height) {
    const footX = A[0];
    cum += `  \\draw[dashed, blue] (${fmt(footX)},${fmt(input.height)}) -- (${fmt(footX)},0);\n`;
    cum += `  \\draw[blue] (${fmt(footX + 0.15)},0) -- (${fmt(footX + 0.15)},0.15) -- (${fmt(footX)},0.15);\n`;
    cum += `  \\node[right, blue] at (${fmt(footX + 0.05)},${fmt(input.height / 2)}) {$h=${fmt(input.height, 2)}$};\n`;
    steps.push({
      step: steps.length + 1,
      title: 'Înălțimea',
      explanation: `Înălțimea h = ${input.height}.`,
      cumulative_tikz: cum + `\\end{tikzpicture}`,
    });
  }

  cum += `\\end{tikzpicture}`;

  return { tikz: cum, points, computed, construction_steps: steps };
}
