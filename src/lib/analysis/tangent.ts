/**
 * tangent.ts — Tangent line visualization at a point on a curve.
 * Uses numerical derivative (central differences).
 * ZERO AI — pure math + TikZ.
 */

import {
  fmt, fmtLabel,
  evaluateExpression,
  numericalDerivative,
  sampleFunctionSmart,
  pointsToTikzSegments,
  generateAxesTikz,
  wrapTikz,
  markedPointTikz,
  type GraphOutput,
} from './_helpers';

export interface TangentLineInput {
  expression: string;         // f(x)
  tangent_point: number;      // x₀
  domain?: [number, number];
  range?: [number, number];
  show_grid?: boolean;
  show_normal?: boolean;      // also draw normal line
  show_derivative_value?: boolean;
  show_slope_triangle?: boolean;
  tangent_color?: string;     // default 'red'
  label?: string;
}

export function generateTangentLine(input: TangentLineInput): GraphOutput {
  const { expression } = input;
  const x0 = input.tangent_point;

  const fn = (x: number) => evaluateExpression(expression, x);
  const y0 = fn(x0);
  const slope = numericalDerivative(fn, x0);

  const [xmin, xmax] = input.domain ?? [x0 - 5, x0 + 5];
  const [ymin, ymax] = input.range ?? [y0 - 5, y0 + 5];

  const points = sampleFunctionSmart(fn, [xmin, xmax], 300, ymin, ymax);
  const curveTikz = pointsToTikzSegments(points, 'thick, blue');
  const axesTikz = generateAxesTikz(xmin, xmax, ymin, ymax, { show_grid: input.show_grid });

  const color = input.tangent_color ?? 'red';

  // Tangent line: y = y0 + slope·(x - x0)
  const tangentY1 = y0 + slope * (xmin - x0);
  const tangentY2 = y0 + slope * (xmax - x0);
  let tangentTikz = `  \\draw[${color}, thick] (${fmt(xmin)},${fmt(tangentY1)}) -- (${fmt(xmax)},${fmt(tangentY2)});\n`;

  // Marked point
  tangentTikz += markedPointTikz(x0, y0, `(${fmtLabel(x0)}, ${fmtLabel(y0)})`, { anchor: 'above left', color: 'red!80!black' });

  // Vertical dashed from x0 to x-axis
  tangentTikz += `  \\draw[gray!60, dashed, thin] (${fmt(x0)},0) -- (${fmt(x0)},${fmt(y0)});\n`;
  tangentTikz += `  \\draw[gray!60, dashed, thin] (0,${fmt(y0)}) -- (${fmt(x0)},${fmt(y0)});\n`;

  // Slope triangle
  if (input.show_slope_triangle && Math.abs(slope) > 0.01) {
    const runLength = Math.min(1.5, (xmax - xmin) * 0.15);
    const x1 = x0 + runLength;
    const rise = slope * runLength;
    // Horizontal
    tangentTikz += `  \\draw[orange, thin] (${fmt(x0)},${fmt(y0)}) -- (${fmt(x1)},${fmt(y0)}) node[midway, below] {\\tiny $\\Delta x$};\n`;
    // Vertical
    tangentTikz += `  \\draw[orange, thin] (${fmt(x1)},${fmt(y0)}) -- (${fmt(x1)},${fmt(y0 + rise)}) node[midway, right] {\\tiny $\\Delta y$};\n`;
  }

  // Normal line
  if (input.show_normal && Math.abs(slope) > 1e-9) {
    const normalSlope = -1 / slope;
    const ny1 = y0 + normalSlope * (xmin - x0);
    const ny2 = y0 + normalSlope * (xmax - x0);
    tangentTikz += `  \\draw[green!60!black, thin, dashed] (${fmt(xmin)},${fmt(ny1)}) -- (${fmt(xmax)},${fmt(ny2)});\n`;
    tangentTikz += `  \\node[green!60!black, right] at (${fmt(xmax)},${fmt(ny2)}) {\\small normal};\n`;
  }

  // Labels
  const bStr = parseFloat(y0.toFixed(4)) - slope * x0;
  const tangentEq = slope >= 0
    ? `y = ${fmtLabel(slope)}(x - ${fmtLabel(x0)}) + ${fmtLabel(y0)}`
    : `y = ${fmtLabel(slope)}(x - ${fmtLabel(x0)}) + ${fmtLabel(y0)}`;
  let labelTikz = `  \\node[blue, above right] at (${fmt(xmin)},${fmt(ymax)}) {\\small $f(x)=${input.label ?? expression}$};\n`;
  labelTikz += `  \\node[${color}, below right] at (${fmt(xmin)},${fmt(ymax * 0.82)}) {\\small $${tangentEq}$};\n`;
  if (input.show_derivative_value !== false) {
    labelTikz += `  \\node[gray, below right] at (${fmt(xmin)},${fmt(ymax * 0.65)}) {\\small $f'(${fmtLabel(x0)}) = ${fmtLabel(slope)}$};\n`;
  }

  void bStr;

  const body = axesTikz + curveTikz + tangentTikz + labelTikz;
  const tikz = wrapTikz(body, 0.7);

  return {
    tikz,
    computed: {
      expression,
      tangent_point: x0,
      function_value: parseFloat(y0.toFixed(6)),
      derivative_value: parseFloat(slope.toFixed(6)),
      tangent_equation: tangentEq,
    },
  };
}
